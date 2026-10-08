// Locking an answer without time on its source page shows a one-time reading nudge first.
// These helpers lock the way a student who decides to proceed would.
async function settle(page) {
  await page.locator('.reading-nudge, .answer-feedback').first().waitFor();
  return (await page.locator('.reading-nudge').count()) > 0;
}
async function lockByEnter(page) {
  await page.keyboard.press('Enter');
  if (await settle(page)) await page.keyboard.press('Enter');
}
async function lockByClick(button, page) {
  await button.click();
  if (await settle(page)) await button.click();
}
async function lockByTap(button, page) {
  await button.tap();
  if (await settle(page)) await button.tap();
}
module.exports = { lockByEnter, lockByClick, lockByTap };
