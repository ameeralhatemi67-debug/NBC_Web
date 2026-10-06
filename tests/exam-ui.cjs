const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.NBC_PREVIEW_URL || 'http://127.0.0.1:3000';
const output = path.resolve('test-results/exam');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const errors = [];
  try {
    for (const [width, height, design] of [
      [1366, 768, 'original'],
      [1024, 768, 'official'],
      [1280, 720, 'hybrid'],
      [390, 844, 'original'],
      [320, 740, 'official'],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/admin');
      await page.evaluate((design) => {
        localStorage.setItem('nbc-design', design);
        document.documentElement.dataset.design = design;
      }, design);
      await page.getByRole('button', { name: 'دخول عرض اللجنة', exact: false }).click();
      await page.getByRole('button', { name: 'تجربة الإدارة', exact: false }).click();
      const started = page.waitForResponse((r) => r.url().endsWith('/api/admin/test-run/start'));
      await page.getByRole('button', { name: 'دخول الاختبار', exact: true }).click();
      const state = await (await started).json();
      const bank = await (await page.request.get(base + '/api/admin')).json();
      await page.locator('.exam-preview').waitFor();
      await page.evaluate(() => document.fonts.ready);
      const q = state.attempt.questions[0];
      const original = bank.questions.find((item) => item.id === q.id);
      const correct = q.options.indexOf(original.options[original.correctAnswers[0]]);
      const wrong = (correct + 1) % q.options.length;
      await page.locator('.answer-option').nth(wrong).click();
      await page.getByRole('button', { name: 'ثبّت إجابتي' }).click();
      await page.locator('.answer-feedback.incorrect').waitFor();
      assert.equal(await page.locator('.answer-option.incorrect').count(), 1);
      assert.equal(await page.locator('.answer-option.correct').count(), 1);
      if (design === 'official')
        await page.screenshot({
          path: path.resolve(
            `test-results/exam-ux/phase-2/official-correct-incorrect-${width}.png`,
          ),
        });
      assert.ok(await page.locator('.answer-option input').first().isDisabled());
      const geometry = await page.evaluate(() => ({
        questionBottom: document.querySelector('.question-panel').getBoundingClientRect().bottom,
        horizontal: document.querySelector('.exam-shell').scrollWidth,
        panelScroll: getComputedStyle(document.querySelector('.question-body')).overflowY,
        actionBottom: document.querySelector('.question-footer .primary').getBoundingClientRect()
          .bottom,
      }));
      assert.ok(geometry.horizontal <= width, JSON.stringify({ width, geometry }));
      assert.ok(geometry.questionBottom <= height, JSON.stringify({ width, height, geometry }));
      assert.ok(['auto', 'scroll'].includes(geometry.panelScroll));
      assert.ok(geometry.actionBottom <= height);
      assert.ok(
        await page
          .locator('.answer-option input')
          .first()
          .evaluate(
            (e) =>
              e.getBoundingClientRect().width <= 1 && getComputedStyle(e).clipPath === 'inset(50%)',
          ),
      );
      await page.getByRole('button', { name: 'افتح الصفحة ' + q.pdfPage, exact: true }).click();
      await page.waitForFunction(
        (n) => Number(document.querySelector('.reader-page-controls input').value) === n,
        q.pdfPage,
      );
      await page.locator('.pdf-source-flash').waitFor();
      assert.equal(await page.locator('.pdf-source-flash').count(), 1);
      if (width <= 900)
        await page.getByRole('button', { name: 'العودة إلى السؤال', exact: true }).click();
      if (width <= 900) {
        await page.getByRole('button', { name: 'افتح الكتاب', exact: true }).click();
        assert.equal(await page.locator('.book-panel').getAttribute('aria-modal'), 'true');
        assert.equal(await page.locator('.question-panel').evaluate((e) => e.inert), true);
      }
      await page.waitForFunction(() => document.querySelectorAll('.pdf-page').length === 66);
      await page.waitForFunction(
        () =>
          document.querySelector('.pdf-page canvas') &&
          document.querySelector('.pdf-page').getAttribute('aria-busy') === 'false',
      );
      await page.waitForFunction(() => document.querySelectorAll('.pdf-page canvas').length < 10);
      assert.ok((await page.locator('.pdf-page canvas').count()) < 10);
      assert.equal(await page.locator('.pdf-navigation').count(), 0);
      assert.equal(
        await page.locator('.reader-toolbar input[aria-label="رقم صفحة PDF"]').count(),
        1,
      );
      await page.getByLabel('رقم صفحة PDF', { exact: true }).fill(String(q.pdfPage + 1));
      await page.waitForFunction(
        (n) => Number(document.querySelector('.reader-page-controls input').value) === n,
        q.pdfPage + 1,
      );
      const expectedScroll = await page.locator('.pdf-canvas-container').evaluate((e) => {
        e.scrollTop += 100;
        return e.scrollTop;
      });
      await page.waitForFunction(
        (expected) =>
          Math.abs(document.querySelector('.pdf-canvas-container').scrollTop - expected) < 2,
        expectedScroll,
      );
      if (width <= 900)
        await page.getByRole('button', { name: 'العودة إلى السؤال', exact: true }).click();
      await page.getByRole('button', { name: 'اعرض التلميح', exact: false }).click();
      await page.waitForFunction(() => document.querySelectorAll('.pdf-page').length === 2);
      assert.deepEqual(
        await page
          .locator('.pdf-page')
          .evaluateAll((pages) => pages.map((p) => Number(p.dataset.page))),
        [q.pdfPage - 1, q.pdfPage],
      );
      assert.ok(
        await page.getByRole('button', { name: 'الصفحة التالية', exact: true }).isDisabled(),
      );
      await page.getByRole('button', { name: 'العودة إلى الكتاب كاملًا', exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll('.pdf-page').length === 66);
      if (width <= 900) {
        await page.keyboard.press('Escape');
        await page.locator('.book-panel').waitFor({ state: 'detached' });
        await page.waitForFunction(() => !document.querySelector('.question-panel').inert);
        assert.equal(await page.locator('.question-panel').evaluate((e) => e.inert), false);
      }
      await page.getByRole('button', { name: 'السؤال التالي', exact: false }).click();
      const q2 = state.attempt.questions[1];
      const original2 = bank.questions.find((item) => item.id === q2.id);
      const correct2 = q2.options.indexOf(original2.options[original2.correctAnswers[0]]);
      await page.locator('.answer-option').nth(correct2).click();
      await page.getByRole('button', { name: 'ثبّت إجابتي' }).click();
      await page.locator('.answer-feedback.correct').waitFor();
      if (width > 900) {
        await page.getByLabel('رقم صفحة PDF', { exact: true }).fill(String(q2.pdfPage));
        await page.waitForFunction(
          (n) =>
            document.querySelector('[data-page="' + n + '"]').getAttribute('aria-busy') ===
              'false' && document.querySelector('[data-page="' + n + '"] canvas'),
          q2.pdfPage,
        );
      }
      await page.screenshot({ path: path.join(output, `exam-${width}.png`) });
      await page.getByRole('button', { name: 'خروج من الاختبار', exact: true }).click();
      await page.getByRole('button', { name: 'متابعة التجربة الحالية', exact: true }).click();
      await page.locator('.answer-feedback.correct').waitFor();
      assert.equal(
        await page
          .locator('.question-toolbar')
          .innerText()
          .then((s) => s.includes('السؤال 2')),
        true,
      );
      await page.getByRole('button', { name: 'خروج من الاختبار', exact: true }).click();
      await page.reload();
      await page.getByRole('button', { name: 'تجربة الإدارة', exact: false }).click();
      await page.getByRole('button', { name: 'متابعة التجربة الحالية', exact: true }).click();
      await page.locator('.answer-feedback.correct').waitFor();
      console.log(
        `PASS ${design} ${width}x${height}: feedback, compact layout, continuous book, two-page hint, exit and resume`,
      );
      await page.close();
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
