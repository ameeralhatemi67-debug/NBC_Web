const assert = require('node:assert/strict');
const { lockByEnter, lockByClick, lockByTap } = require('./exam-lock.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.NBC_PREVIEW_URL;
assert.ok(
  base && new URL(base).hostname === '127.0.0.1',
  'An explicit loopback demo URL is required',
);
const output = path.resolve('test-results/exam-ux/phase-1');
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
const labels = {
  DRAFT: 'المسابقة لم تفتح بعد',
  SCHEDULED: 'المسابقة لم تفتح بعد',
  OPEN: 'المسابقة مفتوحة الآن',
  CLOSED: 'أُغلقت المسابقة',
  RESULTS_PUBLISHED: 'أُعلنت النتائج',
};

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const errors = [];
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const auth = await context.request.post(base + '/api/auth/demo-staff', {
      data: { role: 'admin' },
      headers: { Origin: base },
    });
    assert.equal(auth.status(), 200);
    const bank = await (await context.request.get(base + '/api/admin')).json();
    const started = await context.request.post(base + '/api/admin/test-run/start', {
      data: { stage: 'middle', reveal: true, synthetic: true },
      headers: { Origin: base },
    });
    assert.equal(started.status(), 200);
    let completed = await started.json();
    const intro = structuredClone(completed);
    intro.attempt = null;
    intro.competition.opensAt = '2026-10-06T09:00:00Z';
    intro.competition.closesAt = new Date(Date.now() + 3 * 86400000).toISOString();
    // Exercise real server scoring in the isolated admin namespace: exactly five correct answers.
    for (const q of completed.attempt.questions) {
      const original = bank.questions.find((item) => item.id === q.id);
      assert.ok(original, 'The local fixture bank must contain the test question');
      const correct = q.options.indexOf(original.options[original.correctAnswers[0]]);
      const index = completed.attempt.questions.findIndex((item) => item.id === q.id);
      const response = await context.request.post(base + '/api/admin/test-run/event', {
        headers: { Origin: base },
        data: {
          clientEventId: randomUUID(),
          attemptId: completed.attempt.id,
          kind: 'CHECK',
          questionId: q.id,
          selected: [index < 5 ? correct : (correct + 1) % q.options.length],
          revision: completed.attempt.revision,
        },
      });
      assert.equal(response.status(), 200);
      completed = await response.json();
    }
    const submitted = await context.request.post(base + '/api/admin/test-run/event', {
      headers: { Origin: base },
      data: {
        clientEventId: randomUUID(),
        attemptId: completed.attempt.id,
        kind: 'SUBMIT',
        revision: completed.attempt.revision,
      },
    });
    assert.equal(submitted.status(), 200);
    completed = await submitted.json();
    assert.equal(completed.attempt.score, 5);
    assert.equal(completed.attempt.maxScore, 20);

    for (const design of ['original', 'official', 'hybrid']) {
      for (const [width, height] of process.argv.includes('--focus') ? [] : sizes) {
        const page = await context.newPage();
        await page.setViewportSize({ width, height });
        page.on('pageerror', (error) => errors.push(error.message));
        await page.addInitScript((design) => localStorage.setItem('nbc-design', design), design);
        let fixture = structuredClone(intro);
        fixture.competition.state = 'OPEN';
        // Presentation fixtures use real isolated server responses. No participant writes occur.
        await page.route('**/api/participant**', (route) => route.fulfill({ json: fixture }));
        await page.goto(base + '/participate');
        await page.getByText(labels.OPEN, { exact: false }).waitFor();
        // Start becomes focusable only after the shared PDF verifier finishes.
        await page.waitForFunction(() => document.querySelector('.book-cover-slot.cover-ready'));
        const introText = await page.locator('.participation-intro').innerText();
        assert.ok(introText.includes('المرحلة المتوسطة') && !introText.includes('middle'));
        const opening = await page.locator('.intro-window').innerText();
        assert.ok(
          opening.includes('2026') && opening.includes('12:00') && !/[٠-٩]/.test(opening),
          opening,
        );
        const rootEase = await page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--ease'),
        );
        assert.deepEqual(
          Array.from(rootEase.matchAll(/[\d.]+/g), (match) => Number(match[0])),
          [0.22, 1, 0.36, 1],
        );
        assert.equal(
          await page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue('--motion-press'),
          ),
          '',
        );
        const closing = page.locator('.competition-closing-time button');
        await page.waitForFunction(() =>
          document.querySelector('.competition-closing-time button').textContent.includes('3 أيام'),
        );
        assert.ok((await closing.getAttribute('title')).includes('بتوقيت الرياض'));
        await closing.focus();
        assert.ok(await page.locator('.competition-closing-time time').isVisible());
        assert.equal(await closing.getAttribute('aria-expanded'), 'true');
        await page.getByRole('button', { name: 'ابدأ المشاركة' }).focus();
        assert.ok(await page.locator('.competition-closing-time time').isHidden());
        await closing.click();
        assert.ok(await page.locator('.competition-closing-time time').isVisible());
        await page.waitForFunction(
          () =>
            !Array.from(document.querySelectorAll('.participation-intro button')).find((button) =>
              button.textContent.includes('ابدأ المشاركة'),
            )?.disabled,
        );
        assert.ok(await page.getByRole('button', { name: 'ابدأ المشاركة' }).isEnabled());
        assert.equal(await page.locator('html').getAttribute('data-design'), design);
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `intro overflow ${design} ${width}`,
        );
        await page.screenshot({ path: path.join(output, `intro-${design}-${width}.png`) });

        fixture = completed;
        await page.reload();
        await page.locator('.result-sentence').waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert.equal(
          await page.locator('.result-sentence').textContent(),
          'أجبت إجابة صحيحة عن 5 من 20 سؤالًا.',
        );
        assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
        assert.ok(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `receipt overflow ${design} ${width}`,
        );
        const reduced = await page
          .locator('.result-ticket .button')
          .evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration));
        assert.ok(reduced <= 0.001, `reduced motion ${reduced}`);
        await page.screenshot({ path: path.join(output, `result-${design}-${width}.png`) });

        fixture = structuredClone(completed);
        fixture.attempt.score = null;
        await page.reload();
        await page.getByText('النتيجة محجوبة وفق سياسة المسابقة.', { exact: true }).waitFor();
        assert.equal(await page.locator('.result-sentence').count(), 0);
        console.log(
          `PASS ${design} ${width}x${height}: Arabic intro, Riyadh time focus/tap, result 5 من 20, hidden score, RTL, no horizontal scroll, reduced motion`,
        );
        await page.close();
      }
    }

    const page = await context.newPage();
    let fixture = structuredClone(intro);
    await page.route('**/api/participant**', (route) => route.fulfill({ json: fixture }));
    for (const [state, label] of Object.entries(labels)) {
      fixture.competition.state = state;
      await page.goto(base + '/participate');
      await page.getByText(label, { exact: false }).waitFor();
      await page.waitForFunction(() => document.querySelector('.book-cover-slot.cover-ready'));
      const text = await page.locator('.participation-intro').innerText();
      assert.ok(!/\b(DRAFT|SCHEDULED|OPEN|CLOSED|RESULTS_PUBLISHED)\b/.test(text));
      assert.equal(
        await page.getByRole('button', { name: 'ابدأ المشاركة' }).isDisabled(),
        state !== 'OPEN',
      );
    }
    console.log('PASS Arabic labels and Start gating for all five competition states');
    const touchContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: 'reduce',
    });
    const touch = await touchContext.newPage();
    touch.on('pageerror', (error) => errors.push(error.message));
    await touch.route('**/api/participant**', (route) => route.fulfill({ json: intro }));
    await touch.goto(base + '/participate');
    const touchClosing = touch.locator('.competition-closing-time button');
    await touchClosing.tap();
    await touch.locator('.competition-closing-time time').waitFor({ state: 'visible' });
    assert.ok(await touch.locator('.competition-closing-time time').isVisible());
    assert.ok(
      await touchClosing.evaluate((element) => parseFloat(getComputedStyle(element).height) >= 36),
    );
    await touchContext.close();
    console.log('PASS closing-time disclosure on an emulated touch phone');
    const motionContext = await browser.newContext({
      reducedMotion: 'no-preference',
      viewport: { width: 1366, height: 768 },
    });
    await motionContext.addCookies(await context.cookies());
    const exam = await motionContext.newPage();
    exam.on('pageerror', (error) => errors.push(error.message));
    await exam.goto(base + '/admin');
    await exam.getByRole('button', { name: 'تجربة الإدارة', exact: false }).click();
    await exam.getByRole('checkbox', { name: 'محاكاة انقطاع المزامنة' }).check();
    await exam.getByRole('button', { name: 'دخول الاختبار', exact: true }).click();
    await exam.locator('.answer-option').first().click();
    await exam.getByText('إجابة واحدة بانتظار الإرسال', { exact: true }).waitFor();
    await lockByClick(exam.getByRole('button', { name: /^ثبّت/ }), exam);
    await exam.getByText('تم تثبيت إجابتك', { exact: true }).waitFor();
    assert.equal(await exam.locator('.answer-feedback p').count(), 1);
    assert.equal(
      await exam.locator('.answer-feedback p').textContent(),
      'ستظهر النتيجة عند عودة الاتصال.',
    );
    assert.equal(await exam.locator('.save-status').textContent(), 'إجابة واحدة بانتظار الإرسال');
    assert.equal(await exam.locator('.competition-heading .question-segment.pending').count(), 1);
    const motion = await exam.locator('.answer-feedback').evaluate((element) => ({
      feedback: getComputedStyle(element).transitionDuration,
      press: getComputedStyle(element.closest('.exam-shell').querySelector('button'))
        .transitionDuration,
    }));
    assert.ok(motion.feedback.includes('0.22s'), JSON.stringify(motion));
    assert.ok(motion.press.includes('0.13s'), JSON.stringify(motion));
    await exam.getByRole('button', { name: 'السؤال التالي', exact: false }).click();
    await exam.locator('.answer-option').first().click();
    await exam.getByText('إجابتان بانتظار الإرسال', { exact: true }).waitFor();
    await lockByClick(exam.getByRole('button', { name: /^ثبّت/ }), exam);
    await exam.getByText('تم تثبيت إجابتك', { exact: true }).waitFor();
    assert.equal(await exam.locator('.save-status').textContent(), 'إجابتان بانتظار الإرسال');
    await exam.getByRole('button', { name: 'خروج من الاختبار', exact: true }).click();
    await exam.getByRole('checkbox', { name: 'محاكاة انقطاع المزامنة' }).uncheck();
    await exam.getByRole('button', { name: 'متابعة التجربة الحالية', exact: true }).click();
    await exam.locator('.answer-feedback.correct, .answer-feedback.incorrect').waitFor();
    await exam.getByText('محفوظ', { exact: true }).waitFor();
    assert.equal(await exam.locator('.answer-feedback p').count(), 1);
    assert.ok(await exam.locator('.answer-option input').first().isDisabled());
    await exam.screenshot({ path: path.join(output, 'pending-reconnected-original-1366.png') });
    console.log(
      'PASS distinct pending answers, singular/dual copy, one pending line, pending strip, normal motion, reconnect feedback and immutable locks',
    );
    await motionContext.close();
    await context.close();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
