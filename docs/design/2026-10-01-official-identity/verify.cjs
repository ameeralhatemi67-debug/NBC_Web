const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const results = [];
    for (const width of [320, 390, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
      await page.goto(pathToFileURL(path.join(__dirname, 'index.html')).href);
      await page.evaluate(() => document.fonts.ready);
      const state = await page.evaluate(() => ({
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        images: [...document.images].filter(image => !image.complete || !image.naturalWidth).map(image => image.src),
        fonts: [...document.fonts].map(font => ({ family: font.family, status: font.status })),
        overflow: [...document.querySelectorAll('h1,h2,h3,.button,.prize-row,.header-inner,.faq-list summary')].filter(element => element.getClientRects().length && element.scrollWidth > element.clientWidth + 2).map(element => element.textContent.trim()),
      }));
      assert.ok(state.documentWidth <= width + 1, JSON.stringify(state));
      assert.deepEqual(state.images, [], 'All supplied assets must load');
      assert.deepEqual(state.overflow, [], 'Text must fit its container');
      assert.ok(state.fonts.filter(font => font.status === 'loaded').length >= 2, 'Supplied Frutiger regular and bold must load');
      await page.locator('.hero .button').first().click();
      assert.ok(await page.locator('#register-dialog').evaluate(dialog => dialog.open));
      await page.locator('#register-dialog .button').click();
      assert.equal(await page.locator('#register-dialog').evaluate(dialog => dialog.open), false);
      await page.locator('.login').click();
      assert.ok(await page.locator('#login-dialog').evaluate(dialog => dialog.open));
      await page.keyboard.press('Escape');
      await page.locator('.faq-list summary').first().click();
      assert.ok(await page.locator('.faq-list details').first().evaluate(details => details.open));
      if (width < 850) {
        await page.locator('.mobile-nav summary').click();
        await page.locator('.mobile-nav a').first().click();
        assert.equal(await page.locator('.mobile-nav').evaluate(details => details.open), false);
      }
      await page.evaluate(() => { document.querySelectorAll('details').forEach(details => details.open = false); scrollTo(0, 0); });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      if ([390, 1440].includes(width)) {
        await page.screenshot({ path: path.join(__dirname, `preview-${width}.png`), fullPage: true });
        await page.screenshot({ path: path.join(__dirname, `first-screen-${width}.png`) });
      }
      results.push(state);
    }
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(pathToFileURL(path.join(__dirname, 'asset-guide.html')).href);
      const guide = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        images: [...document.images].filter(image => !image.complete || !image.naturalWidth).map(image => image.src),
      }));
      assert.ok(guide.documentWidth <= width + 1, 'Asset guide must fit mobile and desktop');
      assert.deepEqual(guide.images, [], 'Guide artwork must load');
      for (const href of await page.locator('a[href]').evaluateAll(links => links.map(link => link.getAttribute('href')))) {
        if (!href.startsWith('#')) assert.ok(fs.existsSync(path.join(__dirname, href)), href);
      }
      if (width === 390) await page.screenshot({ path: path.join(__dirname, 'guide-390.png') });
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(__dirname, 'verification.json'), JSON.stringify({ passed: true, results }, null, 2));
    console.log('Passed: five homepage viewport sizes, assets, fonts, text fit, dialogs, FAQ, mobile navigation, and asset guide at mobile/desktop widths.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
