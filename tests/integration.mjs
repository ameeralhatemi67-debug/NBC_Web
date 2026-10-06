import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
const root = process.cwd();
const dataDir = await mkdtemp(path.join(tmpdir(), 'nbc-exam-integration-'));
const base = 'http://127.0.0.1:43187';
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '43187'],
  {
    cwd: root,
    env: {
      ...process.env,
      NBC_DATA_DIR: dataDir,
      NBC_RUNTIME_MODE: 'test',
      OTP_PROVIDER: 'fake',
      NBC_DEMO_OTP: '739281',
      DATABASE_URL: '',
      VERCEL: '',
      NBC_DEMO_MODE: 'true',
      NBC_ALLOW_REMOTE_DEMO: 'false',
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let logs = '';
server.on('exit', (code, signal) => {
  logs += `\nServer exit: ${code}, ${signal}`;
});
server.stdout.on('data', (b) => (logs += b));
server.stderr.on('data', (b) => (logs += b));
const results = [];
const check = (name, fn) => {
  fn();
  results.push({ name, passed: true });
  console.log('PASS', name);
};
function client() {
  let cookie = '';
  return async (route, body, extra = {}) => {
    const response = await fetch(base + '/api/' + route, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json', Origin: base } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = response.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const raw = new Uint8Array(await response.arrayBuffer());
    const text = new TextDecoder().decode(raw);
    const data = response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
    return { status: response.status, data, text, raw };
  };
}
try {
  let ready = false;
  let readyError = '';
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(base + '/api/session');
      if (r.ok) {
        ready = true;
        break;
      }
      readyError = String(r.status) + ' ' + (await r.text());
    } catch (e) {
      readyError = String(e.cause ?? e);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(ready, logs + '\n' + readyError);
  const publicBook = await fetch(base + '/documents/national-belonging.pdf');
  const bookBytes = new Uint8Array(await publicBook.arrayBuffer());
  check('public book is the complete supplied PDF, available without login', () => {
    assert.equal(publicBook.status, 200);
    assert.equal(publicBook.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(publicBook.headers.get('content-security-policy'), "frame-ancestors 'self'");
    assert.match(publicBook.headers.get('content-type'), /application\/pdf/);
    assert.equal(
      createHash('sha256').update(bookBytes).digest('hex'),
      'ec07ef57e563ada8bba244317aeeef0e34c8caa0ea7e10bee228232615db79fd',
    );
  });
  const rulesFile = await fetch(base + '/documents/participation-rules.pdf');
  const rulesBytes = new Uint8Array(await rulesFile.arrayBuffer());
  const termsPage = await fetch(base + '/terms');
  const termsText = await termsPage.text();
  check('registration terms and current answer policy are available without login', () => {
    assert.equal(termsPage.status, 200);
    assert.equal(termsPage.headers.get('x-frame-options'), 'DENY');
    assert.equal(rulesFile.status, 200);
    assert.equal(new TextDecoder().decode(rulesBytes.slice(0, 5)), '%PDF-');
    assert.ok(termsText.includes('لا يعتمد الوقت معيارًا للمفاضلة'));
    assert.ok(termsText.includes('تظهر الإجابة الصحيحة والتوضيح بعد تثبيت'));
  });
  const anon = client(),
    student = client(),
    admin = client(),
    editor = client();
  const forbidden = await anon('admin');
  check('unauthenticated admin access rejected', () => assert.equal(forbidden.status, 401));
  const csrf = await anon(
    'auth/demo-staff',
    { role: 'admin' },
    { Origin: 'https://untrusted.example' },
  );
  check('foreign origin rejected', () => assert.equal(csrf.status, 403));
  const staff = await admin('auth/demo-staff', { role: 'admin' });
  check('explicit local demo staff session works', () => assert.equal(staff.status, 200));
  const seed = await admin('admin');
  const initialPrizes = seed.data.prizes;
  const changedPrizes = structuredClone(initialPrizes);
  changedPrizes.stages[0].awards = [4500, 3000, 2000, 950, 850, 750];
  changedPrizes.layout = 'ledger';
  const anonPrizes = await anon('admin/prizes', changedPrizes);
  await editor('auth/demo-staff', { role: 'editor' });
  const editorPrizes = await editor('admin/prizes', changedPrizes);
  const invalidPrizes = await admin('admin/prizes', { ...changedPrizes, mediaPrize: -1 });
  const savedPrizes = await admin('admin/prizes', changedPrizes);
  const stalePrizes = await admin('admin/prizes', changedPrizes);
  const prizesState = await admin('admin');
  const homePrizes = await (await fetch(base)).text();
  check(
    'prize changes enforce admin role, amounts and version, persist and reach public page',
    () => {
      assert.equal(anonPrizes.status, 401);
      assert.equal(editorPrizes.status, 403);
      assert.equal(invalidPrizes.status, 400);
      assert.equal(savedPrizes.status, 200);
      assert.ok(savedPrizes.data.prizes, 'Save response must contain committed prize settings');
      assert.equal(savedPrizes.data.prizes.version, initialPrizes.version + 1);
      assert.deepEqual(savedPrizes.data.prizes.stages[0].awards, changedPrizes.stages[0].awards);
      assert.equal(stalePrizes.status, 409);
      assert.deepEqual(prizesState.data.prizes.stages[0].awards, changedPrizes.stages[0].awards);
      assert.ok(homePrizes.includes('prize-layout-ledger'));
      assert.ok(homePrizes.includes('4,500'));
      assert.ok(
        homePrizes.includes('950') && homePrizes.includes('850') && homePrizes.includes('750'),
      );
      assert.ok(prizesState.data.audit.some((entry) => entry.action === 'تعديل الجوائز'));
    },
  );
  const savedAgain = await admin('admin/prizes', { ...savedPrizes.data.prizes, layout: 'podium' });
  const rereadPrizes = await admin('admin');
  check('a second save uses the committed version and survives a fresh admin read', () => {
    assert.equal(savedAgain.status, 200);
    assert.equal(savedAgain.data.prizes.version, initialPrizes.version + 2);
    assert.equal(savedAgain.data.prizes.layout, 'podium');
    assert.deepEqual(rereadPrizes.data.prizes, savedAgain.data.prizes);
  });
  check('seed report reconciles', () => {
    assert.equal(seed.data.participants.length, 6);
    assert.equal(seed.data.participants.filter((p) => p.submitted_at).length, 0);
    assert.equal(seed.data.questions.length, 60);
  });
  const payload = {
    name: 'مشارك اختبار أحمد صالح',
    identity: '١٩٩٩٩٩٩٩٩٩',
    phone: '٠٥٩٩٩٩٩٩٩٩',
    stage: 'المرحلة المتوسطة',
    institution: 'مدرسة الاختبار الافتراضية',
    gender: 'أنثى',
    mode: 'register',
    locality: 'الدمام',
    terms: true,
  };
  for (const institution of [undefined, '   ', 'س'.repeat(161), { name: 'مدرسة' }]) {
    const invalid = await student('auth/challenge', { ...payload, institution });
    assert.equal(invalid.status, 400);
  }
  check('institution is required, bounded and must be text', () => {});
  for (const gender of [undefined, '', 'غير محدد', { value: 'ذكر' }]) {
    const invalid = await student('auth/challenge', { ...payload, gender });
    assert.equal(invalid.status, 400);
  }
  for (const locality of [undefined, '', 'الرياض', 'جدة', { value: 'الدمام' }]) {
    const invalid = await student('auth/challenge', { ...payload, locality });
    assert.equal(invalid.status, 400);
  }
  check('registration requires a valid gender and an Eastern Province city', () => {});
  const challenge = await student('auth/challenge', payload);
  check('Arabic digits accepted in registration', () => assert.equal(challenge.status, 200));
  const bad = await student('auth/verify', {
    challengeId: challenge.data.challengeId,
    purpose: 'REGISTER',
    code: '000000',
  });
  check('wrong verification code rejected', () => assert.equal(bad.status, 400));
  const verified = await student('auth/verify', {
    challengeId: challenge.data.challengeId,
    purpose: 'REGISTER',
    code: '739281',
  });
  check('simulated OTP establishes participant session', () => assert.equal(verified.status, 200));
  const profile = await student('participant');
  check('institution survives verification and reaches the participant profile', () =>
    assert.equal(profile.data.participant.institution, payload.institution),
  );
  check('gender and Eastern Province city survive verification', () => {
    assert.equal(profile.data.participant.gender, payload.gender);
    assert.equal(profile.data.participant.locality, payload.locality);
    assert.equal(profile.data.participant.region, 'الشرقية');
  });
  const reuse = await anon('auth/verify', {
    challengeId: challenge.data.challengeId,
    purpose: 'REGISTER',
    code: '739281',
  });
  check('verification challenge is single use', () => assert.equal(reuse.status, 400));
  const duplicate = await anon('auth/challenge', payload);
  check('duplicate identity registration rejected', () => assert.equal(duplicate.status, 400));
  const nonadmin = await student('admin');
  check('participant cannot read admin data', () => assert.equal(nonadmin.status, 403));
  async function competitionAction(action, extra = {}) {
    const c = (await admin('admin')).data.competition;
    const r = await admin('admin/competition', { action, version: c.version, ...extra });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return r;
  }
  assert.equal((await student('attempt/start', {})).status, 409);
  await competitionAction('freeze');
  await competitionAction('open');
  assert.equal((await student('attempt/start', { stage: 'university' })).status, 400);
  check('server lifecycle and registered stage cannot be bypassed', () => {});
  const attempts = await Promise.all([student('attempt/start', {}), student('attempt/start', {})]);
  check('concurrent starts return one stable 20-question stage form', () => {
    assert.equal(attempts[0].status, 200);
    assert.equal(attempts[0].data.attempt.id, attempts[1].data.attempt.id);
    assert.deepEqual(attempts[0].data.attempt.questions, attempts[1].data.attempt.questions);
    assert.equal(attempts[0].data.attempt.questions.length, 20);
    assert.ok(attempts[0].data.attempt.questions.every((q) => q.stage === 'middle'));
  });
  const form = attempts[0].data.attempt;
  check('unchecked payload excludes keys and explanations', () => {
    assert.equal(JSON.stringify(form).includes('"correct"'), false);
    assert.equal(JSON.stringify(form).includes('correctAnswers'), false);
    assert.deepEqual(form.feedback, {});
  });
  function write(c, state, kind, questionId, selected, id = randomUUID()) {
    return c('attempt/event', {
      clientEventId: id,
      attemptId: state.attempt.id,
      revision: state.attempt.revision,
      kind,
      questionId,
      selected,
    });
  }
  const invalid = await write(student, attempts[0].data, 'CHECK', 'forged', [0]);
  assert.equal(invalid.status, 400);
  const racing = await Promise.all([
    write(student, attempts[0].data, 'SELECT', form.questions[0].id, [0]),
    write(student, attempts[0].data, 'SELECT', form.questions[1].id, [1]),
  ]);
  check('stale concurrent selections are rejected', () =>
    assert.deepEqual(racing.map((r) => r.status).sort(), [200, 409]),
  );
  let state = (await student('participant')).data;
  assert.equal(state.attempt.revision, 1);
  const editorData = await editor('admin');
  check('editor sees bank and cannot see participant/audit data', () => {
    assert.equal(editorData.data.participants.length, 0);
    assert.equal(editorData.data.audit.length, 0);
  });
  const q = editorData.data.questions.find((q) => q.id === form.questions[0].id);
  assert.equal(
    (
      await editor('admin/question', {
        ...q,
        title: 'سؤال معدل في نسخة مسودة لا تؤثر على المحاولة',
        correctAnswers: [1],
      })
    ).status,
    200,
  );
  assert.equal(
    (await editor('admin/question', { id: q.id, version: 2, approve: true })).status,
    403,
  );
  assert.equal((await editor('export')).status, 403);
  assert.equal((await editor('admin/publish', { published: true })).status, 403);
  assert.equal((await editor('admin/test-run/start', { stage: 'middle' })).status, 403);
  await admin('admin/question', { id: q.id, version: 2, approve: true });
  check('existing attempt keeps frozen question versions', () =>
    assert.equal(state.attempt.questions.find((item) => item.id === q.id).version, 1),
  );
  for (const item of form.questions) {
    const original = seed.data.questions.find((q) => q.id === item.id);
    const selected = [item.options.indexOf(original.options[original.correctAnswers[0]])];
    const id = randomUUID();
    const checked = await write(student, state, 'CHECK', item.id, selected, id);
    assert.equal(checked.status, 200, checked.text);
    state = checked.data;
    const repeat = await write(student, state, 'CHECK', item.id, selected, id);
    assert.equal(repeat.status, 200);
    assert.equal(repeat.data.attempt.revision, state.attempt.revision);
    assert.equal(
      (await write(student, state, 'CHECK', item.id, [(selected[0] + 1) % 4])).status,
      409,
    );
  }
  check('check answer locks permanently and duplicate events are idempotent', () => {});
  const final = await Promise.all([
    write(student, state, 'SUBMIT'),
    write(student, state, 'SUBMIT'),
  ]);
  check(
    'repeated final submit has one receipt, server score, percentage and participant number',
    () => {
      assert.equal(final[0].status, 200);
      assert.equal(final[1].status, 200);
      assert.equal(final[0].data.attempt.receipt, final[1].data.attempt.receipt);
      assert.equal(final[0].data.attempt.score, 20);
      assert.equal(final[0].data.attempt.percentage, 100);
      assert.match(final[0].data.attempt.participantNumber, /^\d{6,8}$/);
    },
  );
  assert.equal(
    (await write(student, final[0].data, 'SELECT', form.questions[0].id, [0])).status,
    409,
  );
  const completed = await admin('admin');
  check('scoring still uses frozen key after edits', () =>
    assert.equal(completed.data.participants.find((p) => p.name === payload.name).score, 20),
  );
  const reminders = await admin('admin/reminders', {});
  check('reminder preview excludes completed participant and never sends', () => {
    assert.equal(
      reminders.data.recipients.some((p) => p.name === payload.name),
      false,
    );
    assert.equal(reminders.data.sent, false);
  });
  const report = await admin(
    'export?' + new URLSearchParams({ stage: payload.stage, region: 'الشرقية' }),
  );
  const expected = completed.data.participants.filter(
    (p) => p.stage === payload.stage && p.region === 'الشرقية',
  );
  check('filtered report matches active campaign cohort', () => {
    assert.equal(report.status, 200);
    assert.equal(report.text.trim().split('\r\n').length - 1, expected.length);
    assert.ok(report.text.includes(payload.institution));
  });
  const mixedReport = await admin(
    'export?' +
      new URLSearchParams({
        gender: payload.gender,
        institution: payload.institution,
        locality: payload.locality,
        status: 'completed',
        minScore: '0',
        maxScore: '100',
      }),
  );
  check('combined analytics filters retain the right participant', () => {
    assert.equal(mixedReport.text.trim().split('\r\n').length - 1, 1);
    assert.ok(mixedReport.text.includes(payload.institution));
  });
  assert.equal((await anon('leaderboard?stage=middle')).status, 403);
  const c = (await admin('admin')).data.competition;
  await competitionAction('settings', { ...c, closingPolicy: 'immediate' });
  await competitionAction('close');
  await competitionAction('publish');
  const board = await anon('leaderboard?stage=middle');
  check('published leaderboard is stage-specific and uses participant number', () => {
    assert.equal(board.status, 200);
    assert.equal(board.data.entries.length, 1);
    assert.equal(board.data.entries[0].participantNumber, final[0].data.attempt.participantNumber);
    assert.equal(JSON.stringify(board.data).includes(payload.name), false);
  });
  assert.equal((await anon('leaderboard?stage=university')).data.entries.length, 0);
  const beforeTest = await admin('admin');
  let run = (await admin('admin/test-run/start', { stage: 'middle', reveal: true })).data;
  for (const item of run.attempt.questions) {
    const original = seed.data.questions.find((q) => q.id === item.id);
    const selected = [item.options.indexOf(original.options[original.correctAnswers[0]])];
    const r = await admin('admin/test-run/event', {
      clientEventId: randomUUID(),
      attemptId: run.attempt.id,
      revision: run.attempt.revision,
      kind: 'CHECK',
      questionId: item.id,
      selected,
    });
    assert.equal(r.status, 200);
    run = r.data;
  }
  const finishedTest = await admin('admin/test-run/event', {
    clientEventId: randomUUID(),
    attemptId: run.attempt.id,
    revision: run.attempt.revision,
    kind: 'SUBMIT',
  });
  assert.equal(finishedTest.data.attempt.score, 20);
  const reset = await admin('admin/test-run/reset', { id: run.attempt.id });
  assert.notEqual(reset.data.attempt.id, run.attempt.id);
  assert.deepEqual(reset.data.attempt.answers, {});
  const afterTest = await admin('admin');
  check(
    'test runs repeat and reset without reports, leaderboard or publication side effects',
    () => {
      assert.deepEqual(afterTest.data.participants, beforeTest.data.participants);
      assert.deepEqual(afterTest.data.competition, beforeTest.data.competition);
      assert.equal(afterTest.data.published, true);
    },
  );
  assert.equal((await student('admin/test-run?id=' + run.attempt.id)).status, 403);
  assert.equal((await anon('leaderboard?stage=middle')).data.entries.length, 1);
  await competitionAction('unpublish');
  assert.equal((await anon('leaderboard?stage=middle')).status, 403);
  const expiredClient = client();
  const challenge2 = await expiredClient('auth/challenge', {
    mode: 'login',
    identity: '1999999999',
    phone: '0599999999',
  });
  for (let i = 0; i < 5; i++)
    await expiredClient('auth/verify', {
      challengeId: challenge2.data.challengeId,
      purpose: 'LOGIN',
      code: '000000',
    });
  const locked = await expiredClient('auth/verify', {
    challengeId: challenge2.data.challengeId,
    purpose: 'LOGIN',
    code: '739281',
  });
  check('five failed OTP attempts exhaust the challenge', () => assert.equal(locked.status, 400));
  const anonBackup = await anon('admin/backup');
  check('anonymous backup access rejected', () => assert.equal(anonBackup.status, 401));
  const editorBackup = await editor('admin/backup');
  check('editor backup access rejected', () => assert.equal(editorBackup.status, 403));
  const backup = await admin('admin/backup');
  check('administrator can export a compressed database snapshot', () => {
    assert.equal(backup.status, 200);
    assert.equal(backup.raw[0], 31);
    assert.equal(backup.raw[1], 139);
  });
  const backupPath = path.join(dataDir, 'test-backup.tar.gz');
  await writeFile(backupPath, backup.raw);
  const restoredPath = path.join(dataDir, '.data', 'restored');
  const restored = await promisify(execFile)(
    process.execPath,
    [path.join(root, 'scripts/restore.mjs'), backupPath, restoredPath],
    { cwd: dataDir, windowsHide: true },
  );
  const recovery = JSON.parse(restored.stdout.trim());
  check('restore preserves participants and submissions while invalidating sessions', () => {
    assert.equal(recovery.participants, completed.data.participants.length);
    assert.equal(
      recovery.submissions,
      completed.data.participants.filter((p) => p.submitted_at).length + 4,
    );
    assert.equal(recovery.sessionsInvalidated, true);
  });
  await student('auth/logout', {});
  const logout = await student('participant');
  check('logout revokes access', () => assert.equal(logout.status, 401));
  await mkdir('test-results', { recursive: true });
  await writeFile(
    'test-results/integration.json',
    JSON.stringify({ date: new Date().toISOString(), results }, null, 2),
  );
  console.log(`${results.length} integration checks passed.`);
} catch (e) {
  console.error(e);
  console.error(logs);
  process.exitCode = 1;
} finally {
  server.kill();
}
