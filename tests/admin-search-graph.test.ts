import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { test } from 'node:test';

const unix = (file: string) => file.split(String.fromCharCode(92)).join('/');
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? sources(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}
const files = sources('src').map((file) => ({
  file: unix(file),
  text: readFileSync(file, 'utf8'),
}));

function resolve(from: string, spec: string) {
  const base = spec.startsWith('@/')
    ? join('src', spec.slice(2))
    : spec.startsWith('.')
      ? normalize(join(dirname(from), spec))
      : '';
  if (!base) return '';
  for (const candidate of [
    base + '.ts',
    base + '.tsx',
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ])
    if (existsSync(candidate)) return unix(candidate);
  return '';
}
// Every module a file can reach through static imports, dynamic import() included.
function reachable(entry: string) {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const current = queue.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    const text = readFileSync(current, 'utf8');
    for (const match of text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)) {
      const next = resolve(current, match[1]);
      if (next) queue.push(next);
    }
  }
  return seen;
}

test('the participant screens cannot reach any committee module or the book search', () => {
  const entries = [
    'src/components/participation.tsx',
    'src/components/competition-intro.tsx',
    'src/components/competition-result.tsx',
    'src/components/pdf-book-reader.tsx',
    'src/components/book-reader.tsx',
    'src/app/participate/page.tsx',
    'src/app/book/page.tsx',
  ];
  for (const entry of entries) {
    const graph = [...reachable(entry)];
    const bad = graph.filter((file) => /admin|book-search/.test(file));
    assert.deepEqual(bad, [], `${entry} reaches ${bad.join(', ')}`);
  }
});

test('text extraction and the search module live only in the admin search', () => {
  const using = (pattern: RegExp) =>
    files.filter(({ text }) => pattern.test(text)).map(({ file }) => file);
  assert.deepEqual(using(/getTextContent/), ['src/components/admin-book-search.tsx']);
  assert.deepEqual(using(/['"](?:@\/lib|\.)\/book-search['"]/).sort(), [
    'src/components/admin-book-search.tsx',
  ]);
  // The search component is loaded only through a dynamic import from the admin page viewer.
  assert.deepEqual(using(/admin-book-search/), ['src/components/admin-page-viewer.tsx']);
  const viewer = files.find(({ file }) => file === 'src/components/admin-page-viewer.tsx')!.text;
  assert.ok(/import\(\s*['"]\.\/admin-book-search['"]\s*\)/.test(viewer), 'dynamic import');
  assert.ok(!/^import[^\n]*admin-book-search/m.test(viewer), 'no static import');
});
