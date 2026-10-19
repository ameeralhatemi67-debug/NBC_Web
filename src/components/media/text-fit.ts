'use client';
// Wraps poster text to its box and shrinks it until it fits, measuring with the poster fonts.
// Edited text therefore never overflows; when even the smallest size cannot hold it, the last
// line is cut with an ellipsis and the fit is reported as failed (shown in the checks).
export type FitSpec = {
  text: string;
  width: number;
  height: number;
  family: string;
  weight: number;
  max: number;
  min: number;
  maxLines: number;
  lineHeight: number;
};
export type Fit = { size: number; lines: string[]; ok: boolean; widths: number[] };

let context: CanvasRenderingContext2D | null = null;
function ctx() {
  context ??= document.createElement('canvas').getContext('2d');
  return context!;
}
export function measure(text: string, family: string, weight: number, size: number) {
  const c = ctx();
  c.font = `${weight} ${size}px "${family}"`;
  return c.measureText(text).width;
}

function wrap(paragraphs: string[], spec: FitSpec, size: number) {
  const lines: string[] = [];
  const space = measure(' ', spec.family, spec.weight, size);
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '',
      width = 0;
    for (const word of words) {
      const w = measure(word, spec.family, spec.weight, size);
      if (line && width + space + w > spec.width) {
        lines.push(line);
        line = word;
        width = w;
      } else {
        line = line ? `${line} ${word}` : word;
        width = line === word ? w : width + space + w;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

// Like CSS text-wrap: balance. Keeps the line count but narrows the measure as far as it can,
// so a title never ends on one stranded word.
function balance(fit: Fit, paragraphs: string[], spec: FitSpec): Fit {
  if (fit.lines.length < 2) return fit;
  let lo = spec.width * 0.4,
    hi = spec.width;
  let best = fit;
  for (let i = 0; i < 9; i++) {
    const mid = (lo + hi) / 2;
    const lines = wrap(paragraphs, { ...spec, width: mid }, fit.size);
    if (lines.length === fit.lines.length) {
      hi = mid;
      best = {
        ...fit,
        lines,
        widths: lines.map((l) => measure(l, spec.family, spec.weight, fit.size)),
      };
    } else lo = mid;
  }
  return best;
}

const cache = new Map<string, Fit>();
export function fitText(spec: FitSpec): Fit {
  const key = JSON.stringify(spec);
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size > 4000) cache.clear();
  const paragraphs = spec.text
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);
  let result: Fit | null = null;
  if (!paragraphs.length) result = { size: spec.max, lines: [], ok: true, widths: [] };
  for (
    let size = spec.max;
    !result && size >= spec.min;
    size = size > spec.min ? Math.max(spec.min, size * 0.94) : spec.min - 1
  ) {
    const lines = wrap(paragraphs, spec, size);
    const widths = lines.map((l) => measure(l, spec.family, spec.weight, size));
    if (
      lines.length <= spec.maxLines &&
      widths.every((w) => w <= spec.width + 0.5) &&
      lines.length * size * spec.lineHeight <= spec.height + 0.5
    )
      result = balance({ size, lines, ok: true, widths }, paragraphs, spec);
  }
  if (!result) {
    const size = spec.min;
    // At the smallest size only the line limit cuts text; height alone never hides words.
    const fits = Math.max(1, spec.maxLines);
    let lines = wrap(paragraphs, spec, size);
    const truncated = lines.length > fits;
    if (truncated) {
      lines = lines.slice(0, fits);
      let last = lines[fits - 1];
      while (last.includes(' ') && measure(`${last}…`, spec.family, spec.weight, size) > spec.width)
        last = last.slice(0, last.lastIndexOf(' '));
      lines[fits - 1] = `${last}…`;
    }
    const widths = lines.map((l) => measure(l, spec.family, spec.weight, size));
    // Only cut or over-wide text counts as not fitting; a block a little taller than its share
    // still reads in full.
    result = { size, lines, ok: !truncated && widths.every((w) => w <= spec.width + 0.5), widths };
  }
  cache.set(key, result);
  return result;
}
export function clearFitCache() {
  cache.clear();
}
