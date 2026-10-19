'use client';
// Poster fonts: one manifest used to load the faces for preview and measuring, and to embed the
// same files in exported images, so a downloaded poster matches the preview exactly.
const ARABIC =
  'U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC';
const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';

const DIGITS = 'U+0660-0669,U+066B-066C';

export const NASKH = 'NBCP Naskh';
export const SANS = 'NBCP Sans';
export const FRUTIGER = 'NBCP Frutiger';
export type FontFaceSpec = { family: string; weight: number; url: string; range?: string };

export const posterFaces: FontFaceSpec[] = [
  ...[600, 700].flatMap((weight) => [
    { family: NASKH, weight, url: `/fonts/media/naskh-arabic-${weight}.woff2`, range: ARABIC },
    { family: NASKH, weight, url: `/fonts/media/naskh-latin-${weight}.woff2`, range: LATIN },
  ]),
  ...[400, 500, 700].flatMap((weight) => [
    { family: SANS, weight, url: `/fonts/media/sans-arabic-${weight}.woff2`, range: ARABIC },
    { family: SANS, weight, url: `/fonts/media/sans-latin-${weight}.woff2`, range: LATIN },
  ]),
  { family: FRUTIGER, weight: 400, url: '/fonts/identity/FrutigerLTArabic-55Roman.ttf' },
  { family: FRUTIGER, weight: 700, url: '/fonts/identity/FrutigerLTArabic-65Bold.ttf' },
  // Frutiger's Arabic-Indic zero is a faint dot at poster size. Faces defined later are checked
  // first, so these give the official identity Noto Sans digits and keep its letters.
  { family: FRUTIGER, weight: 400, url: '/fonts/media/sans-arabic-500.woff2', range: DIGITS },
  { family: FRUTIGER, weight: 700, url: '/fonts/media/sans-arabic-700.woff2', range: DIGITS },
];

let loading: Promise<void> | null = null;
export function loadPosterFonts() {
  loading ??= Promise.all(
    posterFaces.map(async (spec) => {
      const face = new FontFace(spec.family, `url(${spec.url})`, {
        weight: String(spec.weight),
        unicodeRange: spec.range,
        display: 'block',
      });
      document.fonts.add(face);
      try {
        await face.load();
      } catch {
        // A missing face falls back to the page fonts; measuring still works.
      }
    }),
  ).then(() => undefined);
  return loading;
}

// The @font-face rules for an exported SVG, with each file inlined as a data URI.
const inlined = new Map<string, Promise<string>>();
function dataUri(url: string) {
  let pending = inlined.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`font ${url}`);
        return r.blob();
      })
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          }),
      );
    inlined.set(url, pending);
    pending.catch(() => inlined.delete(url));
  }
  return pending;
}
export async function embeddedFontCss(families: Set<string>) {
  const rules = await Promise.all(
    posterFaces
      .filter((f) => families.has(f.family))
      .map(
        async (f) =>
          `@font-face{font-family:'${f.family}';font-weight:${f.weight};src:url(${await dataUri(f.url)});${f.range ? `unicode-range:${f.range};` : ''}}`,
      ),
  );
  return rules.join('');
}
