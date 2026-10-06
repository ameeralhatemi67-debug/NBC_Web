// Admin-only in-book search. Never imported by participant code (see tests/book-model.test.ts).
// Pure: the PDF text source is injected, so this runs in unit tests without pdf.js.
const TASHKEEL = /[ً-ٰٟۖ-ۭ]/;
const TATWEEL = 'ـ';

// Normalised text plus, for each output character, its index in the original string.
export function normalizeWithMap(value: string) {
  let norm = '';
  const map: number[] = [];
  let space = false;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (TASHKEEL.test(char) || char === TATWEEL) continue;
    if (/\s/.test(char)) {
      if (norm && !space) {
        norm += ' ';
        map.push(i);
      }
      space = true;
      continue;
    }
    space = false;
    let out = char;
    if ('آأإٱ'.includes(char)) out = 'ا';
    else if (char === 'ى') out = 'ي';
    norm += out.toLowerCase();
    map.push(i);
  }
  return { norm, map };
}
export const normalizeArabic = (value: string) => normalizeWithMap(value).norm.trimEnd();

export const MIN_ARABIC_LETTERS = 20;
export const MIN_USABLE_SHARE = 0.5;
export type IndexedPage = {
  page: number;
  text: string;
  norm: string;
  map: number[];
  usable: boolean;
};
export type BookIndex = {
  pages: IndexedPage[];
  usablePages: number;
  availability: 'available' | 'unavailable';
};
const arabicLetters = (text: string) => (text.match(/[ء-يٱ-ۓ]/g) ?? []).length;

// Pages whose text layer carries real Arabic letters. Fonts without Unicode mappings give control
// codes instead, which is how this book's body pages are encoded.
export function buildIndex(pages: { page: number; text: string }[]): BookIndex {
  const indexed = pages.map(({ page, text }) => {
    const { norm, map } = normalizeWithMap(text);
    return { page, text, norm, map, usable: arabicLetters(text) >= MIN_ARABIC_LETTERS };
  });
  const usablePages = indexed.filter((page) => page.usable).length;
  return {
    pages: indexed,
    usablePages,
    availability:
      indexed.length > 0 && usablePages / indexed.length >= MIN_USABLE_SHARE
        ? 'available'
        : 'unavailable',
  };
}

export async function indexBook(
  pageCount: number,
  getText: (page: number) => Promise<string>,
  options: {
    onProgress?: (done: number) => void;
    idle?: () => Promise<void>;
    signal?: AbortSignal;
  } = {},
) {
  const pages: { page: number; text: string }[] = [];
  for (let page = 1; page <= pageCount; page += 1) {
    options.signal?.throwIfAborted();
    pages.push({ page, text: await getText(page).catch(() => '') });
    options.onProgress?.(page);
    await options.idle?.();
  }
  return buildIndex(pages);
}

export type SearchHit = {
  page: number;
  snippet: string;
  before: string;
  match: string;
  after: string;
  count: number;
};
export function searchIndex(index: BookIndex, query: string, limit = 30): SearchHit[] {
  const needle = normalizeArabic(query).trim();
  if (needle.length < 2 || index.availability !== 'available') return [];
  const hits: SearchHit[] = [];
  for (const page of index.pages) {
    if (!page.usable) continue;
    const first = page.norm.indexOf(needle);
    if (first < 0) continue;
    let count = 0;
    for (let at = first; at >= 0; at = page.norm.indexOf(needle, at + needle.length)) count += 1;
    const from = page.map[first] ?? 0;
    const to = (page.map[first + needle.length - 1] ?? from) + 1;
    const clean = (value: string) => value.replace(/\s+/g, ' ');
    const before = clean(page.text.slice(Math.max(0, from - 40), from));
    const match = clean(page.text.slice(from, to));
    const after = clean(page.text.slice(to, to + 60));
    hits.push({
      page: page.page,
      snippet: `${before}${match}${after}`,
      before,
      match,
      after,
      count,
    });
    if (hits.length >= limit) break;
  }
  return hits;
}
