// Pure proportions, timings and renderer choice for the 3D book. No `three` import here: the
// intro and result load this file eagerly, while the scene itself is a dynamic import.
export const BOOK_HEIGHT = 1;
export const OPEN_MS = 650;
export const CLOSE_MS = 800;
export const OPEN_ANGLE_DEG = 146;
export const SWAY_DEG = 4;
export const SWAY_PERIOD_S = 9;
export const BOOK_PART_NAMES = ['cover', 'pages', 'back', 'spine'] as const;
export type BookPartName = (typeof BOOK_PART_NAMES)[number];

// Thin softcover: about 2.6% of the cover height at 66 pages, growing with the page count.
export function thicknessRatio(pageCount: number) {
  const count = Math.max(1, Math.floor(pageCount));
  return Math.min(0.06, Math.max(0.015, 0.0092 + count * 0.00025));
}

export function bookDimensions(pageWidth: number, pageHeight: number, pageCount: number) {
  const ratio = pageWidth > 0 && pageHeight > 0 ? pageWidth / pageHeight : 0.7071;
  return {
    height: BOOK_HEIGHT,
    width: BOOK_HEIGHT * ratio,
    depth: BOOK_HEIGHT * thicknessRatio(pageCount),
  };
}

export function easeInOutCubic(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// 0 closed, 1 open. Deterministic: depends only on elapsed time.
export function transitionProgress(
  from: number,
  to: number,
  elapsedMs: number,
  durationMs: number,
) {
  if (durationMs <= 0) return to;
  return from + (to - from) * easeInOutCubic(elapsedMs / durationMs);
}

export function idleSwayRadians(seconds: number, enabled: boolean) {
  if (!enabled) return 0;
  return ((SWAY_DEG * Math.PI) / 180) * Math.sin((seconds / SWAY_PERIOD_S) * Math.PI * 2);
}

export type RendererEnvironment = {
  webgl: boolean;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  saveData?: boolean;
};

export function isLowPower(env: Omit<RendererEnvironment, 'webgl'>) {
  return (
    (env.hardwareConcurrency !== undefined && env.hardwareConcurrency <= 2) ||
    (env.deviceMemory !== undefined && env.deviceMemory <= 2) ||
    env.saveData === true
  );
}

export function chooseRenderer(env: RendererEnvironment): '3d' | 'flat' {
  return env.webgl && !isLowPower(env) ? '3d' : 'flat';
}

// Client only. A probe context is released straight away so it never counts against the page.
export function probeRendererEnvironment(): RendererEnvironment {
  let webgl = false;
  try {
    const probe = document.createElement('canvas');
    const gl = (probe.getContext('webgl2') ?? probe.getContext('webgl')) as
      WebGL2RenderingContext | WebGLRenderingContext | null;
    webgl = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl = false;
  }
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return {
    webgl,
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    saveData: nav.connection?.saveData,
  };
}
