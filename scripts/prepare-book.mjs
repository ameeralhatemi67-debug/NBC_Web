import { createHash } from 'node:crypto';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
const source = 'public/documents/national-belonging.pdf';
const bytes = await readFile(source);
const hash = createHash('sha256').update(bytes).digest('hex');
if (hash !== 'ec07ef57e563ada8bba244317aeeef0e34c8caa0ea7e10bee228232615db79fd')
  throw new Error('Official book changed. Register a reviewed new version; preserve the old file.');
await mkdir('public/books', { recursive: true });
await copyFile(source, `public/books/${hash}.pdf`);
await mkdir('public/pdfjs', { recursive: true });
await copyFile(
  'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
  'public/pdfjs/pdf.worker.min.mjs',
);
console.log('Verified book and PDF.js worker prepared.');
