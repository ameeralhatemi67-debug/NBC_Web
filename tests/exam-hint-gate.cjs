// A fresh exam must open on the cover and keep every hint locked until the student reads past the source page.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.NBC_PREVIEW_URL || 'http://127.0.0.1:3000';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const errors = [];
  try {
    const page = await (
      await browser.newContext({ viewport: { width: 1366, height: 768 } })
    ).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + '/admin');
    await page.getByRole('button', { name: 'دخول عرض اللجنة', exact: false }).click();
    await page.getByRole('button', { name: 'تجربة الإدارة', exact: false }).click();
    await page.getByRole('button', { name: 'دخول الاختبار', exact: true }).click();
    await page.locator('.exam-preview').waitFor();
    const input = page.getByLabel('رقم صفحة PDF', { exact: true });
    await page.waitForFunction(() => document.querySelector('.pdf-page canvas'));
    for (const wait of [1500, 3000]) {
      await page.waitForTimeout(wait);
      assert.equal(await input.inputValue(), '1', 'a fresh exam opens on the cover');
      const hint = await page.locator('.hint-control').innerText();
      assert.ok(
        hint.includes('يُفتح بعد أن تتصفّح الكتاب'),
        'hint stays locked before any reading',
      );
    }
    console.log('PASS fresh exam opens on the cover with every hint locked');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
