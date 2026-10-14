// Runs the built app with isolated local data and blocked operator environment files.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-results/simulation');
const base = 'http://127.0.0.1:43189';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'nbc-simulation-ui-'));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      /^(PATH|SystemRoot|WINDIR|ComSpec|PATHEXT|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|ProgramFiles|ProgramFiles\(x86\)|SystemDrive)$/i.test(
        key,
      ),
    ),
  );
  Object.assign(env, {
    NBC_RUNTIME_MODE: 'test',
    NBC_OTP_ENABLED: 'false',
    OTP_PROVIDER: 'fake',
    NBC_DEMO_OTP: '739281',
    NBC_DATA_DIR: data,
    DATABASE_URL: '',
    VERCEL: '',
    NEXT_TELEMETRY_DISABLED: '1',
    NODE_OPTIONS: `--require "${path.join(root, 'scripts/local-ux-no-env.cjs').replaceAll('\\', '/')}"`,
  });
  const server = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '43189'],
    { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let logs = '',
    browser;
  server.stdout.on('data', (chunk) => (logs += chunk));
  server.stderr.on('data', (chunk) => (logs += chunk));
  const evidence = [];
  const pass = (name) => {
    evidence.push(name);
    console.log('PASS', name);
  };
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base + '/api/session')).ok) {
          ready = true;
          break;
        }
      } catch {}
      await delay(250);
    }
    assert.ok(ready, logs);
    browser = await chromium.launch({
      headless: true,
      channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge',
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    });
    const post = (ctx, route, body) =>
      ctx.request.post(base + '/api/' + route, { data: body, headers: { Origin: base } });
    assert.equal((await post(context, 'auth/demo-staff', { role: 'admin' })).status(), 200);
    const initial = await (await context.request.get(base + '/api/admin')).json();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base + '/admin');
    const toolbar = page.getByRole('region', { name: 'محاكاة المسابقة' });
    // A named section has a region role.
    await toolbar.getByRole('button', { name: 'بدء المحاكاة', exact: true }).click();
    const slider = page.getByRole('slider', { name: 'موضع المحاكاة' });
    await slider.fill('150');
    await toolbar.getByRole('button', { name: 'إيقاف مؤقت', exact: true }).click();
    const paused = await slider.inputValue();
    await delay(1100);
    assert.equal(await slider.inputValue(), paused);
    await slider.focus();
    await page.keyboard.press('Home');
    assert.equal(await slider.inputValue(), '0');
    await page.keyboard.press('End');
    assert.equal(await slider.inputValue(), '300');
    assert.equal(await toolbar.getByText('اكتملت المحاكاة', { exact: true }).count(), 1);
    assert.equal(
      await page.locator('.stats-grid .stat-card').first().locator('strong').textContent(),
      '240',
    );
    await page.getByRole('button', { name: 'تحليلات المسابقة', exact: true }).click();
    assert.equal(await page.locator('.analytics-summary strong').first().textContent(), '240');
    assert.equal(await page.locator('a[href^="/api/export"]').count(), 0);
    await page.reload();
    await page.getByRole('slider', { name: 'موضع المحاكاة' }).waitFor();
    assert.equal(await page.getByRole('slider', { name: 'موضع المحاكاة' }).inputValue(), '300');
    pass('track seeking, keyboard bounds, pause, chart counts, disabled exports, tabs and refresh');
    for (const design of ['original', 'official', 'hybrid']) {
      await page.evaluate((value) => (document.documentElement.dataset.design = value), design);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({ path: path.join(output, `${design}-desktop.png`), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(output, `${design}-mobile.png`), fullPage: true });
    }
    pass('desktop and mobile in three identities with reduced motion and no horizontal overflow');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await toolbar.getByRole('button', { name: 'فتح نافذة التجربة', exact: true }).click();
    await toolbar.getByText('الدخول إلى التجربة مفتوح', { exact: true }).waitFor();
    const report = await (await context.request.get(base + '/api/admin/simulation')).json();
    assert.ok(report.run.entryOpen);
    assert.equal(Date.parse(report.run.finishUntil) - Date.parse(report.run.entryClosesAt), 900000);
    const runId = report.run.id;
    const publicStatus = await (await fetch(base + '/api/simulation/status')).json();
    assert.ok(!JSON.stringify(publicStatus).includes('correctAnswers'));
    const anon = await browser.newContext();
    assert.equal((await post(anon, 'admin/simulation', { action: 'open' })).status(), 401);
    assert.equal((await post(anon, 'simulation/start', { runId })).status(), 401);
    const editor = await browser.newContext();
    await post(editor, 'auth/demo-staff', { role: 'editor' });
    assert.equal((await post(editor, 'admin/simulation', { action: 'open' })).status(), 403);
    const student = await browser.newContext();
    const registration = await post(student, 'auth/direct', {
      mode: 'register',
      identity: '1999999001',
      phone: '0553333001',
      name: 'مشارك تجربة موقع معزول',
      stage: 'المرحلة المتوسطة',
      institution: 'مدرسة اختبار معزولة',
      gender: 'ذكر',
      locality: 'الدمام',
      terms: true,
    });
    assert.equal(registration.status(), 200, await registration.text());
    const studentPage = await student.newPage();
    studentPage.on('pageerror', (error) => errors.push(error.message));
    await studentPage.goto(base + `/participate?practice=${runId}`);
    await studentPage.getByRole('button', { name: 'انتقل إلى الأسئلة', exact: true }).click();
    await studentPage.locator('.competition-heading').waitFor();
    assert.ok((await studentPage.locator('.practice-banner').textContent()).includes('لا تُحتسب'));
    let state = await (
      await student.request.get(base + `/api/simulation/participant?runId=${runId}`)
    ).json();
    assert.equal(state.attempt.questions.length, 20);
    assert.ok(!JSON.stringify(state).includes('correctAnswers'));
    await studentPage.reload();
    await studentPage.locator('.competition-heading').waitFor();
    const resumed = await (
      await student.request.get(base + `/api/simulation/participant?runId=${runId}`)
    ).json();
    assert.equal(resumed.attempt.id, state.attempt.id);
    assert.deepEqual(resumed.attempt.questions, state.attempt.questions);
    assert.equal(
      (
        await post(anon, 'simulation/event', {
          attemptId: state.attempt.id,
          revision: 0,
          kind: 'SELECT',
          questionId: state.attempt.questions[0].id,
          selected: [0],
          clientEventId: randomUUID(),
        })
      ).status(),
      401,
    );
    // Local fixture banks have no source-reading gate. Production bank reading gates are
    // exercised for all 75 supplied questions by simulation.test.ts on both adapters.
    for (const q of state.attempt.questions) {
      const original = initial.questions.find((item) => item.id === q.id);
      const selected = original.correctAnswers.map((index) =>
        q.options.indexOf(original.options[index]),
      );
      const saved = await post(student, 'simulation/event', {
        attemptId: state.attempt.id,
        revision: state.attempt.revision,
        kind: 'SELECT',
        questionId: q.id,
        selected,
        clientEventId: randomUUID(),
      });
      assert.equal(saved.status(), 200, await saved.text());
      state = await saved.json();
    }
    const submitted = await post(student, 'simulation/event', {
      attemptId: state.attempt.id,
      revision: state.attempt.revision,
      kind: 'SUBMIT',
      clientEventId: randomUUID(),
    });
    assert.equal(submitted.status(), 200, await submitted.text());
    state = await submitted.json();
    assert.equal(state.attempt.percentage, 100);
    assert.deepEqual(state.attempt.answers, {});
    assert.deepEqual(state.attempt.feedback, {});
    await studentPage.reload();
    await studentPage.locator('.result-screen').waitFor();
    assert.equal(await studentPage.locator('.leaderboard').count(), 0);
    await studentPage.screenshot({
      path: path.join(output, 'practice-result.png'),
      fullPage: true,
    });
    await toolbar.getByRole('combobox').selectOption('practice');
    await page.getByRole('button', { name: 'تحليلات المسابقة', exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('.analytics-summary strong')?.textContent === '1',
    );
    pass(
      'registered participant enters real exam, resumes, submits, and appears in automatically refreshed practice charts',
    );
    await toolbar.getByRole('button', { name: 'إنهاء المحاكاة', exact: true }).click();
    await toolbar.getByRole('button', { name: 'بدء المحاكاة', exact: true }).waitFor();
    const closed = await (await context.request.get(base + '/api/admin/simulation')).json();
    assert.equal(closed.run.entryOpen, false);
    assert.equal(closed.run.canFinish, true);
    assert.equal(Date.parse(closed.run.finishUntil) - Date.parse(closed.run.entryClosesAt), 900000);
    const actual = await (await context.request.get(base + '/api/admin')).json();
    assert.deepEqual(actual.competition, initial.competition);
    assert.equal(
      actual.participants.filter((p) => p.attempt_id).length,
      initial.participants.filter((p) => p.attempt_id).length,
    );
    assert.equal((await post(student, 'attempt/start', {})).status(), 409);
    const pointers = await studentPage.evaluate(
      (run) =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open('nbc-competition-v1', 1);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction('sessions', 'readonly');
            const store = transaction.objectStore('sessions');
            const official = store.get('participant-active'),
              practice = store.get('simulation-active:' + run);
            transaction.oncomplete = () => {
              resolve({ official: official.result ?? null, practice: practice.result ?? null });
              db.close();
            };
            transaction.onerror = () => reject(transaction.error);
          };
        }),
      runId,
    );
    assert.equal(pointers.official, null);
    assert.equal(pointers.practice, `simulation:${runId}:${state.attempt.id}`);
    assert.deepEqual(errors, []);
    pass(
      'end closes admission with 15-minute grace, leaves official state/results unchanged, and produces no browser errors',
    );
    await fs.promises.writeFile(
      path.join(output, 'verification.json'),
      JSON.stringify({ passed: evidence, errors, run: closed.run }, null, 2),
    );
  } finally {
    if (browser) await browser.close();
    server.kill();
    await fs.promises.writeFile(path.join(output, 'server.log'), logs);
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
