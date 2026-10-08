const assert = require('node:assert/strict');
const { lockByEnter, lockByClick, lockByTap } = require('./exam-lock.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.NBC_PREVIEW_URL;
assert.equal(new URL(base).hostname, '127.0.0.1');
const output = path.resolve('test-results/exam-ux/phase-3');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const errors = [];
  try {
    for (const design of ['original', 'official', 'hybrid'])
      for (const [width, height] of [
        [320, 740],
        [360, 740],
        [390, 844],
        [430, 932],
      ]) {
        const context = await browser.newContext({
          viewport: { width, height },
          hasTouch: true,
          isMobile: true,
          deviceScaleFactor: 2,
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(e.message));
        await page.addInitScript((design) => localStorage.setItem('nbc-design', design), design);
        assert.equal(
          (
            await context.request.post(base + '/api/auth/demo-staff', {
              data: { role: 'admin' },
              headers: { Origin: base },
            })
          ).status(),
          200,
        );
        await page.goto(base + '/admin');
        await page.getByRole('button', { name: 'تجربة الإدارة', exact: false }).tap();
        const started = page.waitForResponse((r) => r.url().endsWith('/api/admin/test-run/start'));
        await page.getByRole('button', { name: 'دخول الاختبار', exact: true }).tap();
        const state = await (await started).json();
        await page.locator('.phone-book-bar').waitFor();
        assert.ok(
          await page
            .locator('.phone-book-bar')
            .evaluate((e) => e.getBoundingClientRect().height >= 44),
        );
        await page.locator('.phone-book-bar').tap();
        await page.locator('.book-panel').waitFor({ state: 'visible' });
        assert.equal(await page.locator('.book-panel').getAttribute('aria-modal'), 'true');
        assert.ok(await page.locator('.question-panel').evaluate((e) => e.inert));
        await page.waitForFunction(
          () =>
            document.querySelector('.pdf-page canvas') &&
            document.querySelector('.pdf-page').getAttribute('aria-busy') === 'false',
        );
        const reader = page.locator('.book-panel .reader');
        const view = reader.locator('.pdf-canvas-container');
        async function moreAction(name, role = 'menuitemcheckbox') {
          await reader.getByRole('button', { name: 'المزيد', exact: true }).tap();
          await reader.getByRole(role, { name, exact: true }).tap();
        }
        const toolbarCenters = await reader
          .locator('.reader-toolbar > *')
          .evaluateAll((items) =>
            items
              .filter((e) => e.getClientRects().length && e.getBoundingClientRect().height > 0)
              .map((e) => e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2),
          );
        assert.ok(
          Math.max(...toolbarCenters) - Math.min(...toolbarCenters) <= 1,
          'phone toolbar must fit one row',
        );
        assert.ok((await reader.locator('.reader-toolbar').boundingBox()).height <= 56);
        assert.ok(
          (await reader.getByRole('button', { name: 'المزيد', exact: true }).boundingBox())
            .height >= 44,
        );
        await reader.getByRole('button', { name: 'المزيد', exact: true }).tap();
        const moreMenu = reader.getByRole('menu', { name: 'المزيد', exact: true });
        for (const label of [
          'المحتويات',
          'وضع القراءة الليلي',
          'صفحة بصفحة',
          'فتح الكتاب الكامل في نافذة جديدة',
        ])
          assert.ok((await moreMenu.innerText()).includes(label));
        await moreMenu.getByRole('menuitem', { name: 'المحتويات', exact: true }).focus();
        await page.keyboard.press('Escape');
        assert.ok(
          await page.locator('.book-panel').isVisible(),
          'Escape from More must keep the reader open',
        );
        assert.equal(await reader.locator('input[type=search],[role=searchbox]').count(), 0);
        assert.equal(await reader.getByLabel('رقم صفحة PDF', { exact: true }).inputValue(), '1');
        assert.ok(
          await reader
            .locator('.pdf-page')
            .first()
            .evaluate((e) => e.getBoundingClientRect().width <= innerWidth),
        );
        await moreAction('المحتويات', 'menuitem');
        await reader.getByRole('menuitem', { name: /المطلب الأول/ }).tap();
        assert.equal(await reader.getByLabel('رقم صفحة PDF', { exact: true }).inputValue(), '13');
        await moreAction('المحتويات', 'menuitem');
        await reader.locator('summary').getByText('صفحات أخرى').tap();
        await reader.getByRole('menuitem', { name: 'صفحة PDF 10', exact: true }).tap();
        await page.waitForFunction(
          () => document.querySelector('.reader-page-controls input').value === '10',
        );
        await page.waitForFunction(
          () =>
            document.querySelector('[data-page="10"] canvas') &&
            document.querySelector('[data-page="10"]').getAttribute('aria-busy') === 'false',
        );
        await page.screenshot({ path: path.join(output, `reader-${design}-${width}.png`) });
        assert.ok(
          await page
            .locator('.question-dock')
            .evaluate((e) => e.getBoundingClientRect().height <= 56),
        );
        await page.locator('.question-dock').tap();
        await page.locator('.question-dock-sheet').waitFor();
        const sheet = page.locator('.question-dock-sheet');
        await sheet.locator('.answer-option').first().tap();
        await page.waitForFunction(
          () => !document.querySelector('.question-dock-sheet .question-footer .primary').disabled,
        );
        await lockByTap(sheet.getByRole('button', { name: /^ثبّت/ }), page);
        await sheet.locator('.answer-feedback.correct,.answer-feedback.incorrect').waitFor();
        for (const [status, text, background] of [
          ['correct', 'rgb(37, 96, 68)', 'rgb(232, 244, 236)'],
          ['incorrect', 'rgb(154, 51, 40)', 'rgb(252, 235, 231)'],
        ]) {
          const rows = sheet.locator(`.answer-option.${status}`);
          // The class arrives with server feedback; sample the settled paint,
          // including the near-instant reduced-motion colour transition.
          await page.waitForFunction(
            ({ status, text, background }) =>
              Array.from(
                document.querySelectorAll(`.question-dock-sheet .answer-option.${status}`),
              ).every((row) => {
                const style = getComputedStyle(row);
                return style.color === text && style.backgroundColor === background;
              }),
            { status, text, background },
          );
          for (const row of await rows.all()) {
            assert.deepEqual(
              await row.evaluate((e) => [
                getComputedStyle(e).color,
                getComputedStyle(e).backgroundColor,
              ]),
              [text, background],
            );
          }
        }
        assert.ok(
          await sheet.locator('h2').evaluate((e) => parseFloat(getComputedStyle(e).fontSize) <= 24),
        );
        assert.ok(await sheet.locator('input').first().isDisabled());
        const sticky = await sheet.locator('.question-footer .primary').boundingBox();
        assert.ok(sticky.y + sticky.height <= height);
        await page.screenshot({ path: path.join(output, `dock-${design}-${width}.png`) });
        await page.locator('.question-dock').tap();
        await sheet.waitFor({ state: 'detached' });
        const cdp = await context.newCDPSession(page);
        const bounds = await view.boundingBox();
        const cx = Math.floor(width / 2),
          cy = Math.floor(Math.min(bounds.y + bounds.height / 2, height - 100));
        async function touch(type, points) {
          await cdp.send('Input.dispatchTouchEvent', {
            type,
            touchPoints: points.map(([x, y], id) => ({
              x,
              y,
              id,
              radiusX: 5,
              radiusY: 5,
              force: 1,
            })),
          });
        }
        await touch('touchStart', [
          [cx - 30, cy],
          [cx + 30, cy],
        ]);
        await touch('touchMove', [
          [cx - 60, cy],
          [cx + 60, cy],
        ]);
        await touch('touchEnd', []);
        await page.waitForFunction(
          () => document.querySelector('.reader-zoom-controls bdi').textContent === '200%',
        );
        await page.waitForFunction(() => {
          const c = document.querySelector('[data-page="10"] canvas');
          return (
            c &&
            c.width >=
              document.querySelector('[data-page="10"]').getBoundingClientRect().width * 1.9
          );
        });
        assert.ok(
          await reader
            .locator('canvas')
            .evaluateAll((canvases) => canvases.every((c) => c.width * c.height <= 16000000)),
        );
        await page.screenshot({ path: path.join(output, `zoom-${design}-${width}.png`) });
        const before = await view.evaluate((e) => ({ top: e.scrollTop, left: e.scrollLeft }));
        await touch('touchStart', [[cx, cy]]);
        await touch('touchMove', [[cx - 70, cy - 90]]);
        await touch('touchEnd', []);
        const after = await view.evaluate((e) => ({ top: e.scrollTop, left: e.scrollLeft }));
        assert.ok(after.top > before.top && after.left > before.left);
        await reader.locator('.reader-toolbar').waitFor();
        await page.waitForFunction(
          () =>
            document.querySelector('.book-panel .reader-toolbar').getAttribute('aria-hidden') ===
            'true',
        );
        await touch('touchStart', [[cx, cy]]);
        await touch('touchEnd', []);
        await reader.getByRole('button', { name: 'خيارات التكبير', exact: true }).tap();
        await reader.getByRole('button', { name: 'تكبير الصفحة', exact: true }).tap();
        await page.waitForFunction(
          () => document.querySelector('.reader-zoom-controls bdi').textContent === '225%',
        );
        await reader.getByRole('button', { name: 'تصغير الصفحة', exact: true }).tap();
        await page.waitForFunction(
          () => document.querySelector('.reader-zoom-controls bdi').textContent === '200%',
        );
        // Native touch double tap toggles back to width fit.
        await touch('touchStart', [[cx, cy]]);
        await touch('touchEnd', []);
        await touch('touchStart', [[cx, cy]]);
        await touch('touchEnd', []);
        await page.waitForFunction(
          () => document.querySelector('.reader-zoom-controls bdi').textContent === '100%',
        );
        await moreAction('القراءة الليلية');
        assert.equal(
          await reader.getAttribute('class').then((s) => s.includes('night-reader')),
          true,
        );
        assert.equal(
          await reader
            .locator('.pdf-page:not([data-page="1"]) canvas')
            .first()
            .evaluate((e) => getComputedStyle(e).filter),
          'invert(0.9) hue-rotate(180deg)',
        );
        await reader.getByLabel('رقم صفحة PDF', { exact: true }).fill('10');
        await moreAction('صفحة بصفحة');
        await page.waitForFunction(() => document.querySelectorAll('.pdf-page').length === 1);
        const initial = Number(
          await reader.getByLabel('رقم صفحة PDF', { exact: true }).inputValue(),
        );
        await touch('touchStart', [[cx - 60, cy]]);
        await touch('touchMove', [[cx + 60, cy]]);
        await touch('touchEnd', []);
        await page.waitForFunction(
          (n) => Number(document.querySelector('.reader-page-controls input').value) === n,
          initial + 1,
        );
        await touch('touchStart', [[cx, cy]]);
        await touch('touchEnd', []);
        await moreAction('صفحة بصفحة');
        await page.waitForFunction(() => document.querySelectorAll('.pdf-page').length === 66);
        await reader.getByLabel('رقم صفحة PDF', { exact: true }).fill('10');
        await page.setViewportSize({ width: 844, height: 390 });
        await page.waitForFunction(
          () => document.querySelector('.book-panel').getAttribute('role') === 'region',
        );
        assert.equal(await reader.getByLabel('رقم صفحة PDF', { exact: true }).inputValue(), '10');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.setViewportSize({ width, height });
        await page.waitForFunction(
          () => document.querySelector('.book-panel').getAttribute('role') === 'dialog',
        );
        await touch('touchStart', [[cx, cy]]);
        await touch('touchEnd', []);
        await reader.getByRole('button', { name: 'العودة إلى السؤال', exact: true }).waitFor();
        await reader
          .getByLabel('رقم صفحة PDF', { exact: true })
          .fill(String(state.attempt.questions[0].pdfPage + 1));
        assert.equal(
          await reader.locator('input').inputValue(),
          String(state.attempt.questions[0].pdfPage + 1),
        );
        await touch('touchStart', [[cx, cy]]);
        await touch('touchEnd', []);
        await reader.getByRole('button', { name: 'العودة إلى السؤال', exact: true }).tap();
        await page.locator('.book-panel').waitFor({ state: 'hidden' });
        assert.equal(await page.locator('.question-panel').evaluate((e) => e.inert), false);
        await page.getByRole('button', { name: 'اعرض التلميح', exact: true }).tap();
        await page.waitForFunction(() => document.querySelectorAll('.pdf-page').length === 2);
        assert.deepEqual(
          await reader
            .locator('.pdf-page')
            .evaluateAll((pages) => pages.map((p) => Number(p.dataset.page))),
          [state.attempt.questions[0].pdfPage - 1, state.attempt.questions[0].pdfPage],
        );
        await reader.getByRole('button', { name: 'العودة إلى الكتاب كاملًا', exact: true }).tap();
        await page.waitForFunction(() => document.querySelectorAll('.pdf-page').length === 66);
        const position = await view.evaluate((e) => e.scrollTop);
        await touch('touchStart', [[cx, cy]]);
        await touch('touchEnd', []);
        await reader.getByRole('button', { name: 'العودة إلى السؤال', exact: true }).tap();
        await page.locator('.book-panel').waitFor({ state: 'hidden' });
        await page.locator('.phone-book-bar').tap();
        await page.locator('.book-panel').waitFor({ state: 'visible' });
        assert.ok(Math.abs((await view.evaluate((e) => e.scrollTop)) - position) < 4);
        await page.goBack();
        await page.locator('.book-panel').waitFor({ state: 'hidden' });
        await page.waitForFunction(() => document.activeElement?.matches('.phone-book-bar'));
        await page.locator('.phone-book-bar').tap();
        await page.locator('.book-panel').waitFor({ state: 'visible' });
        const dock = page.locator('.question-dock');
        await dock.focus();
        await page.keyboard.press('Tab');
        assert.ok(
          await page.locator('.book-panel').evaluate((e) => e.contains(document.activeElement)),
        );
        await page.keyboard.press('Escape');
        await page.locator('.book-panel').waitFor({ state: 'hidden' });
        await page.waitForFunction(() => document.activeElement?.matches('.phone-book-bar'));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: path.join(output, `question-${design}-${width}.png`) });
        console.log(
          `PASS touch ${design} ${width}x${height}: book, outline fallback, dock answer, pinch/raster cap, pan, header, buttons/double tap, night, page swipe, orientation, hint, restore, hardware back`,
        );
        await context.close();
      }
    for (const design of ['original', 'official', 'hybrid']) {
      const context = await browser.newContext({
        viewport: { width: 1024, height: 768 },
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript((design) => localStorage.setItem('nbc-design', design), design);
      await context.request.post(base + '/api/auth/demo-staff', {
        data: { role: 'admin' },
        headers: { Origin: base },
      });
      await page.goto(base + '/admin');
      await page.getByRole('button', { name: 'تجربة الإدارة', exact: false }).click();
      await page.getByRole('button', { name: 'دخول الاختبار', exact: true }).click();
      const reader = page.locator('.book-panel .reader');
      await page.waitForFunction(
        () =>
          document.querySelector('.pdf-page canvas') &&
          document.querySelector('.pdf-page').getAttribute('aria-busy') === 'false',
      );
      const tops = await reader
        .locator('.reader-toolbar > *')
        .evaluateAll((items) => items.map((e) => e.getBoundingClientRect().y));
      assert.ok(Math.max(...tops) - Math.min(...tops) <= 1, 'desktop toolbar must fit one row');
      await reader.getByLabel('رقم صفحة PDF', { exact: true }).fill('12');
      await reader.getByRole('button', { name: 'الصفحة التالية', exact: true }).click();
      assert.equal(await reader.locator('input').inputValue(), '13');
      await reader.getByRole('button', { name: 'الصفحة السابقة', exact: true }).click();
      assert.equal(await reader.locator('input').inputValue(), '12');
      const zoomButtons = await reader.locator('.reader-zoom-controls button').allTextContents();
      assert.deepEqual(zoomButtons, ['−', '+']);
      await reader.getByRole('button', { name: 'المحتويات', exact: true }).click();
      await page.keyboard.press('ArrowDown');
      assert.ok(
        await reader.locator('[role=menu]').evaluate((e) => e.contains(document.activeElement)),
      );
      await page.keyboard.press('Escape');
      assert.equal(
        await reader
          .getByRole('button', { name: 'المحتويات', exact: true })
          .evaluate((e) => e === document.activeElement),
        true,
      );
      assert.ok(await reader.locator('a[target=_blank]').getAttribute('title'));
      assert.equal(await reader.locator('input[type=search],[role=searchbox]').count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.waitForFunction(
        () =>
          document.querySelector('[data-page="12"] canvas') &&
          document.querySelector('[data-page="12"]').getAttribute('aria-busy') === 'false',
      );
      await page.screenshot({ path: path.join(output, `reader-${design}-1024.png`) });
      await page.goto(base + '/book');
      const standalone = page.locator('.reader');
      await page.waitForFunction(() => document.querySelector('.pdf-page canvas'));
      assert.equal(await standalone.locator('input').inputValue(), '12');
      await standalone.getByRole('button', { name: 'القراءة الليلية', exact: true }).click();
      await standalone.getByRole('button', { name: 'صفحة بصفحة', exact: true }).click();
      await page.reload();
      await page.waitForFunction(
        () =>
          document.querySelectorAll('.pdf-page').length === 1 &&
          document.querySelector('.pdf-page canvas'),
      );
      assert.equal(await standalone.locator('input').inputValue(), '12');
      assert.equal(
        await standalone
          .getByRole('button', { name: 'القراءة الليلية', exact: true })
          .getAttribute('aria-pressed'),
        'true',
      );
      assert.equal(
        await standalone
          .getByRole('button', { name: 'صفحة بصفحة', exact: true })
          .getAttribute('aria-pressed'),
        'true',
      );
      await standalone.getByRole('button', { name: 'صفحة بصفحة', exact: true }).click();
      await standalone.locator('input').fill('1');
      await page.waitForFunction(
        () =>
          document.querySelector('[data-page="1"] canvas') &&
          document.querySelector('[data-page="1"]').getAttribute('aria-busy') === 'false',
      );
      assert.equal(
        await standalone
          .locator('[data-page="1"] canvas')
          .evaluate((e) => getComputedStyle(e).filter),
        'brightness(0.65)',
      );
      console.log(
        `PASS desktop ${design} 1024: single toolbar, page stepper/input, LTR zoom, contents keyboard, no search, restore/night/page-mode persistence, dimmed cover`,
      );
      await context.close();
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
