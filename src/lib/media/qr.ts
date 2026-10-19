import qrcode from 'qrcode-generator';

// QR codes drawn in the site's own shapes, ported from the Share Kit. The matrix comes from
// qrcode-generator; this file only turns modules into SVG path data (unit: one module).
export type QrStyle = 'classic' | 'mihrab' | 'liquid' | 'pearl' | 'weave' | 'seal';
export const qrStyles: { id: QrStyle; name: string; note: string }[] = [
  { id: 'mihrab', name: 'محراب', note: 'وحدات بقمم مقوّسة مثل أقواس الموقع' },
  { id: 'liquid', name: 'سائل', note: 'وحدات متصلة بحواف مستديرة' },
  { id: 'pearl', name: 'لؤلؤ', note: 'نقاط دائرية ناعمة' },
  { id: 'weave', name: 'نسيج', note: 'معيّنات على شبكة النقش' },
  { id: 'seal', name: 'ختم', note: 'شعار المسابقة في وسط الرمز' },
  { id: 'classic', name: 'كلاسيكي', note: 'مربعات تقليدية، أعلى توافق مع الطباعة' },
];

export type QrMatrix = boolean[][];
export function qrMatrix(text: string, level: 'M' | 'Q' | 'H' = 'Q'): QrMatrix {
  const q = qrcode(0, level);
  q.addData(text || ' ');
  q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
}

const isEye = (r: number, c: number, n: number) =>
  (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
const dark = (m: QrMatrix, r: number, c: number) => {
  const n = m.length;
  return r >= 0 && c >= 0 && r < n && c < n && m[r][c] && !isEye(r, c, n);
};
const f = (n: number) => Math.round(n * 1000) / 1000;
// A rectangle with its own radius per corner: top-left, top-right, bottom-right, bottom-left.
export function roundRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | [number, number, number, number],
) {
  const [a, b, c, d] = Array.isArray(r) ? r : [r, r, r, r];
  return (
    `M${f(x + a)} ${f(y)}H${f(x + w - b)}A${f(b)} ${f(b)} 0 0 1 ${f(x + w)} ${f(y + b)}` +
    `V${f(y + h - c)}A${f(c)} ${f(c)} 0 0 1 ${f(x + w - c)} ${f(y + h)}H${f(x + d)}` +
    `A${f(d)} ${f(d)} 0 0 1 ${f(x)} ${f(y + h - d)}V${f(y + a)}A${f(a)} ${f(a)} 0 0 1 ${f(x + a)} ${f(y)}Z`
  );
}
const circle = (cx: number, cy: number, r: number) =>
  `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;

type Eye = 'square' | 'round' | 'arch' | 'leaf' | 'badge';
const eyeOf: Record<QrStyle, Eye> = {
  classic: 'square',
  mihrab: 'arch',
  liquid: 'round',
  pearl: 'badge',
  weave: 'leaf',
  seal: 'round',
};
function eyePath(x: number, y: number, kind: Eye, corner: number) {
  const leaf = (k: number): [number, number, number, number] =>
    corner === 0 ? [k, 0, k, 0] : [0, k, 0, k];
  let o: number | [number, number, number, number] = 0,
    i: number | [number, number, number, number] = 0,
    c: number | [number, number, number, number] = 0;
  if (kind === 'round') [o, i, c] = [2.6, 1.5, 1.5];
  else if (kind === 'badge') [o, i, c] = [2, 1, 1.3];
  else if (kind === 'leaf') [o, i, c] = [leaf(3.2), leaf(1.7), leaf(1.3)];
  else if (kind === 'arch')
    [o, i, c] = [
      [3.5, 3.5, 0.4, 0.4],
      [2.5, 2.5, 0.01, 0.01],
      [1.5, 1.5, 0, 0],
    ];
  return (
    roundRect(x, y, 7, 7, o) + roundRect(x + 1, y + 1, 5, 5, i) + roundRect(x + 2, y + 2, 3, 3, c)
  );
}

// The cleared centre for the seal style: 9 modules square, within the H level's error budget.
export const SEAL_SIZE = 9;
export function sealStart(n: number) {
  return Math.floor((n - SEAL_SIZE) / 2);
}

export function qrPaths(m: QrMatrix, style: QrStyle) {
  const n = m.length;
  const seal = style === 'seal' ? sealStart(n) : -1;
  const cleared = (r: number, c: number) =>
    seal >= 0 && r >= seal && r < seal + SEAL_SIZE && c >= seal && c < seal + SEAL_SIZE;
  const on = (r: number, c: number) => dark(m, r, c) && !cleared(r, c);
  let d = '';
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (!on(r, c)) continue;
      const U = on(r - 1, c),
        D = on(r + 1, c),
        L = on(r, c - 1),
        R = on(r, c + 1);
      if (style === 'classic') d += `M${c - 0.02} ${r - 0.02}h1.04v1.04h-1.04Z`;
      else if (style === 'pearl') d += circle(c + 0.5, r + 0.5, 0.47);
      else if (style === 'liquid' || style === 'seal') {
        const k = 0.5;
        d += roundRect(c, r, 1, 1, [
          !U && !L ? k : 0,
          !U && !R ? k : 0,
          !D && !R ? k : 0,
          !D && !L ? k : 0,
        ]);
      } else if (style === 'mihrab') d += roundRect(c, r, 1, 1, [U ? 0 : 0.5, U ? 0 : 0.5, 0, 0]);
      else if (style === 'weave')
        d += `M${c + 0.5} ${r - 0.1}L${c + 1.1} ${r + 0.5}L${c + 0.5} ${r + 1.1}L${c - 0.1} ${r + 0.5}Z`;
    }
  const eyes = [
    [0, 0, 0],
    [n - 7, 0, 1],
    [0, n - 7, 2],
  ]
    .map(([x, y, k]) => eyePath(x, y, eyeOf[style], k))
    .join('');
  return { size: n, modules: d, eyes, seal: seal >= 0 ? { start: seal, size: SEAL_SIZE } : null };
}
// Seal needs the highest error correction to survive the cleared centre.
export const qrLevel = (style: QrStyle) => (style === 'seal' ? 'H' : 'Q');
