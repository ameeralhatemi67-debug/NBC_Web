import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildIndex,
  indexBook,
  normalizeArabic,
  normalizeWithMap,
  searchIndex,
} from '../src/lib/book-search';

const text = {
  9: 'الوَطَنُ هو المكان الذي يَنتمي إليه الإنسان ويشعر فيه بالأمان والاستقرار والانتماء',
  13: 'أصل الانتماء للوطن ومحبته في نصوص الكتاب والسنة وهدي السلف الصالح رحمهم الله',
  14: 'المواطنة حقوق وواجبات متبادلة بين المواطن والدولة وفق الأنظمة المرعية في البلاد',
} as Record<number, string>;
const good = [9, 13, 14].map((page) => ({ page, text: text[page] }));

test('normalisation strips tashkeel and tatweel and unifies alef and ya', () => {
  assert.equal(normalizeArabic('الوَطَنُ'), 'الوطن');
  assert.equal(normalizeArabic('الانتمــــاء'), 'الانتماء');
  assert.equal(normalizeArabic('أإآٱ'), 'اااا');
  assert.equal(normalizeArabic('على'), 'علي');
  assert.equal(normalizeArabic('  كلمة   أخرى '), 'كلمة اخري');
  const { norm, map } = normalizeWithMap('الوَطَنُ');
  assert.equal(norm.length, map.length);
  assert.equal('الوَطَنُ'[map[3]], 'ط');
});

test('search finds a known phrase with page and snippet, ignoring diacritics and alef forms', () => {
  const index = buildIndex(good.concat([{ page: 1, text: '' }]));
  assert.equal(index.availability, 'available');
  const hits = searchIndex(index, 'الإنسان ويشعر');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].page, 9);
  assert.match(hits[0].snippet, /الإنسان ويشعر/);
  assert.equal(hits[0].match, 'الإنسان ويشعر');
  assert.equal(searchIndex(index, 'الوطن')[0].page, 9, 'diacritics in the page are ignored');
  assert.equal(
    searchIndex(index, 'انتماء')
      .map((h) => h.page)
      .join(),
    '9,13',
  );
  assert.equal(searchIndex(index, 'ا').length, 0, 'too short');
  assert.equal(searchIndex(index, 'لا توجد هذه العبارة').length, 0);
});

test('a book whose text layer has no Unicode letters is reported unavailable, not empty', () => {
  // This is how the competition PDF's Type 3 body pages decode: control codes, no Arabic letters.
  const codes = Array.from({ length: 66 }, (_, i) => ({
    page: i + 1,
    text: '\u0001 \u0002 \u0004 \u0003 \u0001 \u0004\u0004 \u0007 \u0005 '.repeat(40),
  }));
  codes[5] = { page: 6, text: text[9] };
  const index = buildIndex(codes);
  assert.equal(index.usablePages, 1);
  assert.equal(index.availability, 'unavailable');
  assert.deepEqual(searchIndex(index, 'الانتماء'), [], 'never pretend to search');
});

test('indexing reports progress, yields to idle time, and survives a page that fails', async () => {
  const progress: number[] = [];
  let idles = 0;
  const index = await indexBook(
    3,
    async (page) => {
      if (page === 2) throw new Error('bad page');
      return text[page + 8] ?? text[9];
    },
    {
      onProgress: (n) => progress.push(n),
      idle: async () => {
        idles += 1;
      },
    },
  );
  assert.deepEqual(progress, [1, 2, 3]);
  assert.equal(idles, 3);
  assert.equal(index.pages[1].text, '');
  assert.equal(index.pages.length, 3);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(indexBook(3, async () => '', { signal: controller.signal }));
});
