import type { BookVersion } from './competition-domain';
import type { PDFDocumentProxy } from 'pdfjs-dist';
export type BookContentsEntry = { title: string; page: number };
export type ReaderBookConfig = { openingPage: number; contents?: BookContentsEntry[] };
// Client presentation metadata keyed by immutable book version. No API/schema change.
export const readerBookVersions: Record<string, ReaderBookConfig> = {
  'national-belonging-ec07ef57': {
    openingPage: 1,
    contents: [
      { title: 'الغلاف', page: 1 },
      { title: 'صفحة العنوان', page: 3 },
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
      },
  );
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
