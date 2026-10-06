import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  BOOK_PART_NAMES,
  CLOSE_MS,
  OPEN_ANGLE_DEG,
  OPEN_MS,
  SWAY_DEG,
  bookDimensions,
  chooseRenderer,
  easeInOutCubic,
  idleSwayRadians,
  isLowPower,
  thicknessRatio,
  transitionProgress,
} from '../src/lib/book-model';

test('thin softcover: 66 pages is 2 to 3 percent of the cover height and grows with the page count', () => {
  const ratio = thicknessRatio(66);
  assert.ok(ratio >= 0.02 && ratio <= 0.03, `ratio ${ratio}`);
  assert.ok(thicknessRatio(200) > ratio);
  assert.ok(thicknessRatio(20) < ratio);
  assert.ok(thicknessRatio(1) >= 0.015, 'never thinner than a sheet of card');
  assert.ok(thicknessRatio(100000) <= 0.06, 'never a hardcover block');
});

test('cover proportions come from the PDF page and depth from the page count', () => {
  const real = bookDimensions(595, 842, 66);
  assert.equal(real.height, 1);
  assert.ok(Math.abs(real.width - 595 / 842) < 1e-9);
  assert.ok(Math.abs(real.depth / real.height - thicknessRatio(66)) < 1e-9);
  assert.ok(bookDimensions(0, 0, 66).width > 0, 'falls back to an A4-like ratio');
  assert.deepEqual(bookDimensions(595, 842, 66), bookDimensions(595, 842, 66), 'deterministic');
});

test('authored timings and angles match the approved spec', () => {
  assert.equal(OPEN_MS, 650);
  assert.equal(CLOSE_MS, 800);
  assert.equal(OPEN_ANGLE_DEG, 146);
  assert.equal(SWAY_DEG, 4);
  assert.deepEqual([...BOOK_PART_NAMES], ['cover', 'pages', 'back', 'spine']);
});

test('transition easing is clamped, monotonic and deterministic', () => {
  assert.equal(easeInOutCubic(-1), 0);
  assert.equal(easeInOutCubic(2), 1);
  assert.equal(easeInOutCubic(0.5), 0.5);
  let last = -1;
  for (let ms = 0; ms <= OPEN_MS; ms += 50) {
    const value = transitionProgress(0, 1, ms, OPEN_MS);
    assert.ok(value >= last);
    last = value;
  }
  assert.equal(transitionProgress(0, 1, OPEN_MS, OPEN_MS), 1);
  assert.equal(transitionProgress(1, 0, CLOSE_MS, CLOSE_MS), 0);
  assert.equal(transitionProgress(0, 1, 10, 0), 1, 'zero duration is instant');
});

test('idle sway stays within four degrees and is off when motion is reduced', () => {
  const limit = (SWAY_DEG * Math.PI) / 180;
  for (let t = 0; t < 20; t += 0.25) assert.ok(Math.abs(idleSwayRadians(t, true)) <= limit + 1e-9);
  assert.equal(idleSwayRadians(3, false), 0);
});

test('flat cover is chosen without WebGL, on low-power devices, and under data saving', () => {
  assert.equal(chooseRenderer({ webgl: true, hardwareConcurrency: 8, deviceMemory: 8 }), '3d');
  assert.equal(chooseRenderer({ webgl: true }), '3d');
  assert.equal(chooseRenderer({ webgl: false, hardwareConcurrency: 8 }), 'flat');
  assert.equal(chooseRenderer({ webgl: true, hardwareConcurrency: 2 }), 'flat');
  assert.equal(chooseRenderer({ webgl: true, deviceMemory: 1 }), 'flat');
  assert.equal(chooseRenderer({ webgl: true, saveData: true }), 'flat');
  assert.equal(isLowPower({ hardwareConcurrency: 4, deviceMemory: 4 }), false);
});

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? sources(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

test('three is imported only by the scene module, which only the book stage loads dynamically', () => {
  const files = sources('src').map((file) => ({ file, text: readFileSync(file, 'utf8') }));
  const unix = (file: string) => file.split(String.fromCharCode(92)).join('/');
  const importsThree = files.filter(({ text }) =>
    /from\s+['"]three['"]|import\(['"]three['"]\)/.test(text),
  );
  assert.deepEqual(
    importsThree.map(({ file }) => unix(file)),
    ['src/lib/book-scene.ts'],
  );
  const referencing = files.filter(({ text }) => /['"](@\/lib|\.)\/book-scene['"]/.test(text));
  assert.deepEqual(referencing.map(({ file }) => unix(file)).sort(), [
    'src/components/book-stage.tsx',
  ]);
  const stage = files.find(({ file }) => unix(file) === 'src/components/book-stage.tsx')!.text;
  assert.ok(/import\('@\/lib\/book-scene'\)/.test(stage), 'dynamic import');
  assert.ok(
    !/^import[^\n]*book-scene/m.test(stage.replace(/import type[^\n]*\n/g, '')),
    'no static import',
  );
  // The exam question screen and the reader never mount the stage.
  const mounting = files
    .filter(({ text }) => /<BookStage\b/.test(text))
    .map(({ file }) => unix(file));
  assert.deepEqual(mounting.sort(), [
    'src/components/competition-intro.tsx',
    'src/components/competition-result.tsx',
  ]);
});
