const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.NBC_PREVIEW_URL;
assert.equal(new URL(base).hostname, '127.0.0.1');
const output = path.resolve('test-results/exam-ux/phase-4');
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
const policies = {
  hidden: 'لا تُعرض النتيجة ولا ترتيب المشاركين. تعتمد اللجنة الفائزين وتعلنهم بنفسها.',
  own_result_only: 'نتيجتك تظهر لك فقط. تعتمد اللجنة الفائزين وتعلنهم بنفسها.',
  publish_after_close:
    'يُعلن الترتيب بعد إغلاق المسابقة واعتماد اللجنة. التعادل لا يُحسم بسرعة المشاركة.',
  public_live: 'الترتيب العام مباشر ويتغير مع كل مشاركة. اعتماد الفائزين للجنة.',
};
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const errors = [];
  try {
    const auth = await browser.newContext();
    assert.equal(
      (
        await auth.request.post(base + '/api/auth/demo-staff', {
          data: { role: 'admin' },
          headers: { Origin: base },
        })
      ).status(),
      200,
    );
    const bank = await (await auth.request.get(base + '/api/admin')).json();
    async function completedRun(correctCount) {
      const response = await auth.request.post(base + '/api/admin/test-run/start', {
        data: { stage: 'middle', reveal: true, synthetic: true },
        headers: { Origin: base },
      });
      assert.equal(response.status(), 200);
      let state = await response.json();
      for (const [index, question] of state.attempt.questions.entries()) {
        const original = bank.questions.find((item) => item.id === question.id);
        assert.ok(original);
        const correct = original.correctAnswers.map((n) =>
          question.options.indexOf(original.options[n]),
        );
        const selected =
          index < correctCount
            ? correct
            : [question.options.findIndex((_, n) => !correct.includes(n))];
        const event = await auth.request.post(base + '/api/admin/test-run/event', {
          data: {
            clientEventId: randomUUID(),
            attemptId: state.attempt.id,
            kind: 'CHECK',
            questionId: question.id,
            selected,
            revision: state.attempt.revision,
          },
          headers: { Origin: base },
        });
        assert.equal(event.status(), 200);
        state = await event.json();
      }
      const submitted = await auth.request.post(base + '/api/admin/test-run/event', {
        data: {
          clientEventId: randomUUID(),
          attemptId: state.attempt.id,
          kind: 'SUBMIT',
          revision: state.attempt.revision,
        },
        headers: { Origin: base },
      });
      assert.equal(submitted.status(), 200);
      const result = await submitted.json();
      assert.equal(result.attempt.score, correctCount);
      return result;
    }
    const completed = await completedRun(5),
      allCorrect = await completedRun(20);
    await auth.close();
    const intro = structuredClone(completed);
    intro.attempt = null;
    intro.competition.state = 'OPEN';
    intro.competition.opensAt = '2026-10-06T09:00:00Z';
    intro.competition.closesAt = new Date(Date.now() + 3 * 86400000).toISOString();
    intro.participant.name = 'فاطمة أحمد';
    for (const design of ['original', 'official', 'hybrid'])
      for (const [width, height] of sizes) {
        const phone = width < 820;
        const context = await browser.newContext({
          viewport: { width, height },
          hasTouch: phone,
          isMobile: phone,
          deviceScaleFactor: phone ? 2 : 1,
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        page.on('pageerror', (error) => errors.push(error.message));
        await page.addInitScript((design) => localStorage.setItem('nbc-design', design), design);
        let fixture = structuredClone(intro);
        await page.route('**/api/participant**', (route) => route.fulfill({ json: fixture }));
        await page.route('**/api/leaderboard**', (route) =>
          route.fulfill({
            json: {
              entries: [
                {
                  participantNumber: completed.attempt.participantNumber,
                  rank: 3,
                  percentage: 25,
                  score: 5,
                  maxScore: 20,
                },
              ],
            },
          }),
        );
        await page.goto(base + '/participate');
        await page.getByRole('heading', { name: 'أهلًا فاطمة', exact: true }).waitFor();
        await page.waitForFunction(() => document.querySelector('.book-cover-slot.cover-ready'));
        await page.evaluate(() => document.fonts.ready);
        const start = page.getByRole('button', { name: 'ابدأ المشاركة', exact: false });
        assert.ok(await start.isEnabled());
        assert.equal(await page.locator('.intro-facts li').count(), 4);
        assert.ok(
          (await page.locator('.intro-readiness').innerText()).includes('الكتاب جاهز دون اتصال'),
        );
        assert.ok((await page.locator('.intro-stage').innerText()).includes('المرحلة المتوسطة'));
        const cover = await page
          .locator('.book-cover-slot > canvas:not(.book-3d-canvas)')
          .evaluate((canvas) => ({ width: canvas.width, height: canvas.height }));
        assert.equal(cover.width, 1400);
        assert.ok(cover.height > cover.width);
        const introBounds = await page.locator('.participation-intro').boundingBox();
        assert.ok(
          introBounds.y + introBounds.height <= height + 1,
          `intro vertical fit ${design} ${width}: ${JSON.stringify(introBounds)}`,
        );
        assert.ok((await start.boundingBox()).y + (await start.boundingBox()).height <= height);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: path.join(output, `intro-${design}-${width}.png`) });

        fixture = structuredClone(completed);
        fixture.competition.leaderboardMode = 'own_result_only';
        await page.reload();
        await page.locator('.result-strip').waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert.equal(
          await page.locator('.result-sentence').innerText(),
          'أجبت إجابة صحيحة عن 5 من 20 سؤالًا.',
        );
        assert.equal(await page.locator('.result-sentence-line small').innerText(), '25%');
        assert.ok(
          await page
            .locator('.result-sentence-line small')
            .evaluate((e) => parseFloat(getComputedStyle(e).fontSize) <= 13),
        );
        assert.equal(await page.locator('.result-segment.correct').count(), 5);
        assert.equal(await page.locator('.result-segment.incorrect').count(), 15);
        assert.equal(await page.locator('.result-strip button').count(), 0);
        assert.equal(
          await page
            .locator('.result-segment')
            .first()
            .evaluate((e) => getComputedStyle(e).animationName),
          'none',
        );
        assert.equal(await page.locator('.result-review-list details').count(), 15);
        const pages = [
          ...new Set(
            completed.attempt.questions
              .filter((q) => !completed.attempt.feedback[q.id].isCorrect)
              .map((q) => q.pdfPage),
          ),
        ].sort((a, b) => a - b);
        const toggle = page.locator('.result-page-toggle');
        if (pages.length > 6) {
          assert.equal(await page.locator('.result-page-chips .source-page-chip').count(), 6);
          await toggle.click();
        } else assert.equal(await toggle.count(), 0);
        assert.deepEqual(
          await page.locator('.result-page-chips .source-page-chip bdi').allTextContents(),
          pages.map(String),
        );
        assert.ok(
          (await page.locator('.result-policy').innerText()).includes(policies.own_result_only),
        );
        assert.equal(
          await page.getByRole('link', { name: 'واصل القراءة', exact: false }).getAttribute('href'),
          '/book',
        );
        const columns = await page
          .locator('.result-layout')
          .evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length);
        assert.equal(columns, width >= 1024 ? 2 : 1);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (width === 390) {
          const ticket = await page.locator('.result-ticket').boundingBox();
          assert.ok(ticket.y + ticket.height <= height);
          assert.ok((await page.locator('.result-revisit').boundingBox()).y < height);
        }
        await page.screenshot({ path: path.join(output, `result-${design}-${width}.png`) });
        const review = page.locator('.result-review-list details').first();
        await review.locator('summary').click();
        const missed = completed.attempt.questions.find(
          (q) => !completed.attempt.feedback[q.id].isCorrect,
        );
        assert.equal(
          await review.locator('.incorrect p').innerText(),
          'إجابتك: ' +
            completed.attempt.answers[missed.id].selected.map((n) => missed.options[n]).join('، '),
        );
        assert.equal(
          await review.locator('.correct p').innerText(),
          'الصحيحة: ' +
            completed.attempt.feedback[missed.id].correctAnswers
              .map((n) => missed.options[n])
              .join('، '),
        );
        assert.equal(
          await review.locator('.result-explanation').innerText(),
          completed.attempt.feedback[missed.id].explanation,
        );
        assert.equal(
          (await review.locator('.source-page-chip').innerText()).replace(/\s+/g, ' '),
          `افتح الصفحة ${missed.pdfPage}`,
        );
        await page.screenshot({ path: path.join(output, `review-${design}-${width}.png`) });
        await review.locator('summary').click();

        if ([390, 1024].includes(width)) {
          // A real heading page gives useful screenshots even when a question's
          // first source page happens to be one of this book's blank versos.
          const chipPage = pages.find((n) => [9, 13, 17, 27, 35, 41, 55].includes(n)) ?? pages[0];
          const chip = page
            .locator('.result-page-chips button')
            .filter({ hasText: `صفحة ${chipPage}` });
          const modal = page.getByRole('dialog', { name: 'كتاب المسابقة', exact: true });
          async function openReader(opener = chip, n = chipPage) {
            await opener.click();
            await modal.waitFor();
            await page.waitForFunction(() =>
              document.activeElement?.matches('.result-reader-close'),
            );
            assert.equal(
              await modal.getByLabel('رقم صفحة PDF', { exact: true }).inputValue(),
              String(n),
            );
            const close = modal.getByRole('button', { name: 'إغلاق', exact: true });
            const box = await close.boundingBox();
            assert.ok(box.width >= 96 && box.height >= 44);
            assert.equal(
              Math.round((await modal.locator('.result-reader-header').boundingBox()).height),
              56,
            );
            await close.focus();
            await page.keyboard.press('Shift+Tab');
            assert.ok(await modal.evaluate((e) => e.contains(document.activeElement)));
            await page.keyboard.press('Tab');
            assert.ok(await close.evaluate((e) => e === document.activeElement));
            await page.waitForFunction(
              (n) =>
                document.querySelector(`.result-reader-dialog [data-page="${n}"] canvas`) &&
                document
                  .querySelector(`.result-reader-dialog [data-page="${n}"]`)
                  .getAttribute('aria-busy') === 'false',
              n,
            );
            assert.ok((await modal.locator('canvas').count()) < 10);
            const reader = await modal.locator('.reader').boundingBox();
            const viewport = await modal.locator('.pdf-canvas-container').boundingBox();
            assert.ok(Math.abs(viewport.y + viewport.height - reader.y - reader.height) < 2);
            assert.ok(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            );
          }
          async function closed(opener = chip) {
            await modal.waitFor({ state: 'hidden' });
            await page.waitForFunction(() => !document.querySelector('.result-reader-dialog').open);
            assert.ok(await opener.evaluate((e) => e === document.activeElement));
          }
          await openReader();
          await page.screenshot({
            path: path.join(output, `result-reader-${design}-${width}.png`),
          });
          if (phone) await modal.getByRole('button', { name: 'خيارات التكبير', exact: true }).tap();
          await modal.getByRole('button', { name: 'تكبير الصفحة', exact: true }).click();
          if (phone) {
            await page.keyboard.press('Escape');
            await modal.getByRole('button', { name: 'المزيد', exact: true }).tap();
          }
          await modal
            .getByRole(phone ? 'menuitemcheckbox' : 'button', {
              name: 'القراءة الليلية',
              exact: true,
            })
            .click();
          await modal.locator('.night-reader').waitFor();
          await modal.getByRole('button', { name: 'إغلاق', exact: true }).click();
          await closed();
          await openReader();
          assert.equal(await modal.locator('.night-reader').count(), 1);
          assert.ok((await modal.locator('.reader-zoom-controls').innerText()).includes('125%'));
          await page.keyboard.press('Escape');
          await closed();
          if (phone) {
            await openReader();
            await modal.getByRole('button', { name: 'العودة إلى النتيجة', exact: true }).tap();
            await closed();
            await openReader();
            const title = await modal.locator('.result-reader-header > span').boundingBox();
            const cdp = await context.newCDPSession(page),
              x = Math.round(title.x + title.width / 2),
              y = Math.round(title.y + title.height / 2);
            await cdp.send('Input.dispatchTouchEvent', {
              type: 'touchStart',
              touchPoints: [{ x, y, id: 0 }],
            });
            await cdp.send('Input.dispatchTouchEvent', {
              type: 'touchMove',
              touchPoints: [{ x, y: y + 100, id: 0 }],
            });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await closed();
          } else {
            await openReader();
            const box = await modal.boundingBox();
            assert.equal(box.x, 24);
            assert.equal(box.y, 24);
            await page.mouse.click(8, 8);
            await closed();
          }
          await review.locator('summary').click();
          const source = review.locator('.source-page-chip');
          await openReader(source, missed.pdfPage);
          await modal.getByRole('button', { name: 'إغلاق', exact: true }).click();
          await closed(source);
          await review.locator('summary').click();
        }
        if (design === 'original' && width === 390) {
          await page.evaluate(() => {
            Object.defineProperty(navigator, 'clipboard', {
              configurable: true,
              value: {
                writeText: async () => {
                  throw new DOMException('refused', 'NotAllowedError');
                },
              },
            });
            const original = document.execCommand.bind(document);
            window.copyFallbackCalls = 0;
            document.execCommand = (command, ...args) => {
              if (command === 'copy') window.copyFallbackCalls++;
              return original(command, ...args);
            };
          });
          await page.getByRole('button', { name: 'نسخ الرقم', exact: false }).click();
          await page.getByRole('button', { name: 'تم النسخ', exact: false }).waitFor();
          assert.equal(await page.evaluate(() => window.copyFallbackCalls), 1);
          await page.getByRole('button', { name: 'نسخ الرقم', exact: false }).waitFor();
          await page.evaluate(() => {
            document.execCommand = () => false;
          });
          await page.getByRole('button', { name: 'نسخ الرقم', exact: false }).click();
          const manual = page.getByLabel('رقم المشارك للنسخ اليدوي', { exact: true });
          await manual.waitFor();
          assert.equal(await manual.inputValue(), completed.attempt.participantNumber);
          assert.ok(
            await manual.evaluate(
              (e) => e.selectionStart === 0 && e.selectionEnd === e.value.length,
            ),
          );
          await page.screenshot({ path: path.join(output, 'clipboard-refused-390.png') });
        }
        fixture = structuredClone(allCorrect);
        await page.reload();
        await page.locator('.result-all-correct').waitFor();
        assert.equal(await page.locator('.result-review-list').count(), 0);
        assert.equal(await page.locator('.result-page-chips').count(), 0);
        assert.equal(await page.locator('.result-segment.correct').count(), 20);
        await page.screenshot({ path: path.join(output, `all-correct-${design}-${width}.png`) });
        fixture = structuredClone(completed);
        fixture.attempt.score = null;
        fixture.attempt.percentage = null;
        await page.reload();
        await page.getByText('النتيجة محجوبة وفق سياسة المسابقة.', { exact: true }).waitFor();
        assert.equal(
          await page
            .locator(
              '.result-sentence,.result-strip,.result-review-list,.result-page-chips,.leaderboard',
            )
            .count(),
          0,
        );
        await page.screenshot({ path: path.join(output, `hidden-${design}-${width}.png`) });
        if (design === 'original' && width === 390) {
          fixture.attempt.feedback = {};
          await page.reload();
          await page.locator('.result-own-answers').waitFor();
          assert.equal(await page.locator('.result-own-answers details').count(), 20);
          assert.equal(
            await page.locator('.result-review-answer,.result-explanation,.result-segment').count(),
            0,
          );
          for (const [mode, line] of Object.entries(policies)) {
            fixture = structuredClone(completed);
            fixture.competition.leaderboardMode = mode;
            fixture.published = mode === 'publish_after_close';
            await page.reload();
            await page.locator('.result-policy').waitFor();
            assert.equal(await page.locator('.result-policy').innerText(), line);
            if (mode === 'public_live')
              await page.getByText('ترتيبك الحالي 3', { exact: true }).waitFor();
            assert.equal(
              await page.locator('.leaderboard').count(),
              ['public_live', 'publish_after_close'].includes(mode) ? 1 : 0,
            );
          }
        }
        console.log(
          `PASS ${design} ${width}x${height}: intro cover/cache/fit, result/review/chips, score policies, no overflow${[390, 1024].includes(width) ? ', modal close paths/focus/swipe' : ''}`,
        );
        await context.close();
      }
    // A blocked cache must never claim offline readiness; byte or page-count
    // mismatch must never enable Start. These are presentation fixtures only.
    for (const kind of ['delayed', 'no-cache', 'bad-sha', 'bad-page-count']) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      });
      if (kind === 'no-cache')
        await context.addInitScript(() =>
          Object.defineProperty(window, 'caches', {
            value: {
              open: async () => {
                throw new Error('unavailable');
              },
            },
          }),
        );
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      const fixture = structuredClone(intro);
      if (kind === 'bad-sha') fixture.book.sha256 = '0'.repeat(64);
      if (kind === 'bad-page-count') fixture.book.pageCount = 65;
      await page.route('**/api/participant**', (route) => route.fulfill({ json: fixture }));
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      if (kind === 'delayed')
        await page.route('**/books/*.pdf', async (route) => {
          await gate;
          await route.continue();
        });
      await page.goto(base + '/participate');
      await page.locator('.intro-readiness').waitFor();
      const start = page.getByRole('button', { name: 'ابدأ المشاركة', exact: false });
      if (kind === 'delayed') {
        assert.equal(await page.locator('.intro-readiness').innerText(), 'جارٍ تجهيز الكتاب');
        assert.ok(await start.isDisabled());
        await page.screenshot({ path: path.join(output, 'intro-loading-390.png') });
        release();
      }
      if (['delayed', 'no-cache'].includes(kind)) {
        await page.waitForFunction(() => document.querySelector('.book-cover-slot.cover-ready'));
        assert.ok(await start.isEnabled());
        if (kind === 'no-cache')
          assert.equal(await page.locator('.intro-readiness').innerText(), 'جارٍ تجهيز الكتاب');
      } else {
        await page
          .getByText(
            kind === 'bad-sha'
              ? 'نسخة الكتاب تغيرت. تواصل مع الدعم.'
              : 'عدد صفحات الكتاب غير مطابق.',
            { exact: true },
          )
          .waitFor();
        assert.ok(await start.isDisabled());
        assert.equal(await page.locator('.book-cover-slot.cover-ready').count(), 0);
      }
      console.log('PASS book readiness ' + kind);
      await context.close();
    }
    // Normal motion exposes the approved grow-in timing; all matrix cases above
    // use reduced motion and must have no segment animation.
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    await page.route('**/api/participant**', (route) => route.fulfill({ json: completed }));
    await page.goto(base + '/participate');
    await page.locator('.result-strip').waitFor();
    const motion = await page.locator('.result-segment').evaluateAll((items) =>
      items.map((e) => ({
        duration: getComputedStyle(e).animationDuration,
        delay: getComputedStyle(e).animationDelay,
      })),
    );
    assert.equal(motion[0].duration, '0.42s');
    assert.equal(motion[1].delay, '0.04s');
    assert.equal(motion[19].delay, '0.76s');
    await context.close();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
