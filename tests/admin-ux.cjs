// Phase 6: committee launch control, question workshop, coverage strip and admin-only search.
// Needs NBC_PREVIEW_URL (loopback demo build) and PLAYWRIGHT_MODULE. Mocks /api/admin for the
// state-machine cases, then runs one real lifecycle against the disposable demo (run it last).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.NBC_PREVIEW_URL;
assert.ok(base && new URL(base).hostname === '127.0.0.1', 'A loopback demo URL is required');
const output = path.resolve('test-results/exam-ux/phase-6');
fs.mkdirSync(output, { recursive: true });
const DAY = 86400000;
const formatter = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'Asia/Riyadh',
});
const stateCodes = /\b(DRAFT|SCHEDULED|OPEN|CLOSED|RESULTS_PUBLISHED)\b/;
const indic = /[٠-٩۰-۹]/;
const iso = (ms) => new Date(ms).toISOString();

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const problems = [];
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
    const real = await (await auth.request.get(base + '/api/admin')).json();
    assert.equal(real.questions.length, 60);
    assert.ok(
      real.competition.state === 'DRAFT' && !real.competition.frozenAt,
      'This suite ends with a real lifecycle: start the demo server on a fresh data directory.',
    );
    await auth.close();

    // ---- a mocked committee session -------------------------------------------------------
    async function session(patch = {}, options = {}) {
      const state = structuredClone(real);
      state.participants = Array.from({ length: 7 }, (_, i) => ({
        id: `p${i}`,
        name: `مشارك ${i}`,
        stage: 'المرحلة المتوسطة',
        institution: null,
        gender: null,
        region: 'الرياض',
        locality: 'الرياض',
        village: '—',
        score: null,
        max_score: null,
        created_at: iso(Date.now() - DAY),
        submitted_at: null,
        attempt_id: i < 2 ? `a${i}` : null,
      }));
      Object.assign(
        state.competition,
        {
          frozenAt: null,
          state: 'DRAFT',
          version: 3,
          opensAt: null,
          closesAt: null,
          closedAt: null,
          closingPolicy: 'grace',
          graceMinutes: 60,
          leaderboardMode: 'publish_after_close',
        },
        patch.competition,
      );
      if (patch.bookApproved === false) state.book.approved = false;
      if (patch.questions) patch.questions(state.questions);
      if (patch.history) state.history = patch.history;
      const posts = [];
      const questionPosts = [];
      const context = await browser.newContext({
        viewport: options.viewport ?? { width: 1366, height: 900 },
        deviceScaleFactor: 1,
        hasTouch: Boolean(options.phone),
        isMobile: Boolean(options.phone),
        reducedMotion: options.reduced ? 'reduce' : 'no-preference',
      });
      const page = await context.newPage();
      page.on('pageerror', (error) => problems.push('pageerror: ' + error.message));
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        // The bulk-approve case answers 409 on purpose.
        if (options.failQuestionAt && message.text().includes('409')) return;
        problems.push('console: ' + message.text());
      });
      if (options.design)
        await page.addInitScript(
          (design) => localStorage.setItem('nbc-design', design),
          options.design,
        );
      await page.route(
        (url) => url.pathname === '/api/admin',
        (route) => route.fulfill({ json: state }),
      );
      await page.route('**/api/admin/competition', async (route) => {
        const body = route.request().postDataJSON();
        posts.push(body);
        const c = state.competition;
        const now = Date.now();
        if (body.action === 'freeze') c.frozenAt = iso(now);
        else if (body.action === 'open') Object.assign(c, { state: 'OPEN', opensAt: iso(now) });
        else if (body.action === 'close') Object.assign(c, { state: 'CLOSED', closedAt: iso(now) });
        else if (body.action === 'publish') c.state = 'RESULTS_PUBLISHED';
        else if (body.action === 'unpublish') c.state = 'CLOSED';
        else if (body.action === 'approve-book') state.book.approved = true;
        else if (body.action === 'settings') {
          for (const key of [
            'title',
            'leaderboardMode',
            'closingPolicy',
            'graceMinutes',
            'opensAt',
            'closesAt',
          ])
            c[key] = body[key];
          if (body.scheduled) c.state = 'SCHEDULED';
        }
        c.version += 1;
        await route.fulfill({ json: {} });
      });
      await page.route('**/api/admin/question', async (route) => {
        const body = route.request().postDataJSON();
        questionPosts.push(body);
        if (options.failQuestionAt && questionPosts.length === options.failQuestionAt)
          return route.fulfill({ status: 409, json: { error: 'خطأ تجريبي من الخادم' } });
        const q = state.questions.find((item) => item.id === body.id);
        if (body.approve && q) q.approved = true;
        await route.fulfill({ json: {} });
      });
      await page.goto(base + '/admin');
      await page.getByRole('button', { name: 'دخول عرض اللجنة' }).click();
      return { context, page, state, posts, questionPosts };
    }
    const tab = async (page, name) => {
      await page.locator('.admin-sidebar nav button', { hasText: name }).first().click();
    };
    const openLaunch = async (page) => {
      await tab(page, 'إدارة المسابقة');
      await page.locator('.launch-control').waitFor();
    };
    const launchText = (page) => page.locator('.launch-control').innerText();
    const primary = (page) => page.locator('.launch-actions > :first-child');
    // Move the pointer onto a (possibly off-screen) button after scrolling it into view.
    const pointOn = async (page, button) => {
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    };
    const noOverflow = async (page, label) =>
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        'horizontal scroll: ' + label,
      );

    // ---- 1. the six-step track and exactly one next action per state ----------------------
    const future = (days) => iso(Date.now() + days * DAY);
    const stepCases = [
      {
        name: 'draft ready',
        patch: {},
        track: 'مسودة',
        title: 'اعتمد نسخة الأسئلة',
        label: 'اعتمد نسخة الأسئلة',
        enabled: true,
      },
      {
        name: 'draft with three unapproved drafts',
        patch: {
          questions: (qs) =>
            qs
              .filter((q) => q.stage === 'middle')
              .slice(0, 3)
              .forEach((q) => (q.approved = false)),
        },
        track: 'مسودة',
        title: 'اعتمد نسخة الأسئلة',
        label: 'اعتمد نسخة الأسئلة',
        enabled: false,
        reason: 'أكمل المتطلبات أعلاه لتفعيل الزر.',
        text: ['17 من 20 سؤالًا معتمدًا', 'ينقص 3', '3 مسودات نشطة تمنع الاعتماد'],
      },
      {
        name: 'frozen',
        patch: { competition: { frozenAt: iso(Date.now() - DAY) } },
        track: 'الأسئلة معتمدة',
        title: 'افتح المسابقة',
        label: 'اضغط مطولًا لفتح المسابقة',
        enabled: true,
        text: ['ستُتاح المسابقة فورًا لـ 7 مسجّلين', 'لا يمكن تعديل الأسئلة بعد الفتح'],
      },
      {
        name: 'scheduled',
        patch: {
          competition: {
            frozenAt: iso(Date.now() - DAY),
            state: 'SCHEDULED',
            opensAt: future(2),
            closesAt: future(9),
          },
        },
        track: 'مجدولة',
        title: 'المسابقة مجدولة',
        label: 'اضغط مطولًا للفتح الآن',
        enabled: true,
        text: ['ستفتح تلقائيًا في الموعد المحدد'],
      },
      {
        name: 'open',
        patch: {
          competition: { frozenAt: iso(Date.now() - DAY), state: 'OPEN', closesAt: future(3) },
        },
        track: 'مفتوحة',
        title: 'أغلق المسابقة',
        label: 'اضغط مطولًا للإغلاق',
        enabled: true,
        text: ['من بين 7 مسجّلين', 'مشاركان قيد المشاركة'],
      },
      {
        name: 'closed inside the sync grace',
        patch: {
          competition: {
            frozenAt: iso(Date.now() - DAY),
            state: 'CLOSED',
            closedAt: iso(Date.now() - 600000),
            closingPolicy: 'grace',
            graceMinutes: 60,
          },
        },
        track: 'مغلقة',
        title: 'اعتمد نشر النتائج',
        label: 'اعتمد نشر النتائج',
        enabled: false,
        reason: 'انتظر انتهاء مهلة المزامنة حتى',
      },
      {
        name: 'closed, no grace',
        patch: {
          competition: {
            frozenAt: iso(Date.now() - DAY),
            state: 'CLOSED',
            closedAt: iso(Date.now() - 600000),
            closingPolicy: 'immediate',
          },
        },
        track: 'مغلقة',
        title: 'اعتمد نشر النتائج',
        label: 'اعتمد نشر النتائج',
        enabled: true,
      },
      {
        name: 'results published',
        patch: { competition: { frozenAt: iso(Date.now() - DAY), state: 'RESULTS_PUBLISHED' } },
        track: 'النتائج منشورة',
        title: 'النتائج منشورة',
        label: 'اضغط مطولًا لسحب النشر',
        enabled: true,
        text: ['ستختفي النتائج والترتيب فورًا عن 7 مسجّلين'],
      },
    ];
    for (const item of stepCases) {
      const { context, page } = await session(item.patch);
      await openLaunch(page);
      const text = await launchText(page);
      assert.ok(!stateCodes.test(text), `${item.name}: a raw state code is visible`);
      assert.equal(
        await page.locator('.launch-track [aria-current="step"]').innerText(),
        item.track,
        item.name,
      );
      assert.equal(await page.locator('.launch-track li').count(), 6);
      assert.ok(
        text.includes('الخطوة التالية: ' + item.title),
        `${item.name}: next action heading`,
      );
      const button = primary(page);
      assert.equal((await button.innerText()).trim(), item.label, item.name);
      assert.equal(await button.isEnabled(), item.enabled, `${item.name}: enabled`);
      if (!item.enabled)
        assert.ok(text.includes(item.reason), `${item.name}: a disabled action explains why`);
      for (const piece of item.text ?? [])
        assert.ok(text.includes(piece), `${item.name}: "${piece}" in\n${text}`);
      assert.equal(
        await page.locator('code.checksum').isVisible(),
        false,
        `${item.name}: the SHA-256 stays behind its disclosure`,
      );
      await noOverflow(page, item.name);
      await context.close();
    }
    console.log(
      'PASS six-step track, one next action per state, reasons for disabled actions, no raw codes',
    );

    // ---- 2. preconditions: book approval and linking to the failing stage ----------------
    {
      const { context, page, posts } = await session({ bookApproved: false });
      await openLaunch(page);
      assert.ok((await launchText(page)).includes('ملف الكتاب بانتظار الاعتماد'));
      assert.equal(await primary(page).isEnabled(), false);
      await page.getByRole('button', { name: 'اعتمد ملف الكتاب الحالي' }).click();
      await page.waitForFunction(() => document.body.innerText.includes('ملف الكتاب معتمد'));
      assert.deepEqual(
        posts.map((p) => p.action),
        ['approve-book'],
      );
      assert.equal(
        await primary(page).isEnabled(),
        true,
        'book approved: the freeze action unlocks',
      );
      await context.close();
    }
    {
      const { context, page } = await session({
        questions: (qs) =>
          qs
            .filter((q) => q.stage === 'highschool')
            .slice(0, 2)
            .forEach((q) => (q.approved = false)),
      });
      await openLaunch(page);
      await page
        .locator('[data-check="stage-highschool"]')
        .getByRole('button', { name: 'افتح بنك الأسئلة' })
        .click();
      await page.locator('.question-workshop').waitFor();
      assert.equal(await page.locator('.filter-row select').first().inputValue(), 'highschool');
      const rows = await page.locator('.question-list > li[data-question]').count();
      assert.equal(rows, 20, 'the bank opens filtered to the failing stage');
      await context.close();
    }
    {
      const { context, page } = await session();
      await openLaunch(page);
      await page.getByRole('button', { name: 'افتح تجربة الإدارة' }).click();
      await page.getByRole('heading', { name: 'تجربة الإدارة' }).first().waitFor();
      await context.close();
      console.log(
        'PASS preconditions: book approval, link to failing stage, rehearsal opens the test run (not a gate)',
      );
    }

    // ---- 3. hold to confirm ---------------------------------------------------------------
    {
      const { context, page, posts } = await session({
        competition: { frozenAt: iso(Date.now() - DAY) },
      });
      await openLaunch(page);
      const button = primary(page);
      const point = () => pointOn(page, button);
      // A press shorter than the threshold does nothing.
      await point();
      await page.mouse.down();
      await page.waitForTimeout(400);
      assert.ok(
        Number(await button.evaluate((el) => el.style.getPropertyValue('--hold'))) > 0.1,
        'fill progresses',
      );
      await page.mouse.up();
      await page.waitForTimeout(1400);
      assert.equal(posts.length, 0, 'a short press must not mutate');
      assert.equal(
        await button.evaluate((el) => el.style.getPropertyValue('--hold')),
        '0',
        'resets on release',
      );
      // A plain click (press and release) does nothing either.
      await button.click();
      await page.waitForTimeout(300);
      assert.equal(posts.length, 0);
      // Pointer cancel and blur reset the hold.
      await point();
      await page.mouse.down();
      await page.waitForTimeout(500);
      await button.dispatchEvent('pointercancel');
      await page.waitForTimeout(900);
      assert.equal(posts.length, 0, 'pointercancel cancels');
      await page.mouse.up();
      await button.focus();
      await page.keyboard.down('Space');
      await page.waitForTimeout(500);
      await button.evaluate((el) => el.blur());
      await page.waitForTimeout(900);
      assert.equal(posts.length, 0, 'blur cancels');
      await page.keyboard.up('Space');
      // Keyboard: a short Space does nothing; a held Space confirms.
      await button.focus();
      await page.keyboard.down('Space');
      await page.waitForTimeout(400);
      await page.keyboard.up('Space');
      await page.waitForTimeout(900);
      assert.equal(posts.length, 0, 'a short keyboard press must not mutate');
      await page.keyboard.down('Enter');
      await page.waitForTimeout(1500);
      await page.keyboard.up('Enter');
      await page.waitForFunction(
        () => document.querySelector('.launch-track [aria-current]')?.textContent === 'مفتوحة',
      );
      assert.deepEqual(
        posts.map((p) => p.action),
        ['open'],
      );
      assert.equal(posts[0].version, 3, 'the current version is sent');
      assert.equal(
        await page.locator('.launch-actions > :first-child').innerText(),
        'اضغط مطولًا للإغلاق',
      );
      // Pointer hold to close.
      const close = primary(page);
      await pointOn(page, close);
      await page.mouse.down();
      await page.waitForTimeout(1500);
      await page.mouse.up();
      await page.waitForFunction(
        () => document.querySelector('.launch-track [aria-current]')?.textContent === 'مغلقة',
      );
      assert.deepEqual(
        posts.map((p) => p.action),
        ['open', 'close'],
      );
      await context.close();
      console.log('PASS hold-to-confirm: short press, cancel, blur, keyboard hold, real hold');
    }

    // ---- 4. results policy preview, closing policy, schedule, save bar, toast ----------------
    {
      const { context, page, posts } = await session({
        competition: {
          frozenAt: iso(Date.now() - DAY),
          opensAt: future(8),
          closesAt: future(22),
          leaderboardMode: 'publish_after_close',
          closingPolicy: 'grace',
          graceMinutes: 60,
        },
      });
      await openLaunch(page);
      const text = await launchText(page);
      assert.equal(await page.locator('.save-bar').count(), 0, 'no save bar without changes');
      assert.equal(
        await page.locator('input[type="datetime-local"]').count(),
        0,
        'no raw date input by default',
      );
      assert.ok(!/mm\/dd\/yyyy/i.test(text));
      const opens = new Date(
        Date.parse(await page.locator('.launch-field time').first().getAttribute('datetime')),
      );
      assert.equal(
        await page.locator('.launch-field time').first().innerText(),
        formatter.format(opens),
      );
      assert.ok(
        /2026/.test(text) && !indic.test(await page.locator('.launch-card').nth(2).innerText()),
        'Gregorian Latin digits',
      );
      assert.ok(text.includes('بعد 8 أيام') && text.includes('بعد 22 يومًا'), 'relative chips');
      // Policy preview shares the student strings.
      const preview = page.locator('.student-preview');
      await page.getByRole('radio', { name: /محجوب كليًا/ }).check();
      let shown = await preview.innerText();
      assert.ok(
        shown.includes('تم استلام مشاركتك') && shown.includes('النتيجة محجوبة وفق سياسة المسابقة.'),
      );
      assert.ok(
        shown.includes('لا تُعرض النتيجة ولا ترتيب المشاركين.') &&
          !shown.includes('نتيجتك تظهر لك'),
      );
      await page.getByRole('radio', { name: /ترتيب عام مباشر/ }).check();
      shown = await preview.innerText();
      assert.ok(shown.includes('أجبت إجابة صحيحة عن 14 من 20 سؤالًا.'));
      assert.ok(shown.includes('الترتيب العام مباشر ويتغير مع كل مشاركة. اعتماد الفائزين للجنة.'));
      assert.equal(
        await page
          .locator('.save-bar')
          .innerText()
          .then((t) => t.includes('1 تغيير غير محفوظ')),
        true,
      );
      // Closing policy and the computed sentence.
      const closesAt = Date.parse(
        await page.locator('.launch-field time').nth(1).getAttribute('datetime'),
      );
      const expected = (minutes) =>
        `تبقى المحاولات القائمة قابلة للمزامنة حتى ${formatter.format(new Date(closesAt + minutes * 60000))}.`;
      assert.equal(await page.getByTestId('grace-sentence').innerText(), expected(60));
      await page.getByLabel('مهلة المزامنة بالدقائق').fill('180');
      assert.equal(await page.getByTestId('grace-sentence').innerText(), expected(180));
      assert.ok((await page.locator('.save-bar').innerText()).includes('2 تغييرات غير محفوظة'));
      await page.getByText('إيقاف فوري', { exact: true }).click();
      assert.equal(await page.getByLabel('مهلة المزامنة بالدقائق').count(), 0);
      assert.ok((await launchText(page)).includes('تتوقف المحاولات القائمة عند لحظة الإغلاق.'));
      // Discard restores everything.
      await page.getByRole('button', { name: 'تجاهل' }).click();
      assert.equal(await page.locator('.save-bar').count(), 0);
      assert.equal(
        await page
          .getByRole('radio', { name: /النتيجة الشخصية، والترتيب بعد الإغلاق/ })
          .isChecked(),
        true,
      );
      assert.equal(await page.getByLabel('مهلة المزامنة بالدقائق').inputValue(), '60');
      // Edit a date on request, then save.
      await page.getByRole('button', { name: 'تعديل', exact: true }).first().click();
      const input = page.locator('input[type="datetime-local"]');
      assert.equal(await input.count(), 1);
      await input.fill('2026-12-01T09:30');
      assert.ok(
        (await launchText(page)).includes(formatter.format(new Date('2026-12-01T09:30:00+03:00'))),
      );
      await page.getByRole('radio', { name: /النتيجة الشخصية فقط/ }).check();
      await page.getByRole('button', { name: 'حفظ الإعدادات' }).click();
      const toast = page.locator('.admin-toast');
      await toast.waitFor({ state: 'visible' });
      assert.equal(await toast.getAttribute('role'), 'status');
      assert.ok((await toast.innerText()).includes('تم حفظ الإعدادات'));
      assert.equal(posts.length, 1);
      assert.equal(posts[0].action, 'settings');
      assert.equal(posts[0].feedbackMode, 'educational', 'the feedbackMode payload is kept');
      assert.equal(posts[0].leaderboardMode, 'own_result_only');
      assert.equal(posts[0].opensAt, '2026-12-01T06:30:00.000Z');
      assert.equal(posts[0].scheduled, false);
      assert.equal(await page.locator('.save-bar').count(), 0, 'the bar goes away after saving');
      assert.equal(
        await page.locator('.admin-notice, .success-message').count(),
        0,
        'no duplicate banner',
      );
      await page.waitForFunction(
        () => document.querySelector('.admin-toast')?.hidden === true,
        null,
        { timeout: 5000 },
      );
      await page.screenshot({ path: path.join(output, 'launch-control-1366.png'), fullPage: true });
      await context.close();
      console.log(
        'PASS dates, relative chips, policy preview, closing sentence, save bar, toast, payload',
      );
    }

    // ---- 5. scheduling and campaign creation --------------------------------------------------
    {
      const { context, page, posts } = await session({
        competition: { frozenAt: iso(Date.now() - DAY) },
      });
      await openLaunch(page);
      const schedule = page.getByRole('button', { name: 'جدولة الفتح بدل الآن' });
      assert.equal(await schedule.isDisabled(), true);
      assert.ok((await launchText(page)).includes('حدّد موعدي الفتح والإغلاق أولًا.'));
      await page.getByRole('button', { name: 'تحديد', exact: true }).first().click();
      await page.getByRole('button', { name: 'تحديد', exact: true }).first().click();
      await page.getByRole('button', { name: 'تم', exact: true }).first().click();
      await page.getByRole('button', { name: 'تم', exact: true }).first().click();
      assert.equal(await schedule.isEnabled(), true, 'defaults are in the future and ordered');
      await schedule.click();
      await page.waitForFunction(
        () => document.querySelector('.launch-track [aria-current]')?.textContent === 'مجدولة',
      );
      assert.equal(posts.length, 1);
      assert.equal(posts[0].scheduled, true);
      assert.ok(
        posts[0].opensAt &&
          posts[0].closesAt &&
          Date.parse(posts[0].closesAt) > Date.parse(posts[0].opensAt),
      );
      await page.locator('.launch-more summary').click();
      assert.equal(
        await page.getByRole('button', { name: 'إنشاء حملة جديدة' }).isDisabled(),
        true,
        'cannot create while scheduled',
      );
      await context.close();
      console.log(
        'PASS scheduling needs both dates, sends scheduled=true; create is blocked while scheduled',
      );
    }

    // ---- 6. question workshop ----------------------------------------------------------------------
    {
      const draftIds = [];
      const { context, page, questionPosts } = await session(
        {
          questions: (qs) => {
            const middle = qs.filter((q) => q.stage === 'middle');
            for (const q of middle.slice(0, 5)) {
              q.approved = false;
              draftIds.push(q.id);
            }
          },
          history: [
            {
              question_id: 'x',
              version: 1,
              created_at: iso(Date.now() - DAY),
              body: { title: 'قديم؟', options: ['أ', 'ب'], pdfPage: 3 },
            },
          ],
        },
        { failQuestionAt: 3 },
      );
      await tab(page, 'بنك الأسئلة');
      await page.locator('.question-workshop').waitFor();
      const counters = await page.locator('.stage-counters > div').allInnerTexts();
      assert.equal(counters.length, 3);
      assert.ok(
        counters.some((t) => t.includes('15 / 20')),
        counters.join('|'),
      );
      assert.equal(
        await page.locator('.question-list > li[data-question]').count(),
        60,
        'a dense row per question',
      );
      assert.ok(
        (await page.locator('.question-list > li[data-question]').first().boundingBox()).height <
          90,
        'compact rows',
      );
      // Bulk approve stops on the first error.
      await page.locator('.filter-row select').first().selectOption('middle');
      for (const id of draftIds.slice(0, 4))
        await page.locator(`li[data-question="${id}"] input[type="checkbox"]`).check();
      await page.getByRole('button', { name: 'اعتمد المحدد (4)' }).click();
      await page.getByRole('alert').filter({ hasText: 'توقف الاعتماد' }).waitFor();
      assert.equal(questionPosts.length, 3, 'two approvals, then the failing one, then nothing');
      assert.ok(questionPosts.every((p) => p.approve === true));
      assert.deepEqual(
        questionPosts.map((p) => p.id),
        draftIds.slice(0, 3),
      );
      // Row menu with actions and a readable history.
      await page.locator(`li[data-question="${draftIds[4]}"] .row-menu button`).click();
      const menu = page.getByRole('menu');
      assert.deepEqual(await menu.getByRole('menuitem').allInnerTexts(), [
        'تحرير',
        'اعتماد اللجنة',
        'تاريخ الإصدارات',
      ]);
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('menu').count(), 0);
      await page.screenshot({ path: path.join(output, 'workshop-list-1366.png') });
      await context.close();
      console.log('PASS stage counters, dense rows, row menu, bulk approve stops on first error');
    }
    {
      const { context, page } = await session({
        history: [
          {
            question_id: real.questions[0].id,
            version: 1,
            created_at: iso(Date.now() - 2 * DAY),
            body: { ...real.questions[0], version: 1, title: 'نص قديم للسؤال؟' },
          },
          {
            question_id: real.questions[0].id,
            version: 2,
            created_at: iso(Date.now() - DAY),
            body: { ...real.questions[0], version: 2, pdfPage: 11 },
          },
        ],
      });
      await tab(page, 'بنك الأسئلة');
      await page.locator(`li[data-question="${real.questions[0].id}"] .row-menu button`).click();
      await page.getByRole('menuitem', { name: 'تاريخ الإصدارات' }).click();
      const history = page.getByRole('list', { name: 'تاريخ الإصدارات' });
      const t = await history.innerText();
      assert.ok(t.includes('إصدار أول') && t.includes('نص السؤال') && t.includes('صفحة المصدر'), t);
      assert.equal(await history.locator('pre').first().isVisible(), false, 'JSON only on request');
      assert.ok(!indic.test(t));
      await context.close();
      console.log('PASS version history names what changed; JSON stays behind a disclosure');
    }

    // ---- 7. editor: live student preview, derived hint, page picker, chips -------------------------
    {
      const { context, page, questionPosts } = await session();
      await tab(page, 'بنك الأسئلة');
      const target = real.questions.find((q) => q.stage === 'middle');
      await page.locator(`li[data-question="${target.id}"] .q-title button`).click();
      const editor = page.locator('.question-editor');
      await editor.waitFor();
      assert.equal(await editor.getByLabel('بداية التلميح PDF').count(), 0, 'no hint start input');
      assert.equal(await editor.getByLabel('نهاية التلميح PDF').count(), 0, 'no hint end input');
      const preview = page.locator('.question-preview');
      assert.ok((await preview.innerText()).includes(target.title));
      assert.equal(
        await preview.locator('.answer-option.correct').count(),
        1,
        'the correct option is marked',
      );
      const chipText = await preview.locator('.answer-feedback .source-page-chip').innerText();
      assert.ok(
        chipText.replace(/\s+/g, ' ').includes(`افتح الصفحة ${target.pdfPage}`),
        JSON.stringify(chipText) + ' vs ' + target.pdfPage,
      );
      assert.equal(
        await preview
          .locator('input')
          .evaluateAll((els) => els.every((el) => el.disabled || el.readOnly)),
        true,
        'read only',
      );
      await editor.getByLabel('النص').fill('ما الذي يعبّر عن الانتماء الحقيقي للوطن؟');
      assert.ok(
        (await preview.innerText()).includes('ما الذي يعبّر عن الانتماء الحقيقي للوطن؟'),
        'live preview',
      );
      await editor
        .getByLabel('التفسير بعد التثبيت في الوضع التعليمي')
        .fill('لأن الانتماء عمل ومسؤولية.');
      assert.ok((await preview.innerText()).includes('لأن الانتماء عمل ومسؤولية.'));
      // The page picker: stepper, real PDF page, "make this the source page".
      const viewer = page.locator('.page-viewer');
      await viewer.locator('canvas:not([hidden])').waitFor({ timeout: 20000 });
      const painted = async () =>
        viewer.locator('canvas').evaluate((c) => {
          const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let dark = 0;
          for (let i = 0; i < data.length; i += 64) if (data[i] < 120) dark += 1;
          return dark;
        });
      await viewer.getByLabel('رقم الصفحة').fill('10');
      await viewer.locator('canvas:not([hidden])').waitFor();
      await page.waitForTimeout(800);
      assert.ok((await painted()) > 20, 'page 10 renders real content');
      await viewer.getByRole('button', { name: 'اجعلها صفحة المصدر' }).click();
      assert.equal(await editor.getByLabel('صفحة المصدر (PDF)').inputValue(), '10');
      assert.equal(
        await viewer.getByRole('button', { name: 'هذه صفحة المصدر' }).isDisabled(),
        true,
      );
      assert.ok(
        (await page.getByTestId('hint-derived').innerText())
          .replace(/\s+/g, ' ')
          .includes('الصفحة 9 والصفحة 10'),
      );
      assert.ok((await preview.innerText()).replace(/\s+/g, ' ').includes('افتح الصفحة 10'));
      await preview.getByRole('button', { name: /افتح الصفحة 10/ }).click();
      await viewer.getByRole('button', { name: 'الصفحة التالية' }).click();
      assert.equal(await viewer.getByLabel('رقم الصفحة').inputValue(), '11');
      // Validation chips block an invalid save.
      const chips = () => editor.locator('.check-chips li').allInnerTexts();
      assert.ok((await chips()).every((c) => !/ناقصة|خارج|آخر صفحة/.test(c)));
      await editor.getByLabel('الخيار 2').fill(await editor.getByLabel('الخيار 1').inputValue());
      assert.ok((await chips()).includes('خيارات ناقصة أو مكررة'));
      assert.equal(
        await editor.getByRole('button', { name: 'حفظ مسودة إصدار جديد' }).isDisabled(),
        true,
      );
      await editor.getByLabel('الخيار 2').fill('خيار مختلف تمامًا');
      await editor.getByLabel('صفحة المصدر (PDF)').fill('66');
      assert.ok(
        (await chips()).some((c) => c.includes('آخر صفحة')),
        'last-page warning',
      );
      assert.equal(
        await editor.getByRole('button', { name: 'حفظ مسودة إصدار جديد' }).isDisabled(),
        true,
      );
      await editor.getByLabel('صفحة المصدر (PDF)').fill('12');
      await editor.getByRole('button', { name: 'حفظ مسودة إصدار جديد' }).click();
      await page.waitForFunction(() => !document.querySelector('.question-editor'));
      assert.equal(questionPosts.length, 1);
      const saved = questionPosts[0];
      assert.equal(saved.pdfPage, 12);
      assert.equal(saved.hintPdfPageStart, 11, 'hint start is written on save');
      assert.equal(saved.hintPdfPageEnd, 12, 'hint end is written on save');
      assert.equal(saved.title, 'ما الذي يعبّر عن الانتماء الحقيقي للوطن؟');
      await context.close();
      console.log(
        'PASS editor: live student preview, no hint inputs, derived hint saved, page picker, chips block bad saves',
      );
    }
    {
      // A first-page source writes max(1, page - 1).
      const { context, page, questionPosts } = await session();
      await tab(page, 'بنك الأسئلة');
      await page.getByRole('button', { name: 'إضافة سؤال' }).click();
      const editor = page.locator('.question-editor');
      await editor.getByLabel('النص').fill('سؤال جديد للتجربة؟');
      for (const [i, value] of ['أول', 'ثان', 'ثالث', 'رابع'].entries())
        await editor.getByLabel(`الخيار ${i + 1}`, { exact: true }).fill(value);
      await editor.getByLabel('شاهد المصدر، للجنة فقط').fill('شاهد');
      await editor.getByRole('button', { name: 'حفظ مسودة إصدار جديد' }).click();
      await page.waitForFunction(() => !document.querySelector('.question-editor'));
      assert.equal(questionPosts[0].hintPdfPageStart, 1);
      assert.equal(questionPosts[0].hintPdfPageEnd, 1);
      await context.close();
    }

    // ---- 8. admin-only search: honest about this book -------------------------------------------------
    {
      const { context, page } = await session();
      const loaded = [];
      page.on('response', (response) => {
        if (/\/_next\/static\/.*\.js/.test(response.url())) loaded.push(response.url());
      });
      await tab(page, 'بنك الأسئلة');
      await page.locator(`li[data-question] .q-title button`).first().click();
      const viewer = page.locator('.page-viewer');
      await viewer.locator('canvas:not([hidden])').waitFor({ timeout: 20000 });
      const before = loaded.length;
      await viewer.locator('summary', { hasText: 'بحث في الكتاب' }).click();
      const state = page.locator('[data-search]');
      await state.waitFor({ timeout: 60000 });
      assert.equal(await state.getAttribute('data-search'), 'unavailable');
      const message = await state.innerText();
      assert.ok(message.includes('البحث غير متاح لهذا الكتاب'), message);
      assert.ok(/\d+ من 66 صفحة فقط قابلة للبحث/.test(message), message);
      assert.equal(
        await viewer.locator('input[type="search"]').count(),
        0,
        'no search box that silently finds nothing',
      );
      assert.ok(loaded.length > before, 'the search code loads only when asked');
      await page.screenshot({ path: path.join(output, 'search-unavailable.png') });
      await context.close();
      console.log(
        'PASS admin search reports "unavailable" for this book instead of returning nothing',
      );
    }
    {
      // The participant screens never load the search chunk or text indexing.
      const searchChunks = [];
      const dir = path.resolve('.next/static');
      const walk = (folder) => {
        for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
          const full = path.join(folder, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (entry.name.endsWith('.js')) {
            const text = fs.readFileSync(full, 'utf8');
            if (text.includes('getTextContent') || text.includes('البحث غير متاح لهذا الكتاب'))
              searchChunks.push(entry.name);
          }
        }
      };
      walk(dir);
      assert.ok(searchChunks.length > 0, 'the admin search chunk exists in the build');
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      const requested = [];
      page.on('request', (request) => requested.push(request.url()));
      for (const route of ['/participate', '/book', '/']) {
        await page.goto(base + route);
        await page.waitForTimeout(1500);
      }
      const leaked = requested.filter((url) => searchChunks.some((name) => url.includes(name)));
      // pdf.js ships getTextContent too; only chunks unique to the search UI count as a leak.
      const searchOnly = leaked.filter((url) => {
        const name = searchChunks.find((n) => url.includes(n));
        return fs
          .readdirSync(dir, { recursive: true })
          .some(
            (file) =>
              String(file).endsWith(name) &&
              fs
                .readFileSync(path.join(dir, String(file)), 'utf8')
                .includes('البحث غير متاح لهذا الكتاب'),
          );
      });
      assert.deepEqual(searchOnly, [], 'participant routes must not load the admin search');
      await context.close();
      console.log('PASS participant routes never request the admin search chunk');
    }

    // ---- 9. coverage strip ---------------------------------------------------------------------------------
    {
      const { context, page } = await session({
        questions: (qs) => {
          qs.forEach((q, i) => (q.pdfPage = 5 + (i % 12)));
          for (const q of qs.slice(0, 4)) q.pdfPage = 20;
        },
      });
      await tab(page, 'تغطية الكتاب');
      const cells = page.locator('.coverage-cell-strip');
      assert.equal(await cells.count(), 66, 'one cell per page');
      assert.ok(
        await cells.nth(19).evaluate((el) => el.classList.contains('level-3')),
        'crowded page',
      );
      assert.ok(
        await cells.nth(0).evaluate((el) => el.classList.contains('level-0')),
        'empty page',
      );
      assert.ok((await page.locator('.admin-panel').innerText()).includes('صفحة بلا أسئلة'));
      await cells.nth(19).click();
      const detail = page.locator('.coverage-detail');
      assert.ok((await detail.innerText()).includes('20'));
      assert.ok((await detail.locator('li').count()) >= 4);
      assert.equal(await page.locator('.coverage-grid').count(), 0, 'the 66-box grid is gone');
      const box = await page.locator('.coverage-strip').boundingBox();
      assert.ok(box.height < 80, 'a single strip, not a grid');
      await page.screenshot({
        path: path.join(output, 'coverage-strip-1366.png'),
        fullPage: false,
      });
      await context.close();
      console.log('PASS coverage density strip with per-page detail');
    }

    // ---- 10. viewports and identities ----------------------------------------------------------------------
    const sizes = [
      [1366, 768],
      [1280, 720],
      [1024, 768],
      [430, 932],
      [390, 844],
      [360, 740],
      [320, 740],
    ];
    for (const design of ['original', 'official', 'hybrid'])
      for (const [width, height] of sizes) {
        const phone = width < 820;
        const { context, page } = await session(
          {
            competition: {
              frozenAt: iso(Date.now() - DAY),
              opensAt: future(8),
              closesAt: future(22),
            },
          },
          { viewport: { width, height }, phone, design },
        );
        await openLaunch(page);
        await page.evaluate(() => document.fonts.ready);
        await noOverflow(page, `launch ${design} ${width}`);
        const box = await primary(page).boundingBox();
        assert.ok(
          box && box.width > 120 && box.height >= 44,
          `primary action usable ${design} ${width}`,
        );
        if (design === 'official' || width === 390 || width === 1366)
          await page.screenshot({
            path: path.join(output, `launch-${design}-${width}.png`),
            fullPage: true,
          });
        await tab(page, 'بنك الأسئلة');
        await page.locator('.question-workshop').waitFor();
        await noOverflow(page, `bank ${design} ${width}`);
        await page.locator('.question-list > li[data-question] .q-title button').first().click();
        await page.locator('.question-editor').waitFor();
        await noOverflow(page, `editor ${design} ${width}`);
        if (width === 390 || width === 1366)
          await page.screenshot({ path: path.join(output, `editor-${design}-${width}.png`) });
        await tab(page, 'تغطية الكتاب');
        await page.locator('.coverage-strip').waitFor();
        await noOverflow(page, `coverage ${design} ${width}`);
        await context.close();
      }
    console.log(
      'PASS launch control, workshop and coverage at 7 viewports x 3 identities, no horizontal scroll',
    );

    // ---- 11. reduced motion: the hold still works, nothing animates ----------------------------------------
    {
      const { context, page, posts } = await session(
        { competition: { frozenAt: iso(Date.now() - DAY) } },
        { reduced: true },
      );
      await openLaunch(page);
      const button = primary(page);
      const duration = await button
        .locator('.hold-fill')
        .evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
      assert.ok(duration <= 0.001, 'no fill animation under reduced motion: ' + duration);
      await pointOn(page, button);
      await page.mouse.down();
      await page.waitForTimeout(1500);
      await page.mouse.up();
      await page.waitForFunction(
        () => document.querySelector('.launch-track [aria-current]')?.textContent === 'مفتوحة',
      );
      assert.equal(posts.length, 1);
      await context.close();
      console.log('PASS reduced motion keeps the hold semantic without fill animation');
    }

    // ---- 12. a real lifecycle on the disposable demo (mutating; keep last) ----------------------------------
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', (error) => problems.push('pageerror: ' + error.message));
      await page.goto(base + '/admin');
      await page.getByRole('button', { name: 'دخول عرض اللجنة' }).click();
      await openLaunch(page);
      const hold = async (ms = 1500) => {
        await pointOn(page, primary(page));
        await page.mouse.down();
        await page.waitForTimeout(ms);
        await page.mouse.up();
      };
      const step = (label) =>
        page.waitForFunction(
          (value) => document.querySelector('.launch-track [aria-current]')?.textContent === value,
          label,
          { timeout: 15000 },
        );
      const start = await page.locator('.launch-track [aria-current]').innerText();
      assert.equal(start, 'مسودة');
      await primary(page).click();
      await step('الأسئلة معتمدة');
      // Closing policy "immediate" lets the results be published straight after closing.
      await page.getByText('إيقاف فوري', { exact: true }).click();
      await page.getByRole('button', { name: 'حفظ الإعدادات' }).click();
      await page.locator('.admin-toast').waitFor({ state: 'visible' });
      await hold();
      await step('مفتوحة');
      await hold();
      await step('مغلقة');
      await primary(page).click();
      await step('النتائج منشورة');
      assert.ok((await launchText(page)).includes('الخطوة التالية: النتائج منشورة'));
      await hold();
      await step('مغلقة');
      assert.ok(!stateCodes.test(await launchText(page)));
      await page.screenshot({ path: path.join(output, 'lifecycle-final.png') });
      await context.close();
      console.log(
        'PASS real lifecycle: freeze, save policy, hold-open, hold-close, publish, hold-unpublish',
      );
    }
    assert.deepEqual(problems, []);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
