import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
await mkdir(path.join(root, '.data'), { recursive: true });
const dataDir = await mkdtemp(path.join(root, '.data', 'integration-'));
const base = 'http://127.0.0.1:43187';
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '43187'],
  {
    cwd: root,
    env: {
      ...process.env,
      NBC_DATA_DIR: dataDir,
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
  check('seed report reconciles', () => {
    assert.equal(seed.data.participants.length, 6);
    assert.equal(seed.data.participants.filter((p) => p.submitted_at).length, 4);
  });
  const payload = {
    name: 'مشارك اختبار أحمد صالح',
    identity: '١٩٩٩٩٩٩٩٩٩',
    phone: '٠٥٩٩٩٩٩٩٩٩',
    backup: '',
    stage: 'المرحلة المتوسطة',
    region: 'الرياض',
    locality: 'الرياض',
    village: 'مركز تجريبي',
    terms: true,
  };
  const challenge = await student('auth/challenge', payload);
  check('Arabic digits accepted in registration', () => assert.equal(challenge.status, 200));
  const bad = await student('auth/verify', {
    challengeId: challenge.data.challengeId,
    code: '000000',
  });
  check('wrong verification code rejected', () => assert.equal(bad.status, 400));
  const verified = await student('auth/verify', {
    challengeId: challenge.data.challengeId,
    code: '123456',
  });
  check('simulated OTP establishes participant session', () => assert.equal(verified.status, 200));
  const reuse = await anon('auth/verify', {
    challengeId: challenge.data.challengeId,
    code: '123456',
  });
  check('verification challenge is single use', () => assert.equal(reuse.status, 400));
  const duplicate = await anon('auth/challenge', payload);
  check('duplicate identity registration rejected', () => assert.equal(duplicate.status, 400));
  const nonadmin = await student('admin');
  check('participant cannot read admin data', () => assert.equal(nonadmin.status, 403));
  const attempts = await Promise.all([student('attempt/start', {}), student('attempt/start', {})]);
  check('concurrent starts return one stable form', () => {
    assert.equal(attempts[0].status, 200);
    assert.equal(attempts[0].data.attempt.id, attempts[1].data.attempt.id);
    assert.deepEqual(attempts[0].data.attempt.questions, attempts[1].data.attempt.questions);
  });
  const form = attempts[0].data.attempt;
  check('participant payload never contains correct answers', () =>
    assert.equal(JSON.stringify(form).includes('"correct"'), false),
  );
  const invalid = await student('attempt/save', { answers: { forged: 0 }, revision: 0 });
  check('forged answer rejected', () => assert.equal(invalid.status, 400));
  const racing = await Promise.all([
    student('attempt/save', { answers: { q01: 0 }, revision: 0 }),
    student('attempt/save', { answers: { q02: 1 }, revision: 0 }),
  ]);
  check('stale concurrent save is rejected rather than overwriting', () =>
    assert.deepEqual(racing.map((x) => x.status).sort(), [200, 409]),
  );
  const after = await student('participant');
  check('saved answers and revision survive a separate read', () => {
    assert.equal(after.data.attempt.revision, 1);
    assert.equal(Object.keys(after.data.attempt.answers).length, 1);
  });
  await editor('auth/demo-staff', { role: 'editor' });
  const editorData = await editor('admin');
  check('editor receives content without participant records or audit identities', () => {
    assert.equal(editorData.data.participants.length, 0);
    assert.equal(editorData.data.audit.length, 0);
  });
  const q = editorData.data.questions.find((q) => q.id === 'q01');
  const edit = await editor('admin/question', {
    ...q,
    title: 'سؤال تجريبي معدل للاختبار',
    correct: 1,
  });
  check('editor can create a draft version', () => assert.equal(edit.status, 200));
  const noApprove = await editor('admin/question', { id: 'q01', version: 2, approve: true });
  check('editor cannot approve their own draft', () => assert.equal(noApprove.status, 403));
  const noExport = await editor('export');
  check('editor cannot export participants', () => assert.equal(noExport.status, 403));
  const noPublish = await editor('admin/publish', { published: true });
  check('editor cannot publish grades', () => assert.equal(noPublish.status, 403));
  await admin('admin/question', { id: 'q01', version: 2, approve: true });
  const frozen = await student('participant');
  check('existing attempt retains its original question version', () => {
    assert.equal(frozen.data.attempt.questions.find((q) => q.id === 'q01').version, 1);
  });
  const correct = Object.fromEntries(seed.data.questions.map((q) => [q.id, q.correct]));
  const saved = await student('attempt/save', { answers: correct, revision: 1 });
  assert.equal(saved.status, 200);
  const final = await Promise.all([
    student('attempt/submit', { answers: correct, revision: 2 }),
    student('attempt/submit', { answers: correct, revision: 2 }),
  ]);
  check('repeated concurrent submission returns one receipt', () => {
    assert.equal(final[0].status, 200);
    assert.equal(final[1].status, 200);
    assert.equal(final[0].data.attempt.receipt, final[1].data.attempt.receipt);
  });
  check('score withheld before publication', () => assert.equal(final[0].data.attempt.score, null));
  const mutate = await student('attempt/save', { answers: {}, revision: 3 });
  check('final submission cannot be edited', () => assert.equal(mutate.status, 409));
  const completed = await admin('admin');
  check('scoring uses frozen answer keys after an edit', () =>
    assert.equal(completed.data.participants.find((p) => p.name === payload.name).score, 10),
  );
  const reminders = await admin('admin/reminders', {});
  check('reminder preview excludes newly completed participant and never sends', () => {
    assert.equal(
      reminders.data.recipients.some((p) => p.name === payload.name),
      false,
    );
    assert.equal(reminders.data.sent, false);
  });
  const report = await admin(
    'export?stage=' +
      encodeURIComponent(payload.stage) +
      '&region=' +
      encodeURIComponent(payload.region),
  );
  const expected = completed.data.participants.filter(
    (p) => p.stage === payload.stage && p.region === payload.region,
  );
  check('CSV filters reconcile with the same report cohort', () => {
    assert.equal(report.status, 200);
    assert.equal(report.text.trim().split('\r\n').length - 1, expected.length);
  });
  await admin('admin/publish', { published: true });
  const released = await student('participant');
  check('approved grade is visible without answer keys', () => {
    assert.equal(released.data.attempt.score, 10);
    assert.equal(JSON.stringify(released.data.attempt).includes('"correct"'), false);
  });
  await admin('admin/publish', { published: false });
  const hidden = await student('participant');
  check('grade release can be withdrawn', () => assert.equal(hidden.data.attempt.score, null));
  const expiredClient = client();
  const challenge2 = await expiredClient('auth/challenge', {
    mode: 'login',
    identity: '1999999999',
    phone: '0599999999',
  });
  for (let i = 0; i < 5; i++)
    await expiredClient('auth/verify', {
      challengeId: challenge2.data.challengeId,
      code: '000000',
    });
  const locked = await expiredClient('auth/verify', {
    challengeId: challenge2.data.challengeId,
    code: '123456',
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
  const restoredPath = path.join(root, '.data', 'restored-' + path.basename(dataDir));
  const restored = await promisify(execFile)(
    process.execPath,
    ['scripts/restore.mjs', backupPath, restoredPath],
    { cwd: root, windowsHide: true },
  );
  const recovery = JSON.parse(restored.stdout.trim());
  check('restore preserves participants and submissions while invalidating sessions', () => {
    assert.equal(recovery.participants, completed.data.participants.length);
    assert.equal(
      recovery.submissions,
      completed.data.participants.filter((p) => p.submitted_at).length,
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
