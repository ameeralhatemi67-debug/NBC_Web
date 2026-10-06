// Development-only review tool. Never import this file from application code.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const sha = 'ec07ef57e563ada8bba244317aeeef0e34c8caa0ea7e10bee228232615db79fd';
const input = new URL(`../public/books/${sha}.pdf`, import.meta.url);
const output = new URL(
  '../docs/implementation/2026-10-06-book-outline-candidates.md',
  import.meta.url,
);
const bytes = new Uint8Array(await readFile(input));
if (createHash('sha256').update(bytes).digest('hex') !== sha)
  throw new Error('Unexpected book SHA');
const task = getDocument({ data: bytes, verbosity: 0 });
const pdf = await task.promise;
const normalize = (value) =>
  value
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const latin = (value) => value.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
const escape = (value) => value.replaceAll('|', '\\|').replaceAll('\n', ' ');
const candidates = [];
const previews = [];
// The supplied Type 3 fonts have no usable Unicode mapping. These proposals
// were transcribed from the rendered contents on PDF 63, then checked against
// the chapter-opening pages. Keep them pending committee review.
const visualCandidates = [
  { title: 'مقدمة', pdfPage: 9, printedPage: 7 },
  {
    title: 'المطلب الأول: تعريف الوطن، والمواطنة، والانتماء واللحمة الوطنية',
    pdfPage: 13,
    printedPage: 11,
  },
  {
    title: 'المطلب الثاني: تأصيل الانتماء للوطن ومحبته في نصوص الوحيين',
    pdfPage: 17,
    printedPage: 15,
  },
  { title: 'المطلب الثالث: الانتماء والمواطنة في حياة السلف الصالح', pdfPage: 27, printedPage: 25 },
  { title: 'المطلب الرابع: الانتماء واللحمة الوطنية في الشريعة', pdfPage: 35, printedPage: 33 },
  { title: 'المطلب الخامس: حقوق الانتماء إلى الوطن', pdfPage: 41, printedPage: 39 },
  { title: 'المطلب السادس: محاذير لا بد من التنبه لها', pdfPage: 55, printedPage: 53 },
  { title: 'فهرس المصادر والمراجع', pdfPage: 59, printedPage: 57 },
  { title: 'فهرس الموضوعات', pdfPage: 63, printedPage: 61 },
];
const readable = (value) =>
  /[\u0600-\u06ff]/.test(value) && !/[\u0000-\u0008\u000e-\u001f]/.test(value);
const preview = (value) =>
  readable(value) ? escape(value) : `Unicode unavailable: ${escape(JSON.stringify(value))}`;
try {
  for (let pdfPage = 1; pdfPage <= pdf.numPages; pdfPage++) {
    const page = await pdf.getPage(pdfPage);
    const viewport = page.getViewport({ scale: 1 });
    const { items } = await page.getTextContent();
    const textItems = items.filter((item) => 'str' in item && item.str.trim());
    const lines = [];
    for (const item of textItems) {
      const y = item.transform[5];
      let line = lines.find((line) => Math.abs(line.y - y) < 2);
      if (!line) {
        line = { y, items: [] };
        lines.push(line);
      }
      line.items.push(item);
    }
    const ordered = lines
      .sort((a, b) => b.y - a.y)
      .map((line) => ({
        y: line.y,
        title: line.items
          .sort((a, b) => b.transform[4] - a.transform[4])
          .map((item) => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
        size: Math.max(
          ...line.items.map((item) => Math.hypot(item.transform[2], item.transform[3])),
        ),
      }));
    const text = ordered.map((line) => line.title).join(' ');
    const footer = ordered.find(
      (line) => line.y < viewport.height * 0.12 && /^\d+$/.test(latin(line.title.trim())),
    );
    const printedPage = footer ? Number(latin(footer.title.trim())) : null;
    previews.push({ pdfPage, printedPage, text: text.slice(0, 80) });
    const sizes = textItems
      .map((item) => Math.hypot(item.transform[2], item.transform[3]))
      .sort((a, b) => a - b);
    const bodySize = sizes[Math.floor(sizes.length / 2)] ?? 0;
    for (let index = 0; index < ordered.length; index++) {
      const line = ordered[index];
      const title = normalize(line.title);
      const named =
        /^(?:المطلب|المبحث|الفصل|المقدمة|مقدمة|الخاتمة|خاتمة|فهرس|المحتويات|محتويات|تمهيد|المراجع|المصادر)(?:\s|$|:)/.test(
          title,
        );
      const large =
        line.size >= bodySize * 1.2 && line.size >= 16 && line.y > viewport.height * 0.35;
      if ((!named && !large) || !readable(line.title)) continue;
      let heading = line.title;
      const next = ordered[index + 1];
      if (
        /^(?:المطلب|المبحث|الفصل)\s/.test(title) &&
        next &&
        next.size >= line.size * 0.85 &&
        line.y - next.y < line.size * 3
      )
        heading += ' ' + next.title;
      if (!candidates.some((entry) => entry.title === heading))
        candidates.push({ title: heading, pdfPage, printedPage });
    }
    page.cleanup();
  }
  const proposed = candidates.length ? candidates : visualCandidates;
  const rows = proposed
    .map(
      (entry) =>
        `| ${escape(entry.title)} | ${entry.pdfPage} | ${entry.printedPage ?? 'غير مكتشف'} | ${preview(previews[entry.pdfPage - 1].text)} |`,
    )
    .join('\n');
  const previewRows = previews
    .map(
      (entry) =>
        `| ${entry.pdfPage} | ${entry.printedPage ?? 'غير مكتشف'} | ${preview(entry.text)} |`,
    )
    .join('\n');
  await writeFile(
    output,
    `# Proposed book outline for committee review\n\nPending committee review of titles and pages. Generated with scripts/extract-book-outline.mjs from the immutable ${sha} PDF. PDF outline entries: ${(await pdf.getOutline())?.length ?? 0}; pages: ${pdf.numPages}.\n\nThe script reads every page with PDF.js and proposes headings by prefix and text size when Unicode text is usable. This supplied PDF uses Type 3 glyphs without usable Unicode mapping: automatic Arabic titles and printed page numerals cannot be recovered. Control characters in the first 80 extracted characters are escaped below rather than misrepresented as Arabic. For this SHA only, the proposed titles and printed pages were visually transcribed from the real contents on PDF 63 and checked against rendered chapter-opening pages. They are provisional, not committee-approved. Blank PDF 2 is not a contents page. PDF 63 is the first real contents page, so first-time exam reading opens there; saved reading position takes priority. No text index is shipped to students.\n\n| Candidate title | pdfPage | printedPage | First 80 extracted page characters |\n|---|---:|---:|---|\n${rows}\n\n## All page previews\n\n| pdfPage | printedPage detected by extraction | First 80 extracted page characters |\n|---|---:|---|\n${previewRows}\n`,
    'utf8',
  );
  console.table(
    proposed.map((entry) => ({ ...entry, first80: preview(previews[entry.pdfPage - 1].text) })),
  );
  console.log('Candidate report:', output.pathname);
} finally {
  await task.destroy();
}
