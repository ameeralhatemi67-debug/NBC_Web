// Synthetic local OAuth configuration only. Run through scripts/local-ux-check.cjs.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = 'http://127.0.0.1:43187';
assert.ok(process.env.NBC_DATA_DIR, 'Disposable NBC_DATA_DIR required');
assert.ok(!path.resolve(process.env.NBC_DATA_DIR).startsWith(process.cwd()));
const server = spawn(
  process.execPath,
  [
    '--import',
    './tests/mock-vercel-network.mjs',
    'node_modules/next/dist/bin/next',
    'start',
    '-H',
    '127.0.0.1',
    '-p',
    '43187',
  ],
  {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NBC_RUNTIME_MODE: 'production',
      VERCEL: '1',
      DATABASE_URL: '',
      NBC_STAFF_AUTH: 'vercel',
      VERCEL_APP_CLIENT_ID: 'test-client',
      NBC_STAFF_SESSION_SECRET: randomBytes(32).toString('hex'),
      NBC_VERCEL_ADMIN_SUBJECTS: 'owner',
      NBC_STAFF_MFA_CONFIRMED: 'true',
      NBC_PUBLIC_ORIGIN: 'https://nbc.example',
    },
  },
);
let logs = '';
server.stdout.on('data', (data) => {
  logs += data;
});
server.stderr.on('data', (data) => {
  logs += data;
});
const output = path.resolve('test-results/admin-signin');
fs.mkdirSync(output, { recursive: true });
(async () => {
  let browser;
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await fetch(base + '/api/admin/session')).ok) break;
      } catch {}
      if (attempt === 99) throw new Error('Local test server failed to start');
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await noJs.newPage();
    await staticPage.goto(base + '/admin');
    assert.equal(
      await staticPage
        .getByRole('link', { name: 'تسجيل الدخول عبر Vercel', exact: true })
        .getAttribute('href'),
      '/api/staff/login',
    );
    await noJs.close();
    console.log('PASS anonymous sign-in remains a native link without JavaScript');

    // Inject a synthetic request header: this HTTP-only fixture does not test
    // browser acceptance of production Secure / SameSite cookies.
    const context = await browser.newContext({
      extraHTTPHeaders: { Cookie: '__Host-nbc-staff=synthetic-invalid' },
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let releaseSession;
    const sessionGate = new Promise((resolve) => {
      releaseSession = resolve;
    });
    await page.route('**/api/admin/session', async (route) => {
      await sessionGate;
      await route.fulfill({ json: { session: { role: 'admin' } } });
    });
    let releaseData;
    const dataGate = new Promise((resolve) => {
      releaseData = resolve;
    });
    await page.route('**/api/admin', async (route) => {
      await dataGate;
      await route.fulfill({
        json: { participants: [], questions: [], audit: [], published: false, prizes: {} },
      });
    });
    await page.goto(base + '/admin');
    await page.getByRole('status').filter({ hasText: 'جارٍ تحميل المساحة' }).waitFor();
    assert.equal(await page.locator('a[href="/api/staff/login"]').count(), 0);
    await page.screenshot({ path: path.join(output, 'session-check.png') });
    releaseSession();
    await page.waitForRequest((request) => request.url() === base + '/api/admin');
    assert.equal(await page.locator('a[href="/api/staff/login"]').count(), 0);
    releaseData();
    await page.getByRole('button', { name: 'نظرة عامة', exact: true }).waitFor();
    console.log('PASS delayed session and data checks never show a new sign-in prompt');

    await page.unroute('**/api/admin/session');
    await page.reload();
    await page.getByRole('link', { name: 'تسجيل الدخول عبر Vercel', exact: true }).waitFor();
    console.log('PASS invalid staff cookie does not grant access and returns to sign-in');

    // Hold native navigation after React handles the click, allowing inspection
    // of feedback and duplicate prevention while the original document exists.
    await page.evaluate(() => {
      window.allowedSignInActivations = 0;
      document.addEventListener('click', (event) => {
        if (!event.target.closest('a[href="/api/staff/login"]')) return;
        if (!event.defaultPrevented) window.allowedSignInActivations++;
        event.preventDefault();
      });
    });
    await page.getByRole('link', { name: 'تسجيل الدخول عبر Vercel', exact: true }).click();
    const pending = page.getByRole('link', { name: 'جارٍ الاتصال بـ Vercel…', exact: true });
    await pending.waitFor();
    assert.equal(await pending.getAttribute('aria-disabled'), 'true');
    // Dispatch a second activation because Playwright correctly treats aria-disabled as disabled.
    await pending.dispatchEvent('click', { button: 0 });
    assert.equal(await page.evaluate(() => window.allowedSignInActivations), 1);
    await page.screenshot({ path: path.join(output, 'connecting.png') });
    await page.goto(base + '/admin?login=failed');
    await page.getByRole('link', { name: 'تسجيل الدخول عبر Vercel', exact: true }).waitFor();
    await page
      .getByText('تعذّر تسجيل الدخول. استخدم حساب Vercel المصرح له ثم أعد المحاولة.')
      .waitFor();
    console.log(
      'PASS pending sign-in has feedback, blocks duplicate activation, and failed return allows retry',
    );
    assert.deepEqual(errors, []);
    await context.close();
  } catch (error) {
    console.error(error.message);
    console.error(logs.slice(-2000));
    process.exitCode = 1;
  } finally {
    await browser?.close();
    server.kill();
  }
})();
