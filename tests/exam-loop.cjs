const assert = require('node:assert/strict');
const { lockByEnter, lockByClick, lockByTap } = require('./exam-lock.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.NBC_PREVIEW_URL;
assert.equal(new URL(base).hostname, '127.0.0.1');
const output = path.resolve('test-results/exam-ux/phase-2');
fs.mkdirSync(output, { recursive: true });
const sizes = [
  [1366, 768],
  [1280, 720],
  [1024, 768],
  [430, 932],
  [390, 844],
  [360, 740],
  [320, 740],
];
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const errors = [];
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    assert.equal(
      (
        await context.request.post(base + '/api/auth/demo-staff', {
          data: { role: 'admin' },
          headers: { Origin: base },
        })
      ).status(),
      200,
    );
    async function start(design, width, height, offline = false) {
      const page = await context.newPage();
      await page.setViewportSize({ width, height });
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript((design) => localStorage.setItem('nbc-design', design), design);
      await page.goto(base + '/admin');
      await page.getByRole('button', { name: 'تجربة الإدارة', exact: false }).click();
      await page.getByRole('checkbox', { name: 'محاكاة انقطاع المزامنة' }).setChecked(offline);
      await page.getByRole('button', { name: 'دخول الاختبار', exact: true }).click();
      await page.locator('.exam-shell').waitFor();
      return page;
    }
    for (const design of ['original', 'official', 'hybrid'])
      for (const [width, height] of process.argv.includes('--flows') ? [] : sizes) {
        const page = await start(design, width, height);
        const hint = page.getByRole('button', { name: 'التلميح', exact: true });
        assert.ok(await hint.isDisabled());
        assert.ok(await hint.getAttribute('aria-describedby'));
        assert.equal(await page.locator('.source-page-chip').count(), 0);
        assert.equal(
          await page.getByRole('button', { name: 'راجع وأرسل', exact: true }).count(),
          0,
        );
        assert.equal(await page.locator('.exam-dialog[open]').count(), 0);
        assert.ok(
          await page
            .locator('.answer-option input')
            .first()
            .evaluate(
              (e) =>
                e.getBoundingClientRect().width === 1 &&
                getComputedStyle(e).clipPath === 'inset(50%)',
            ),
        );
        assert.ok(
          await page
            .locator('.answer-option')
            .first()
            .evaluate((e) => e.getBoundingClientRect().height >= 52),
        );
        await page.keyboard.press('1');
        await page.waitForFunction(() => document.querySelector('.answer-option input').checked);
        await page.waitForFunction(
          () => !document.querySelector('.question-footer .primary').disabled,
        );
        await page.locator('.answer-option input').first().focus();
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => !document.querySelector('.answer-option input').checked);
        assert.ok((await page.locator('.question-toolbar').textContent()).includes('السؤال 1 من'));
        await page.waitForFunction(
          () => !document.querySelector('.question-footer .primary').disabled,
        );
        await page.locator('.question-body h2').focus();
        await lockByEnter(page);
        await page.locator('.answer-feedback.correct,.answer-feedback.incorrect').waitFor();
        assert.equal(
          await page
            .locator(
              '.competition-heading .question-segment.correct,.competition-heading .question-segment.incorrect',
            )
            .count(),
          1,
        );
        assert.equal(await page.locator('.source-page-chip').count(), 1);
        assert.ok(await page.locator('.answer-option input').first().isDisabled());
        await page.keyboard.press('ArrowLeft');
        await page.waitForFunction(() =>
          document.querySelector('.question-toolbar').textContent.includes('السؤال 2'),
        );
        assert.equal(
          await page.locator('.question-body').evaluate((e) => getComputedStyle(e).animationName),
          'none',
        );
        await page.waitForFunction(
          () => document.activeElement === document.querySelector('.question-body h2'),
        );
        assert.equal(
          await page
            .locator('.question-body h2')
            .first()
            .evaluate((e) => document.activeElement === e),
          true,
        );
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() =>
          document.querySelector('.question-toolbar').textContent.includes('السؤال 1'),
        );
        if (width <= 430) {
          await page.getByRole('button', { name: 'افتح خريطة الأسئلة', exact: true }).click();
          const map = page.getByRole('dialog', { name: 'انتقل إلى سؤال', exact: true });
          await map.waitFor();
          assert.equal(await map.locator('.question-segment').count(), 20);
          await page.keyboard.press('Escape');
          await map.waitFor({ state: 'hidden' });
          assert.equal(
            await page
              .getByRole('button', { name: 'افتح خريطة الأسئلة', exact: true })
              .evaluate((e) => document.activeElement === e),
            true,
          );
        }
        assert.ok(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth <= innerWidth &&
              document.querySelector('.exam-shell').scrollWidth <= innerWidth,
          ),
        );
        const footer = await page.locator('.question-footer .primary').boundingBox();
        assert.ok(footer.y >= 0 && footer.y + footer.height <= height);
        assert.ok(await page.locator('.save-status svg').count());
        await page.screenshot({ path: path.join(output, `loop-${design}-${width}.png`) });
        const status = await page.locator('.answer-option.correct').evaluate((e) => ({
          color: getComputedStyle(e).color,
          background: getComputedStyle(e).backgroundColor,
        }));
        assert.deepEqual(status, { color: 'rgb(37, 96, 68)', background: 'rgb(232, 244, 236)' });
        if (width <= 390) {
          assert.ok(
            (
              await page
                .locator('.ticks .question-segment')
                .evaluateAll((cells) => cells.map((cell) => cell.textContent))
            ).every((text) => text === ''),
          );
          assert.equal(await page.locator('.strip-position bdi').textContent(), '1 / 20');
        }
        console.log(
          `PASS ${design} ${width}x${height}: semantics, lock, strip, keyboard, hint gate, focus, sticky action, RTL`,
        );
        await page.close();
      }
    for (const offline of [false, true]) {
      const page = await start('hybrid', offline ? 390 : 1366, offline ? 844 : 768, offline);
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('1');
        await page.waitForFunction(() => document.querySelector('.answer-option input').checked);
        await page.waitForFunction(
          () => !document.querySelector('.question-footer .primary').disabled,
        );
        await lockByEnter(page);
        await page.locator('.answer-feedback strong').waitFor();
        if (i < 19) {
          await page.locator('.question-footer .primary').click();
          await page.waitForFunction(
            (n) =>
              document.querySelector('.question-toolbar').textContent.includes(`السؤال ${n} من`),
            i + 2,
          );
        }
      }
      const review = page.getByRole('dialog', { name: 'راجع إجاباتك قبل الإرسال', exact: true });
      // The last result stays on screen; the student opens the review from the primary action.
      await page.getByRole('button', { name: 'راجع وأرسل', exact: true }).click();
      await review.waitFor();
      const primary = review.getByRole('button', { name: 'أرسل مشاركتي', exact: true });
      await primary.waitFor();
      await page.waitForFunction(() => document.activeElement?.textContent === 'أرسل مشاركتي');
      assert.equal(await review.locator('.review-counts bdi').getAttribute('dir'), 'ltr');
      assert.equal(await review.locator('.review-counts bdi').textContent(), '20 / 20');
      if (!offline)
        await page.waitForFunction(
          () =>
            document
              .querySelector('.exam-dialog[open]')
              .querySelectorAll('.question-segment.pending').length === 0,
        );
      assert.equal(await review.locator('.question-segment.pending').count(), offline ? 20 : 0);
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('Tab');
        assert.ok(await review.evaluate((e) => e.contains(document.activeElement)));
      }
      await page.keyboard.press('Escape');
      await review.waitFor({ state: 'hidden' });
      assert.equal(
        await page
          .locator('.question-footer .primary')
          .evaluate((e) => document.activeElement === e),
        true,
      );
      await page.getByRole('button', { name: 'راجع وأرسل', exact: true }).click();
      await review.getByRole('button', { name: 'سأراجع أولًا', exact: true }).click();
      await review.waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'راجع وأرسل', exact: true }).click();
      await review.getByRole('button', { name: /السؤال 1،/, exact: false }).click();
      await review.waitFor({ state: 'hidden' });
      await page.waitForFunction(() =>
        document.querySelector('.question-toolbar').textContent.includes('السؤال 1 من'),
      );
      if (offline) {
        await page.getByRole('button', { name: 'افتح خريطة الأسئلة', exact: true }).click();
        await page
          .getByRole('dialog', { name: 'انتقل إلى سؤال', exact: true })
          .getByRole('button', { name: /السؤال 20،/ })
          .click();
      } else
        await page
          .locator('.competition-heading')
          .getByRole('button', { name: /السؤال 20،/ })
          .click();
      await page.getByRole('button', { name: 'راجع وأرسل', exact: true }).click();
      const action = await primary.boundingBox();
      assert.ok(action.y + action.height <= (offline ? 844 : 768));
      await primary.click();
      if (offline) {
        await page.getByText('المشاركة بانتظار الإرسال', { exact: true }).waitFor();
        assert.equal(await page.locator('.source-page-chip').count(), 0);
        await page.getByRole('button', { name: 'خروج من الاختبار', exact: true }).click();
        await page.getByRole('checkbox', { name: 'محاكاة انقطاع المزامنة' }).uncheck();
        await page.getByRole('button', { name: 'متابعة التجربة الحالية', exact: true }).click();
      }
      await page.getByRole('heading', { name: 'تم استلام مشاركتك', exact: true }).waitFor();
      console.log(
        `PASS ${offline ? 'offline queued' : 'online'} 20-lock review: open from the primary action, trap, Escape, cancel, jump, restore, submit${offline ? ', reconnect' : ''}`,
      );
      await page.close();
    }
    // A presentation-only legacy fixture exercises long text and multiple selections.
    // SELECT responses carry only the student's choices, never correctness.
    const started = await context.request.post(base + '/api/admin/test-run/start', {
      data: { stage: 'middle', reveal: true, synthetic: true },
      headers: { Origin: base },
    });
    assert.equal(started.status(), 200);
    const legacy = await started.json();
    const question = legacy.attempt.questions[0];
    question.type = 'multi_select';
    question.title = 'سؤال طويل لاختبار القراءة والإجابة من دون اختفاء إجراء التثبيت. '.repeat(14);
    question.options = question.options.map((option) => (option + ' ').repeat(8));
    question.options.push('الخيار الخامس', 'الخيار السادس');
    question.pdfPage = legacy.book.pageCount;
    const long = await context.newPage();
    await long.setViewportSize({ width: 320, height: 740 });
    long.on('pageerror', (error) => errors.push(error.message));
    await long.route('**/api/participant**', (route) => route.fulfill({ json: legacy }));
    await long.route('**/api/attempt/event', (route) => {
      const event = route.request().postDataJSON();
      assert.equal(event.kind, 'SELECT');
      legacy.attempt.answers[event.questionId] = {
        selected: event.selected,
        locked: false,
        checkedAt: null,
      };
      legacy.attempt.revision++;
      return route.fulfill({ json: legacy });
    });
    await long.goto(base + '/participate');
    await long
      .locator('.answer-instruction')
      .filter({ hasText: 'حدد كل الإجابات الصحيحة' })
      .waitFor();
    assert.equal(await long.locator('.answer-option input[type=checkbox]').count(), 6);
    assert.equal(await long.locator('.answer-option input[type=radio]').count(), 0);
    assert.ok(
      await long.locator('.question-body').evaluate((e) => e.scrollHeight > e.clientHeight),
    );
    const sticky = await long.locator('.question-footer .primary').boundingBox();
    assert.ok(sticky.y + sticky.height <= 740);
    for (const key of ['1', '2', '1']) {
      await long.keyboard.press(key);
      await long.waitForFunction(
        () => !document.querySelector('.question-footer .primary').disabled,
      );
      await long.getByText('محفوظ', { exact: true }).waitFor();
    }
    assert.equal(await long.locator('.answer-option input:checked').count(), 1);
    for (const key of ['5', '6']) {
      await long.keyboard.press(key);
      await long.waitForFunction(
        (n) => document.querySelectorAll('.answer-option input')[n - 1].checked,
        Number(key),
      );
      await long.waitForFunction(
        () => !document.querySelector('.question-footer .primary').disabled,
      );
    }
    await long.keyboard.press('7');
    assert.equal(await long.locator('.answer-option input:checked').count(), 3);
    await long.locator('.answer-option input').nth(4).focus();
    await long.keyboard.press('ArrowLeft');
    assert.ok((await long.locator('.question-toolbar').textContent()).includes('السؤال 1 من'));
    await long.getByRole('button', { name: 'افتح الكتاب', exact: true }).click();
    const pageInput = long.getByLabel('رقم صفحة PDF', { exact: true });
    await pageInput.waitFor();
    await pageInput.fill(String(legacy.book.pageCount));
    await pageInput.press('ArrowLeft');
    assert.ok((await long.locator('.question-toolbar').textContent()).includes('السؤال 1 من'));
    await long.getByRole('button', { name: 'العودة إلى السؤال', exact: true }).click();
    await long.getByRole('button', { name: 'اعرض التلميح', exact: true }).click();
    await long.waitForFunction(() => document.querySelectorAll('.pdf-page').length === 2);
    assert.deepEqual(
      await long
        .locator('.pdf-page')
        .evaluateAll((pages) => pages.map((p) => Number(p.dataset.page))),
      [65, 66],
    );
    await long.getByRole('button', { name: 'العودة إلى الكتاب كاملًا', exact: true }).click();
    await long.waitForFunction(() => document.querySelectorAll('.pdf-page').length === 66);
    await long.waitForFunction(() => document.activeElement?.matches('.pdf-canvas-container'));
    await long.keyboard.press('Escape');
    await long.locator('.book-panel').waitFor({ state: 'hidden' });
    assert.equal(await long.locator('.source-page-chip').count(), 0);
    assert.ok(await long.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log(
      'PASS long multi-select: sticky action, keyboard toggles, typing guard, legacy last-page hint, full-book action, Escape closes phone reader, no early source chip',
    );
    await long.close();
    assert.deepEqual(errors, []);
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
