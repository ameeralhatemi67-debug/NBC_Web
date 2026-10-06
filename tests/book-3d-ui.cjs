// Phase 5: the 3D book on the intro and result screens (WebGL, motion, fallbacks, bundle).
// Needs NBC_PREVIEW_URL (loopback demo build) and PLAYWRIGHT_MODULE. Uses a disposable demo only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { fixtures } = require('./book-fixtures.cjs');
const base = process.env.NBC_PREVIEW_URL;
assert.ok(base && new URL(base).hostname === '127.0.0.1', 'A loopback demo URL is required');
const output = path.resolve('test-results/exam-ux/phase-5');
fs.mkdirSync(output, { recursive: true });

// Chunks that contain the WebGL renderer, found in the production build output.
function threeChunks() {
  const dir = path.resolve('.next/static');
  const found = [];
  const walk = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (
        entry.name.endsWith('.js') &&
        fs.readFileSync(full, 'utf8').includes('WebGLRenderer')
      )
        found.push(entry.name);
    }
  };
  walk(dir);
  return found;
}

const noWebGl = () => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (/webgl/i.test(String(type))) return null;
    return original.call(this, type, ...rest);
  };
};
const recordStates = () => {
  window.__bookStates = [];
  const log = () => {
    const canvas = document.querySelector('.book-3d-canvas');
    const value = canvas && canvas.getAttribute('data-book-state');
    const last = window.__bookStates[window.__bookStates.length - 1];
    if (value && (!last || last[1] !== value)) window.__bookStates.push([performance.now(), value]);
  };
  new MutationObserver(log).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-book-state'],
  });
};

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const chunks = threeChunks();
  assert.ok(chunks.length > 0, 'the build must contain a three chunk (run npm run build first)');
  const { intro, completed, exam } = await fixtures(base, browser);
  const problems = [];
  try {
    let fixture = intro;
    async function open(options = {}, { init = [], viewport = { width: 1280, height: 720 } } = {}) {
      fixture = options.fixture ?? intro;
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: options.scale ?? 1,
        reducedMotion: options.reduced ? 'reduce' : 'no-preference',
        hasTouch: Boolean(options.phone),
        isMobile: Boolean(options.phone),
      });
      const page = await context.newPage();
      const requested = [];
      page.on('request', (request) => requested.push(request.url()));
      page.on('pageerror', (error) => problems.push('pageerror: ' + error.message));
      if (!options.allowConsole)
        page.on('console', (message) => {
          if (message.type() === 'error') problems.push('console: ' + message.text());
        });
      await page.addInitScript(() => (window.__NBC_BOOK_DEBUG__ = true));
      await page.addInitScript(recordStates);
      for (const script of init) await page.addInitScript(script);
      await page.route('**/api/participant**', (route) => route.fulfill({ json: fixture }));
      await page.route('**/api/leaderboard**', (route) => route.fulfill({ json: { entries: [] } }));
      await page.route('**/api/attempt/start', (route) => route.fulfill({ json: exam }));
      return { context, page, requested, setFixture: (value) => (fixture = value) };
    }
    const usedThree = (requested) =>
      requested.filter((url) => chunks.some((name) => url.includes(name)));
    const waitFlatCover = (page) =>
      page.waitForFunction(() => document.querySelector('.book-cover-slot.cover-ready'));
    const waitThree = (page) =>
      page.waitForFunction(() => document.querySelector('.book-3d-active'), null, {
        timeout: 20000,
      });

    // 1. The real book: parts, proportions, colour, anisotropy and side-by-side at 1x and 2x.
    for (const scale of [1, 2]) {
      const { context, page } = await open({ scale });
      await page.goto(base + '/participate');
      await waitThree(page);
      assert.equal(
        await page.locator('.book-3d-canvas').getAttribute('data-book-renderer'),
        'webgl',
      );
      const info = await page.evaluate(() => {
        const scene = window.__nbcBook;
        return {
          parts: Object.keys(scene.parts),
          names: Object.values(scene.parts).map((part) => part.name),
          thickness: scene.thickness,
          anisotropy: scene.anisotropy,
          memory: scene.memory(),
        };
      });
      assert.deepEqual(info.parts, ['cover', 'pages', 'back', 'spine']);
      assert.deepEqual(info.names, ['cover', 'pages', 'back', 'spine']);
      assert.ok(info.thickness >= 0.02 && info.thickness <= 0.03, `thickness ${info.thickness}`);
      assert.ok(info.anisotropy >= 4, `anisotropy ${info.anisotropy}`);
      assert.ok(info.memory.geometries > 0 && info.memory.textures > 0);
      const slot = page.locator('.book-cover-slot');
      // Showcase pose for the side-by-side sheet.
      await page.evaluate(() => window.__nbcBook.renderAt(0, 0));
      const shot = await slot.screenshot();
      fs.writeFileSync(path.join(output, `book-closed-${scale}x.png`), shot);
      // Colour fidelity: a head-on render on black, the lit book against the verified cover.
      await page.evaluate(() => {
        document.querySelector('.book-cover-slot').style.background = '#000';
        window.__nbcBook.renderAt(0, 0, true);
      });
      const frontal = await slot.screenshot();
      fs.writeFileSync(path.join(output, `book-frontal-${scale}x.png`), frontal);
      await page.evaluate(() => {
        document.querySelector('.book-cover-slot').style.background = '';
        window.__nbcBook.renderAt(0, 0);
      });
      const result = await page.evaluate(
        async ([b64, frontalB64]) => {
          const load = (data) =>
            new Promise((resolve, reject) => {
              const element = new Image();
              element.onload = () => resolve(element);
              element.onerror = reject;
              element.src = 'data:image/png;base64,' + data;
            });
          const flat = document.querySelector('.book-cover-slot > canvas:not(.book-3d-canvas)');
          const image = await load(b64);
          const head = await load(frontalB64);
          const pixels = (source) => {
            const canvas = document.createElement('canvas');
            canvas.width = source.width;
            canvas.height = source.height;
            const context = canvas.getContext('2d');
            context.drawImage(source, 0, 0);
            return context.getImageData(0, 0, canvas.width, canvas.height);
          };
          // The book is everything brighter than the black slot, minus a 3px rim.
          const { data, width, height } = pixels(head);
          let x0 = width,
            x1 = 0,
            y0 = height,
            y1 = 0;
          for (let y = 0; y < height - 3; y += 1)
            for (let x = 0; x < width; x += 1) {
              const i = (y * width + x) * 4;
              if (data[i] + data[i + 1] + data[i + 2] > 450) {
                x0 = Math.min(x0, x);
                x1 = Math.max(x1, x);
                y0 = Math.min(y0, y);
                y1 = Math.max(y1, y);
              }
            }
          const rim = 4;
          const total = [0, 0, 0];
          let count = 0;
          for (let y = y0 + rim; y < y1 - rim; y += 2)
            for (let x = x0 + rim; x < x1 - rim; x += 2) {
              const i = (y * width + x) * 4;
              for (let c = 0; c < 3; c += 1) total[c] += data[i + c];
              count += 1;
            }
          const three = total.map((value) => value / count);
          const flatData = pixels(flat);
          const sum = [0, 0, 0];
          for (let i = 0; i < flatData.data.length; i += 16)
            for (let c = 0; c < 3; c += 1) sum[c] += flatData.data[i + c];
          const original = sum.map((value) => value / (flatData.data.length / 16));
          // Side by side: the verified flat cover, then the 3D render at the same height.
          const sheet = document.createElement('canvas');
          const h = image.height;
          const flatWidth = Math.round((flat.width / flat.height) * h);
          sheet.width = flatWidth + image.width + 24;
          sheet.height = h;
          const context = sheet.getContext('2d');
          context.fillStyle = '#f5f1e6';
          context.fillRect(0, 0, sheet.width, sheet.height);
          context.drawImage(flat, 0, 0, flatWidth, h);
          context.drawImage(image, flatWidth + 24, 0);
          return {
            three,
            original,
            aspect: (x1 - x0) / (y1 - y0),
            sheet: sheet.toDataURL('image/png').split(',')[1],
          };
        },
        [shot.toString('base64'), frontal.toString('base64')],
      );
      fs.writeFileSync(
        path.join(output, `cover-vs-3d-${scale}x.png`),
        Buffer.from(result.sheet, 'base64'),
      );
      const coverAspect = await page.evaluate(() => {
        const flat = document.querySelector('.book-cover-slot > canvas:not(.book-3d-canvas)');
        return flat.width / flat.height;
      });
      // The block includes the page edge and spine, so allow a few percent either way.
      assert.ok(
        Math.abs(result.aspect / coverAspect - 1) < 0.05,
        `3D cover proportion ${result.aspect} vs PDF page ${coverAspect}`,
      );
      result.three.forEach((value, index) => {
        const delta = Math.abs(value - result.original[index]);
        console.log(
          `  channel ${index}: 3D ${value.toFixed(0)}, PDF ${result.original[index].toFixed(0)}`,
        );
        assert.ok(delta < 12, `3D cover colour drifted ${delta.toFixed(1)} on channel ${index}`);
      });
      console.log(`PASS real cover texture, parts, proportions, colour fidelity at ${scale}x`);
      await context.close();
    }

    // 2. Explode inspection hook and disposal.
    {
      const { context, page } = await open();
      await page.goto(base + '/participate');
      await waitThree(page);
      const z = () =>
        page.evaluate(() => {
          const { parts } = window.__nbcBook;
          return Object.fromEntries(
            Object.entries(parts).map(([name, part]) => [name, [part.position.x, part.position.z]]),
          );
        });
      await page.evaluate(() => window.__nbcBook.renderAt(0, 0));
      const before = await z();
      await page.evaluate(() => window.__nbcBook.explode(1));
      const after = await z();
      assert.ok(after.back[1] < before.back[1] && after.cover[1] > before.cover[1]);
      assert.ok(after.spine[0] > before.spine[0]);
      await page
        .locator('.book-cover-slot')
        .screenshot({ path: path.join(output, 'book-exploded.png') });
      await page.evaluate(() => window.__nbcBook.explode(0));
      await page.evaluate(() => window.__nbcBook.renderAt(1, 0));
      await page
        .locator('.book-cover-slot')
        .screenshot({ path: path.join(output, 'book-open.png') });
      const live = await page.evaluate(() => window.__nbcBook.memory());
      const disposed = await page.evaluate(() => {
        window.__nbcBook.dispose();
        return window.__nbcBook.memory();
      });
      // All five textures we create (cover, two page-edge, spine, shadow) and every geometry are
      // released; one entry that three's renderer accounts for itself remains.
      assert.equal(disposed.geometries, 0, 'dispose frees geometries');
      assert.ok(disposed.textures <= 1, `dispose frees textures (${disposed.textures} left)`);
      assert.equal(live.textures - disposed.textures, 5, 'five of our textures released');
      console.log('PASS named parts, explode hook, disposal');
      await context.close();
    }

    // 3. Start opens the book (about 650ms) before the exam appears; unmount disposes the scene.
    {
      const { context, page, setFixture } = await open();
      await page.goto(base + '/participate');
      await waitThree(page);
      await page.evaluate(() => window.__nbcBook.renderAt(0, 0));
      const startedAt = Date.now();
      await page.getByRole('button', { name: 'ابدأ المشاركة', exact: false }).click();
      setFixture(exam);
      const question = page.locator('.question-card');
      await question.waitFor({ timeout: 8000 });
      const elapsed = Date.now() - startedAt;
      assert.ok(elapsed >= 600, `exam appeared before the book finished opening (${elapsed}ms)`);
      assert.ok(elapsed < 2500, `Start was delayed too long (${elapsed}ms)`);
      const states = await page.evaluate(() => window.__bookStates.map((entry) => entry[1]));
      assert.ok(states.includes('opening'), 'book opened on Start: ' + states.join());
      assert.equal(await page.locator('.book-3d-canvas').count(), 0, 'no 3D canvas in the exam');
      assert.equal(await page.evaluate(() => window.__nbcBook), undefined, 'scene disposed');
      console.log(`PASS Start opens the book then shows the exam (${elapsed}ms)`);
      await context.close();
    }

    // 4. Reduced motion: no idle frames, open is instant, results show a closed book at once.
    {
      const { context, page, setFixture } = await open({ reduced: true });
      await page.goto(base + '/participate');
      await waitThree(page);
      const frames = await page.evaluate(() => window.__nbcBook.frames);
      await page.waitForTimeout(700);
      assert.equal(await page.evaluate(() => window.__nbcBook.frames), frames, 'no idle motion');
      const startedAt = Date.now();
      await page.getByRole('button', { name: 'ابدأ المشاركة', exact: false }).click();
      setFixture(exam);
      await page.locator('.question-card').waitFor({ timeout: 8000 });
      const elapsed = Date.now() - startedAt;
      assert.ok(elapsed < 600, `reduced motion Start should not wait for animation (${elapsed}ms)`);
      const states = await page.evaluate(() => window.__bookStates.map((entry) => entry[1]));
      assert.ok(!states.includes('opening') && !states.includes('closing'), states.join());
      await context.close();
      const result = await open({ reduced: true, fixture: completed });
      await result.page.goto(base + '/participate');
      await waitThree(result.page);
      await result.page.waitForFunction(
        () =>
          document.querySelector('.book-3d-canvas')?.getAttribute('data-book-state') === 'closed',
      );
      const resultStates = await result.page.evaluate(() => window.__bookStates.map((e) => e[1]));
      assert.ok(!resultStates.includes('closing'), resultStates.join());
      await result.context.close();
      console.log('PASS reduced motion: no idle motion, instant open and close');
    }

    // 5. Result screen: the book is open, then closes in about 800ms, on desktop and phone.
    for (const [label, viewport, phone] of [
      ['desktop', { width: 1280, height: 720 }, false],
      ['phone', { width: 390, height: 844 }, true],
    ]) {
      const { context, page } = await open({ fixture: completed, phone }, { viewport });
      await page.goto(base + '/participate');
      await page.locator('.result-strip').waitFor();
      await waitThree(page);
      await page.waitForFunction(
        () =>
          document.querySelector('.book-3d-canvas')?.getAttribute('data-book-state') === 'closed',
        null,
        { timeout: 6000 },
      );
      const log = await page.evaluate(() => window.__bookStates);
      const closing = log.find((entry) => entry[1] === 'closing');
      const closed = log.find((entry) => entry[1] === 'closed');
      assert.ok(closing && closed, JSON.stringify(log));
      const duration = closed[0] - closing[0];
      assert.ok(duration >= 700 && duration <= 1300, `close took ${duration}ms`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(output, `result-3d-${label}.png`) });
      console.log(`PASS result book closes (${Math.round(duration)}ms) on ${label}`);
      await context.close();
    }

    // 6. Intro screenshots on desktop and phone, pixel ratio cap, off-screen pause.
    {
      const { context, page } = await open(
        { phone: true, scale: 3 },
        { viewport: { width: 390, height: 844 } },
      );
      await page.goto(base + '/participate');
      await waitThree(page);
      await page.waitForTimeout(400);
      const ratio = await page.evaluate(() => {
        const canvas = document.querySelector('.book-3d-canvas');
        return canvas.width / canvas.clientWidth;
      });
      assert.ok(ratio <= 2.02, `pixel ratio capped at 2 (got ${ratio})`);
      await page.screenshot({ path: path.join(output, 'intro-3d-phone.png') });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await context.close();
      const desktop = await open();
      await desktop.page.goto(base + '/participate');
      await waitThree(desktop.page);
      await desktop.page.waitForTimeout(400);
      await desktop.page.screenshot({ path: path.join(output, 'intro-3d-desktop.png') });
      const running = await desktop.page.evaluate(() => window.__nbcBook.frames);
      await desktop.page.waitForTimeout(500);
      assert.ok(
        (await desktop.page.evaluate(() => window.__nbcBook.frames)) > running,
        'idle sway draws',
      );
      await desktop.page.evaluate(() => {
        const spacer = document.createElement('div');
        spacer.style.height = '4000px';
        document.body.append(spacer);
        scrollTo(0, 3000);
      });
      await desktop.page.waitForTimeout(300);
      const paused = await desktop.page.evaluate(() => window.__nbcBook.frames);
      await desktop.page.waitForTimeout(600);
      assert.equal(
        await desktop.page.evaluate(() => window.__nbcBook.frames),
        paused,
        'off-screen pause',
      );
      await desktop.page.evaluate(() => scrollTo(0, 0));
      await desktop.page.waitForTimeout(400);
      assert.ok(
        (await desktop.page.evaluate(() => window.__nbcBook.frames)) > paused,
        'resumes on screen',
      );
      await desktop.context.close();
      console.log('PASS pixel ratio cap, off-screen pause and resume');
    }

    // 7. Fallbacks: no WebGL, low power, and the three chunk failing to load. Start always works.
    const fallbacks = [
      ['WebGL disabled', [noWebGl], false],
      [
        'low power device',
        [() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 })],
        false,
      ],
      ['three chunk blocked', [], true],
    ];
    for (const [label, init, block] of fallbacks) {
      const { context, page, requested, setFixture } = await open(
        { allowConsole: block },
        { init },
      );
      if (block)
        await page.route('**/_next/static/**/*.js', (route) =>
          chunks.some((name) => route.request().url().includes(name))
            ? route.abort()
            : route.continue(),
        );
      await page.goto(base + '/participate');
      await waitFlatCover(page);
      await page.waitForTimeout(1200);
      assert.equal(
        await page.locator('.book-3d-canvas').getAttribute('data-book-renderer'),
        'flat',
      );
      assert.equal(await page.locator('.book-3d-active').count(), 0);
      const flat = page.locator('.book-cover-slot > canvas:not(.book-3d-canvas)');
      assert.equal(await flat.evaluate((canvas) => getComputedStyle(canvas).opacity), '1');
      assert.equal((await flat.boundingBox()).height > 100, true);
      if (label === 'WebGL disabled' || label === 'low power device')
        assert.deepEqual(usedThree(requested), [], 'three is not even downloaded: ' + label);
      await page.screenshot({
        path: path.join(output, `fallback-${label.replaceAll(' ', '-')}.png`),
      });
      await page.getByRole('button', { name: 'ابدأ المشاركة', exact: false }).click();
      setFixture(exam);
      await page.locator('.question-card').waitFor({ timeout: 8000 });
      console.log(`PASS flat cover and working Start: ${label}`);
      await context.close();
    }

    // 8. The exam route does not load three.
    {
      const { context, page, requested } = await open({ fixture: exam });
      await page.goto(base + '/participate');
      await page.locator('.question-card').waitFor({ timeout: 10000 });
      await page.waitForTimeout(1500);
      assert.deepEqual(usedThree(requested), [], 'exam screen must not request three');
      assert.equal(await page.locator('.book-3d-canvas').count(), 0);
      await context.close();
      console.log('PASS exam screen never loads three');
    }
    assert.deepEqual(problems, []);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
