'use client';
import { embeddedFontCss, FRUTIGER, NASKH, SANS } from './fonts';

// Turns a poster SVG into a PNG or JPG at its exact pixel size: images are inlined (scaled to the
// size they are drawn at), the poster fonts are embedded, and the result is drawn into a canvas by
// the browser, so Arabic letters join exactly as in the preview. The QR code is then read back
// from the pixels to prove it scans.
export type ImageType = 'png' | 'jpeg';

const images = new Map<string, Promise<string>>();
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image ${src}`));
    img.src = src;
  });
}
function inlineImage(href: string, width: number, height: number) {
  const key = `${href}@${Math.round(width)}x${Math.round(height)}`;
  let pending = images.get(key);
  if (!pending) {
    pending = loadImage(href).then((img) => {
      const scale = Math.min(
        1,
        Math.max(width / img.naturalWidth, height / img.naturalHeight) * 1.05,
      );
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    });
    images.set(key, pending);
    pending.catch(() => images.delete(key));
  }
  return pending;
}

export async function rasterize(
  svg: SVGSVGElement,
  { scale = 1, type = 'png' }: { scale?: number; type?: ImageType } = {},
) {
  const w = Number(svg.getAttribute('width')),
    h = Number(svg.getAttribute('height'));
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  clone.removeAttribute('class');
  clone.querySelectorAll('.poster-slot-hit').forEach((n) => n.remove());
  await Promise.all(
    [...clone.querySelectorAll('image')].map(async (node) => {
      const href = node.getAttribute('href') ?? node.getAttribute('xlink:href');
      if (!href || href.startsWith('data:')) return;
      const width = Number(node.getAttribute('width')) * scale;
      const height = Number(node.getAttribute('height')) * scale;
      node.setAttribute('href', await inlineImage(href, width, height));
    }),
  );
  let markup = new XMLSerializer().serializeToString(clone);
  const families = new Set([NASKH, SANS, FRUTIGER].filter((f) => markup.includes(f)));
  const css = await embeddedFontCss(families);
  markup = markup.replace(/(<svg[^>]*>)/, `$1<style>${css}</style>`);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await loadImage(url);
    // Fonts inside an SVG image can settle a moment after load; give them one more frame.
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d')!;
    if (type === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('export'))),
        type === 'png' ? 'image/png' : 'image/jpeg',
        0.93,
      ),
    );
    return { blob, canvas };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Reads the QR code back from the exported pixels. Null when the poster has no QR code.
export async function verifyQr(
  svg: SVGSVGElement,
  canvas: HTMLCanvasElement,
  scale: number,
  expected: string,
) {
  const node = svg.querySelector('[data-qr]');
  if (!node) return null;
  const x = Number(node.getAttribute('data-x')) * scale,
    y = Number(node.getAttribute('data-y')) * scale,
    size = Number(node.getAttribute('data-size')) * scale;
  const pad = size * 0.08;
  const sx = Math.max(0, Math.floor(x - pad)),
    sy = Math.max(0, Math.floor(y - pad)),
    sw = Math.min(canvas.width - sx, Math.ceil(size + 2 * pad)),
    sh = Math.min(canvas.height - sy, Math.ceil(size + 2 * pad));
  const data = canvas.getContext('2d')!.getImageData(sx, sy, sw, sh);
  const { default: jsQR } = await import('jsqr');
  const result = jsQR(data.data, sw, sh, { inversionAttempts: 'attemptBoth' });
  return result?.data === expected;
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function zip(files: { name: string; data: Blob | string }[]) {
  const { zipSync, strToU8 } = await import('fflate');
  const entries: Record<string, Uint8Array> = {};
  for (const f of files)
    entries[f.name] =
      typeof f.data === 'string' ? strToU8(f.data) : new Uint8Array(await f.data.arrayBuffer());
  const bytes = zipSync(entries, { level: 0 });
  return new Blob([bytes as BlobPart], { type: 'application/zip' });
}
