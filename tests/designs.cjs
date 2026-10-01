const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.NBC_PREVIEW_URL || 'http://127.0.0.1:3000';
const output = path.resolve('test-results/designs');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      if (message.location().url.endsWith('/api/participant') && message.text().includes('401'))
        return;
      errors.push(message.text());
    });
    const results = [];
    await page.goto(base);
    await page.getByRole('button', { name: 'تغيير التصميم', exact: true }).waitFor();
    for (const design of ['original', 'official', 'hybrid']) {
      assert.equal(await page.locator('html').getAttribute('data-design'), design);
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
        for (const route of [
          '/',
          '/register',
          '/register?mode=login',
          '/book',
          '/terms',
          '/participate',
          '/admin',
        ]) {
          await page.goto(base + route);
          await page.locator('.design-toggle').waitFor();
          await page.evaluate(() => document.fonts.ready);
          for (const image of await page.locator('img:visible').all()) {
            await image.scrollIntoViewIfNeeded();
            await image.evaluate((image) => image.decode().catch(() => {}));
          }
          await page.evaluate(() => scrollTo(0, 0));
          const state = await page.evaluate(() => ({
            design: document.documentElement.dataset.design,
            width: document.documentElement.scrollWidth,
            images: [...document.images]
              .filter(
                (image) =>
                  getComputedStyle(image).display !== 'none' &&
                  (!image.complete || !image.naturalWidth),
              )
              .map((image) => image.src),
            overflow: [...document.querySelectorAll('h1,h2,h3,.button,.org-role,.header-inner')]
              .filter(
                (element) =>
                  element.getClientRects().length && element.scrollWidth > element.clientWidth + 2,
              )
              .map((element) => element.className + ': ' + element.textContent.trim()),
            background: getComputedStyle(document.body).backgroundColor,
          }));
          assert.equal(state.design, design, route);
          assert.ok(state.width <= width + 1, JSON.stringify({ design, width, route, state }));
          assert.deepEqual(state.images, [], route);
          assert.deepEqual(state.overflow, [], JSON.stringify({ design, width, route, state }));
          if (design !== 'original') assert.equal(state.background, 'rgb(255, 255, 255)');
          if (route === '/register') {
            assert.equal(await page.getByLabel('رقم الجوال', { exact: true }).count(), 1);
            assert.equal(await page.getByLabel('أسم المدرسة/الجامعة', { exact: true }).count(), 1);
            assert.deepEqual(
              await page.locator('select[name="gender"] option:not([value=""])').allTextContents(),
              ['ذكر', 'أنثى'],
            );
            assert.deepEqual(
              await page
                .locator('select[name="locality"] option:not([value=""])')
                .allTextContents(),
              ['الدمام', 'الخبر', 'الظهران', 'الجبيل', 'القطيف', 'الهفوف'],
            );
            assert.equal(
              await page.locator('[name="region"],[name="village"],[name="backup"]').count(),
              0,
            );
          }
          if (route === '/') {
            assert.deepEqual(await page.locator('.org-role').allTextContents(), [
              'الجهة المساندة',
              'الجهة المنفذة',
              'الجهة الراعية',
            ]);
            if (width === 1440) {
              const boxes = await page
                .locator('.org-logo-item')
                .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().x));
              assert.ok(
                boxes[0] > boxes[1] && boxes[1] > boxes[2],
                'Roles must follow right/middle/left order',
              );
            }
          }
          if (
            [390, 1440].includes(width) &&
            ['/', '/register', '/book', '/admin'].includes(route)
          ) {
            await page.screenshot({
              path: path.join(
                output,
                `${design}-${route === '/' ? 'home' : route.slice(1)}-${width}.png`,
              ),
              fullPage: true,
            });
            if (route === '/')
              await page.screenshot({
                path: path.join(output, `${design}-first-screen-${width}.png`),
              });
          }
          results.push({ design, width, route });
        }
      }
      await page.goto(base);
      await page.locator('.design-toggle').click();
    }
    assert.equal(
      await page.locator('html').getAttribute('data-design'),
      'original',
      'Three clicks must restore the original',
    );
    await page.evaluate(() => localStorage.setItem('nbc-design', 'invalid'));
    await page.reload();
    assert.equal(
      await page.locator('html').getAttribute('data-design'),
      'original',
      'Invalid saved designs must fall back',
    );
    assert.deepEqual(errors, [], 'No browser or hydration errors');
    fs.writeFileSync(
      path.join(output, 'verification.json'),
      JSON.stringify({ passed: true, results }, null, 2),
    );
    console.log(
      `${results.length} design/page/viewport checks passed, including persistence, fields, and organization order.`,
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
