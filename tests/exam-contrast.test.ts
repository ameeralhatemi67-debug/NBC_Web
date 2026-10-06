import assert from 'node:assert/strict';
import { test } from 'node:test';
function luminance(hex: string) {
  const rgb = hex
    .match(/\w\w/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
test('approved semantic status text meets 4.5:1 contrast in every identity', () => {
  for (const [text, bg] of [
    ['256044', 'e8f4ec'],
    ['9a3328', 'fcebe7'],
  ]) {
    const contrast = (luminance(bg) + 0.05) / (luminance(text) + 0.05);
    assert.ok(contrast >= 4.5, `${text} on ${bg}: ${contrast}`);
  }
});
