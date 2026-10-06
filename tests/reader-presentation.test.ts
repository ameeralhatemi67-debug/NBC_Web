import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  canvasSize,
  clampZoom,
  fallbackContents,
  readerBookConfig,
  outlineContents,
} from '../src/lib/reader-presentation';
test('reader raster stays within DPR 2 and 16M pixels at extreme zoom', () => {
  assert.deepEqual(canvasSize(200, 300, 3), { width: 400, height: 600, density: 2 });
  for (const [width, height] of [
    [10000, 10000],
    [3000, 6000],
    [2800, 4000],
  ]) {
    const size = canvasSize(width, height, 4);
    assert.ok(size.width * size.height <= 16000000);
    assert.ok(size.density <= 2);
  }
  assert.equal(clampZoom(0.5, true), 1);
  assert.equal(clampZoom(4, true), 3);
  assert.equal(clampZoom(0.5), 0.75);
});
test('reader contents resolves named, referenced and nested PDF destinations and excludes out-of-book pages', async () => {
  const pdf = {
    getOutline: async () => [
      { title: 'chapter', dest: 'named', items: [{ title: 'section', dest: [3], items: [] }] },
      { title: 'outside', dest: [66], items: [] },
    ],
    getDestination: async (name: string) => (name === 'named' ? [{ num: 12, gen: 0 }] : null),
    getPageIndex: async () => 6,
  } as unknown as Pick<PDFDocumentProxy, 'getOutline' | 'getDestination' | 'getPageIndex'>;
  assert.deepEqual(await outlineContents(pdf, 66), [
    { title: 'chapter', page: 7 },
    { title: 'section', page: 4 },
  ]);
  assert.deepEqual(await outlineContents({ ...pdf, getOutline: async () => [] }, 66), []);
});
test('participant import graph cannot reach admin components or index student book text', () => {
  const seen = new Set<string>();
  function visit(file: string) {
    if (seen.has(file)) return;
    seen.add(file);
    assert.ok(!path.basename(file).startsWith('admin-'), file);
    const source = readFileSync(file, 'utf8');
    assert.ok(!source.includes('getTextContent'), file);
    for (const match of source.matchAll(/(?:from\s*|import\s*\()['"]([^'"]+)['"]/g)) {
      const imported = match[1];
      const base = imported.startsWith('@/')
        ? path.resolve('src', imported.slice(2))
        : imported.startsWith('.')
          ? path.resolve(path.dirname(file), imported)
          : null;
      if (!base) continue;
      const resolved = ['.ts', '.tsx', '/index.ts', '/index.tsx']
        .map((ext) => base + ext)
        .find(existsSync);
      if (resolved) visit(resolved);
    }
  }
  visit(path.resolve('src/components/participation.tsx'));
  assert.ok([...seen].some((file) => file.endsWith('pdf-book-reader.tsx')));
});
test('known PDF has a blank page 2, starts at cover, and offers a version-configurable fallback', () => {
  const book = {
    id: 'national-belonging-ec07ef57',
    title: 'test',
    url: '/test.pdf',
    sha256: 'a'.repeat(64),
    pageCount: 66,
    approved: true,
  };
  assert.equal(readerBookConfig(book).openingPage, 1);
  const entries = fallbackContents(book);
  assert.equal(entries.length, 66);
  assert.equal(entries[0].title, 'الغلاف');
  assert.equal(entries[2].title, 'صفحة العنوان');
  assert.equal(entries[9].page, 10);
});
