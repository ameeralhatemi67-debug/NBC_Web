const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.NBC_PREVIEW_URL || 'http://127.0.0.1:3001';
const output = path.resolve('test-results/admin-updates');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const checks = [];
  try {
    await page.goto(base);
    // Fixed UI is excluded only from element captures below the viewport.
    await page.addStyleTag({ content: '.skip-link:not(:focus){visibility:hidden}' });
    const sizes = {};
    for (const width of [390, 1440]) {
      await page.setViewportSize({width, height: 1000});
      for (const design of ['original', 'official', 'hybrid']) {
        await page.evaluate(d => localStorage.setItem('nbc-design', d), design);
        await page.reload();
        await page.addStyleTag({ content: '.skip-link:not(:focus){visibility:hidden}' });
        await page.evaluate(() => scrollTo(0,0));
        await page.evaluate(() => document.fonts.ready);
        await page.locator('.competition-book-link img').evaluate(img => img.decode());
        sizes[`${design}-${width}`] = await page.locator('.competition-book-link img').evaluate(img => img.getBoundingClientRect().width);
        if (design !== 'original') {
          const logo = await page.locator('.header-inner .official-brand-mark').getAttribute('src');
          assert.ok(logo.includes('general-presidency'));
          await page.screenshot({path: path.join(output, `${design}-hero-${width}.png`), fullPage: false});
          for (const card of await page.locator('.prizes-heading,.prize-stage-card,.recognition-heading,.recognition-card').all()) {
            await card.scrollIntoViewIfNeeded();
            await card.evaluate(el => new Promise(resolve => {const check = () => getComputedStyle(el).opacity === '1' ? resolve() : requestAnimationFrame(check); check();}));
          }
          await page.evaluate(() => document.activeElement?.blur());
          await page.locator('#prizes').screenshot({path: path.join(output, `${design}-prizes-${width}.png`)});
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${design}/${width} page overflow`);
        checks.push(`${design}/${width} hero, logo and overflow`);
      }
      assert.ok(Math.abs(sizes[`original-${width}`] - sizes[`official-${width}`]) < 1, JSON.stringify(sizes));
      assert.ok(Math.abs(sizes[`original-${width}`] - sizes[`hybrid-${width}`]) < 1, JSON.stringify(sizes));
    }
    await page.setViewportSize({width: 1440, height: 1000});
    await page.goto(base + '/admin');
    await page.getByRole('button', {name: 'دخول عرض اللجنة', exact: true}).click();
    await page.getByRole('button', {name: 'تحليلات المسابقة', exact: true}).click();
    await page.getByRole('heading', {name: 'توزيع الذكور والإناث'}).waitFor();
    assert.equal(await page.locator('.analytics-summary > div').first().locator('strong').innerText(), '6');
    await page.getByLabel('الجنس', {exact: true}).selectOption('أنثى');
    await page.getByLabel('المدرسة / الجامعة', {exact: true}).selectOption('جامعة المعرفة (تجريبية)');
    assert.equal(await page.locator('.analytics-summary > div').first().locator('strong').innerText(), '1');
    const download = await page.locator('.analytics-summary a').getAttribute('href');
    assert.ok(download.includes('gender=') && download.includes('institution='));
    const csv = await page.request.get(base + download);
    assert.equal((await csv.text()).trim().split('\r\n').length, 2);
    await page.getByRole('button', {name: 'مسح المرشحات', exact: true}).click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({width, height: 1000});
      await page.screenshot({path: path.join(output, `analytics-${width}.png`), fullPage: true});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Analytics overflow');
    }
    checks.push('Combined analytics filters, totals, matching CSV and mobile layout');
    await page.setViewportSize({width: 1440, height: 1000});
    await page.getByRole('button', {name: 'الجوائز والتصميم', exact: true}).click();
    await page.getByRole('heading', {name: 'الجوائز المالية وتصميم العرض'}).waitFor();
    const original = await (await page.request.get(base + '/api/admin')).json();
    await page.locator('.prize-editor-grid fieldset').first().getByLabel('المركز 1', {exact: true}).fill('4600');
    await page.locator('.prize-editor-grid fieldset').first().getByLabel('المركز 5', {exact: true}).fill('800');
    await page.getByLabel('تصميم قسم الجوائز').selectOption('ledger');
    await page.getByRole('button', {name: 'معاينة قبل الحفظ', exact: true}).click();
    await page.locator('.prize-editor-preview').waitFor();
    assert.equal(await page.locator('.prize-editor-preview .first-prize').first().locator('strong').innerText(), '4,600');
    await page.getByRole('button', {name: 'حفظ الجوائز والتصميم', exact: true}).click();
    await page.getByText('تم حفظ الجوائز والتصميم. تظهر التغييرات عند فتح الموقع أو تحديثه.').waitFor();
    await page.getByRole('button', {name: 'إخفاء المعاينة', exact: true}).click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({width, height: 1000});
      await page.screenshot({path: path.join(output, `prize-editor-${width}.png`), fullPage: true});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Prize editor overflow');
    }
    await page.goto(base);
    await page.addStyleTag({ content: '.skip-link:not(:focus){visibility:hidden}' });
    assert.equal(await page.locator('.first-prize').first().locator('strong').innerText(), '4,600');
    assert.ok(await page.locator('#prizes').getAttribute('class').then(v => v.includes('ledger')));
    for (const width of [1440, 390]) {
      await page.setViewportSize({width, height: 1000});
      for (const card of await page.locator('.prizes-heading,.prize-stage-card,.recognition-heading,.recognition-card').all()) {
        await card.scrollIntoViewIfNeeded();
        await card.evaluate(el => new Promise(resolve => {const check = () => getComputedStyle(el).opacity === '1' ? resolve() : requestAnimationFrame(check); check();}));
      }
      await page.locator('#prizes').screenshot({path: path.join(output, `ledger-prizes-${width}.png`)});
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Ledger overflow');
    }
    const current = await (await page.request.get(base + '/api/admin')).json();
    const reset = await page.request.post(base + '/api/admin/prizes', {data: {...original.prizes, version: current.prizes.version}});
    assert.ok(reset.ok());
    checks.push('Prize editing, preview, save, public amounts/layout and mobile layout');
    await page.reload();
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({passed: true, checks, sizes}, null, 2));
    console.log(JSON.stringify({passed: true, checks, sizes}, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
