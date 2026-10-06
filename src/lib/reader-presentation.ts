import type { BookVersion } from './competition-domain';
import type { PDFDocumentProxy } from 'pdfjs-dist';
export type BookContentsEntry = { title: string; page: number; untitled?: boolean };
export type ReaderBookConfig = { openingPage: number; contents?: BookContentsEntry[] };
// Client presentation metadata keyed by immutable book version. No API/schema change.
// pending committee review of titles and pages
export const readerBookVersions: Record<string, ReaderBookConfig> = {
  'national-belonging-ec07ef57': {
    openingPage: 63,
    contents: [
      { title: 'الغلاف', page: 1 },
      { title: 'صفحة العنوان', page: 3 },
      { title: 'مقدمة', page: 9 },
      { title: 'المطلب الأول: تعريف الوطن، والمواطنة، والانتماء واللحمة الوطنية', page: 13 },
      { title: 'المطلب الثاني: تأصيل الانتماء للوطن ومحبته في نصوص الوحيين', page: 17 },
      { title: 'المطلب الثالث: الانتماء والمواطنة في حياة السلف الصالح', page: 27 },
      { title: 'المطلب الرابع: الانتماء واللحمة الوطنية في الشريعة', page: 35 },
      { title: 'المطلب الخامس: حقوق الانتماء إلى الوطن', page: 41 },
      { title: 'المطلب السادس: محاذير لا بد من التنبه لها', page: 55 },
      { title: 'فهرس المصادر والمراجع', page: 59 },
      { title: 'فهرس الموضوعات', page: 63 },
    ],
  },
};
export function readerBookConfig(book: BookVersion): ReaderBookConfig {
  const config = readerBookVersions[book.id];
  return { openingPage: config?.openingPage ?? 1, contents: config?.contents };
}
export function fallbackContents(book: BookVersion) {
  const configured = readerBookConfig(book).contents ?? [];
  return Array.from(
    { length: book.pageCount },
    (_, index) =>
      configured.find((entry) => entry.page === index + 1) ?? {
        title: 'صفحة PDF',
        page: index + 1,
        untitled: true,
      },
  );
}
export function contentsGroups(entries: BookContentsEntry[]) {
  return {
    chapters: entries.filter((entry) => !entry.untitled),
    otherPages: entries.filter((entry) => entry.untitled),
  };
}
export function openingReaderPage(book: BookVersion, restored?: number) {
  if (restored && Number.isInteger(restored) && restored >= 1 && restored <= book.pageCount)
    return restored;
  const page = readerBookConfig(book).openingPage;
  return page >= 1 && page <= book.pageCount ? page : 1;
}
export async function outlineContents(
  pdf: Pick<PDFDocumentProxy, 'getOutline' | 'getDestination' | 'getPageIndex'>,
  pageCount: number,
) {
  const outline = await pdf.getOutline();
  const items: BookContentsEntry[] = [];
  async function flatten(nodes: NonNullable<typeof outline>) {
    for (const node of nodes) {
      const dest = typeof node.dest === 'string' ? await pdf.getDestination(node.dest) : node.dest;
      if (Array.isArray(dest) && dest.length) {
        const index = typeof dest[0] === 'number' ? dest[0] : await pdf.getPageIndex(dest[0]);
        if (index >= 0 && index < pageCount) items.push({ title: node.title, page: index + 1 });
      }
      if (node.items.length) await flatten(node.items);
    }
  }
  if (outline) await flatten(outline);
  return items;
}
export function canvasSize(width: number, height: number, dpr: number) {
  const density = Math.min(Math.max(dpr, 1), 2, Math.sqrt(16000000 / (width * height)));
  return {
    width: Math.max(1, Math.floor(width * density)),
    height: Math.max(1, Math.floor(height * density)),
    density,
  };
}
export function clampZoom(zoom: number, phone = false) {
  return Math.max(phone ? 1 : 0.75, Math.min(3, zoom));
}
