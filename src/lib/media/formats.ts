// Poster sizes for the media centre. Each one is drawn at its native pixel size; the shape decides
// the composition (stacked for square/portrait/tall, split into two columns for wide).
export type FormatId = 'square' | 'portrait' | 'story' | 'landscape' | 'link';
export type Shape = 'square' | 'portrait' | 'tall' | 'wide';
export type PosterFormat = {
  id: FormatId;
  name: string;
  ratio: string;
  w: number;
  h: number;
  shape: Shape;
  platforms: string;
  // Bands that platform controls cover (stories): kept free of text and the QR code.
  safe?: { top: number; bottom: number };
};

export const posterFormats: PosterFormat[] = [
  {
    id: 'square',
    name: 'مربع',
    ratio: '١:١',
    w: 1080,
    h: 1080,
    shape: 'square',
    platforms: 'إنستغرام · إكس · واتساب',
  },
  {
    id: 'portrait',
    name: 'عمودي',
    ratio: '٤:٥',
    w: 1080,
    h: 1350,
    shape: 'portrait',
    platforms: 'منشور إنستغرام',
  },
  {
    id: 'story',
    name: 'قصة',
    ratio: '٩:١٦',
    w: 1080,
    h: 1920,
    shape: 'tall',
    platforms: 'القصص · سناب شات · تيك توك · حالة واتساب',
    safe: { top: 230, bottom: 290 },
  },
  {
    id: 'landscape',
    name: 'أفقي',
    ratio: '١٦:٩',
    w: 1600,
    h: 900,
    shape: 'wide',
    platforms: 'إكس · لينكدإن',
  },
  {
    id: 'link',
    name: 'معاينة رابط',
    ratio: '١٫٩١:١',
    w: 1200,
    h: 630,
    shape: 'wide',
    platforms: 'معاينة الروابط في المحادثات',
  },
];

export const formatIds = posterFormats.map((f) => f.id);
export function posterFormat(id: string): PosterFormat {
  return posterFormats.find((f) => f.id === id) ?? posterFormats[0];
}
export function shapeOf(w: number, h: number): Shape {
  const r = w / h;
  if (r > 1.25) return 'wide';
  if (r >= 0.92) return 'square';
  if (r >= 0.7) return 'portrait';
  return 'tall';
}
