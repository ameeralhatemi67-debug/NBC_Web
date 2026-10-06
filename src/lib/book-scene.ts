// The only module that imports `three`. It is loaded with a dynamic import() from book-stage.tsx,
// which is mounted on the intro and result screens only, never on the exam screen.
import {
  BackSide,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  FrontSide,
  Group,
  HemisphereLight,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import {
  CLOSE_MS,
  OPEN_ANGLE_DEG,
  OPEN_MS,
  bookDimensions,
  idleSwayRadians,
  transitionProgress,
  type BookPartName,
} from './book-model';

export type BookSceneState = 'closed' | 'opening' | 'open' | 'closing';
export type BookSceneOptions = {
  canvas: HTMLCanvasElement;
  cover: HTMLCanvasElement;
  pageCount: number;
  reducedMotion: boolean;
  finePointer: boolean;
  initialProgress?: 0 | 1;
  onState?: (state: BookSceneState) => void;
  onContextLost?: () => void;
};
export type BookScene = {
  readonly parts: Record<BookPartName, Object3D>;
  readonly state: BookSceneState;
  readonly progress: number;
  readonly anisotropy: number;
  readonly thickness: number;
  readonly frames: number;
  memory(): { geometries: number; textures: number };
  open(): Promise<void>;
  close(): Promise<void>;
  explode(amount: number): void;
  renderAt(progress: number, seconds?: number, frontal?: boolean): void;
  dispose(): void;
};

type Rgb = [number, number, number];
const PAPER_DEFAULT: Rgb = [241, 240, 236];
const BANNER_DEFAULT: Rgb = [46, 139, 106];

// Reads the real cover, so the back and spine take their colours from it. No invented artwork.
function sampleCover(cover: HTMLCanvasElement) {
  const result = { paper: PAPER_DEFAULT, banner: BANNER_DEFAULT };
  try {
    const context = cover.getContext('2d', { willReadFrequently: true });
    if (!context) return result;
    const region = (x0: number, y0: number, x1: number, y1: number, keep: (c: Rgb) => boolean) => {
      const x = Math.floor(cover.width * x0),
        y = Math.floor(cover.height * y0);
      const w = Math.max(1, Math.floor(cover.width * (x1 - x0))),
        h = Math.max(1, Math.floor(cover.height * (y1 - y0)));
      const { data } = context.getImageData(x, y, w, h);
      const total: Rgb = [0, 0, 0];
      let count = 0;
      for (let i = 0; i < data.length; i += 16) {
        const c: Rgb = [data[i], data[i + 1], data[i + 2]];
        if (data[i + 3] < 250 || !keep(c)) continue;
        total[0] += c[0];
        total[1] += c[1];
        total[2] += c[2];
        count += 1;
      }
      return count > 20 ? (total.map((v) => Math.round(v / count)) as Rgb) : null;
    };
    result.paper =
      region(0.03, 0.03, 0.3, 0.12, ([r, g, b]) => Math.min(r, g, b) > 200) ?? PAPER_DEFAULT;
    result.banner =
      region(
        0.72,
        0.05,
        0.93,
        0.55,
        ([r, g, b]) => g > r + 14 && g > b && r + g + b < 480 && r + g + b > 120,
      ) ?? BANNER_DEFAULT;
  } catch {
    // Keep the neutral defaults when pixels cannot be read.
  }
  return result;
}

function lineTexture(vertical: boolean, sheets: number, track: (t: Texture) => Texture) {
  const canvas = document.createElement('canvas');
  canvas.width = vertical ? 256 : 32;
  canvas.height = vertical ? 32 : 256;
  const context = canvas.getContext('2d')!;
  const length = vertical ? canvas.width : canvas.height;
  const step = length / sheets;
  context.fillStyle = '#f1ede2';
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < sheets; i += 1) {
    // Deterministic variation: no Math.random, so every build draws the same book.
    const shade = 0.16 + 0.1 * Math.abs(Math.sin(i * 12.9898));
    context.fillStyle = `rgba(112, 100, 78, ${shade.toFixed(3)})`;
    const at = Math.round(i * step);
    if (vertical) context.fillRect(at, 0, 1, canvas.height);
    else context.fillRect(0, at, canvas.width, 1);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return track(texture);
}

function radial(track: (t: Texture) => Texture) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(20, 24, 18, 0.55)');
  gradient.addColorStop(0.55, 'rgba(20, 24, 18, 0.18)');
  gradient.addColorStop(1, 'rgba(20, 24, 18, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return track(new CanvasTexture(canvas));
}

function spineTexture(banner: Rgb, track: (t: Texture) => Texture) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 8;
  const context = canvas.getContext('2d')!;
  context.fillStyle = `rgb(${banner.join(',')})`;
  context.fillRect(0, 0, 64, 8);
  context.fillStyle = 'rgba(255, 255, 255, 0.34)';
  context.fillRect(0, 0, 3, 8);
  context.fillRect(61, 0, 3, 8);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return track(texture);
}

export function createBookScene(options: BookSceneOptions): BookScene {
  const { canvas, cover, reducedMotion } = options;
  const disposables: { dispose(): void }[] = [];
  const geometry = <T extends BufferGeometry>(item: T) => (disposables.push(item), item);
  const material = <T extends Material>(item: T) => (disposables.push(item), item);
  const texture = <T extends Texture>(item: T) => (disposables.push(item), item);
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  const anisotropy = Math.max(1, Math.min(8, renderer.capabilities.getMaxAnisotropy()));

  const {
    width: W,
    height: H,
    depth: D,
  } = bookDimensions(cover.width, cover.height, options.pageCount);
  const colors = sampleCover(cover);
  const paper = new Color().setRGB(
    colors.paper[0] / 255,
    colors.paper[1] / 255,
    colors.paper[2] / 255,
    SRGBColorSpace,
  );
  const banner = new Color().setRGB(
    colors.banner[0] / 255,
    colors.banner[1] / 255,
    colors.banner[2] / 255,
    SRGBColorSpace,
  );
  const sheetColor = new Color(0xf6f4ec);

  const coverMap = texture(new CanvasTexture(cover));
  coverMap.colorSpace = SRGBColorSpace;
  coverMap.anisotropy = anisotropy;
  coverMap.minFilter = LinearMipmapLinearFilter;
  coverMap.generateMipmaps = true;

  const scene = new Scene();
  const camera = new PerspectiveCamera(26, 1, 0.1, 20);
  const rig = new Group();
  rig.name = 'book-rig';
  const book = new Group();
  book.name = 'book';
  rig.add(book);
  scene.add(rig);

  // Parts: pages, back (+ stripe), spine, cover (hinged on the spine edge, which is on the right).
  const sheets = Math.max(8, Math.ceil(options.pageCount / 2));
  const edgeVertical = lineTexture(true, sheets, texture);
  const edgeHorizontal = lineTexture(false, sheets, texture);
  for (const map of [edgeVertical, edgeHorizontal]) map.anisotropy = anisotropy;
  const edgeMaterial = (map: Texture) =>
    material(new MeshStandardMaterial({ map, roughness: 0.9, metalness: 0 }));
  const sheetMaterial = material(
    new MeshStandardMaterial({ color: sheetColor, roughness: 0.9, metalness: 0 }),
  );
  const inset = 0.012;
  const pagesWidth = W - inset,
    pagesHeight = H - inset,
    pagesDepth = D - 0.006;
  const pages = new Mesh(geometry(new BoxGeometry(pagesWidth, pagesHeight, pagesDepth)), [
    sheetMaterial, // +x, under the spine
    edgeMaterial(edgeVertical), // -x, fore edge
    edgeMaterial(edgeHorizontal), // +y
    edgeMaterial(edgeHorizontal), // -y
    sheetMaterial, // +z, first leaf under the cover
    sheetMaterial, // -z
  ]);
  pages.name = 'pages';
  const pagesHome = { x: W / 2 - pagesWidth / 2, y: 0, z: 0.001 };
  pages.position.set(pagesHome.x, pagesHome.y, pagesHome.z);

  const back = new Group();
  back.name = 'back';
  const backBoard = new Mesh(
    geometry(new BoxGeometry(W, H, 0.004)),
    material(new MeshStandardMaterial({ color: paper, roughness: 0.5, metalness: 0 })),
  );
  backBoard.name = 'back-board';
  const stripe = new Mesh(
    geometry(new PlaneGeometry(W * 0.06, H * 0.82)),
    material(new MeshStandardMaterial({ color: banner, roughness: 0.5, metalness: 0 })),
  );
  stripe.name = 'back-stripe';
  stripe.rotation.y = Math.PI;
  stripe.position.set(W * 0.325, H * 0.09, -0.0021);
  back.add(backBoard, stripe);
  const backHome = { x: 0, y: 0, z: -D / 2 + 0.002 };
  back.position.set(backHome.x, backHome.y, backHome.z);

  const spine = new Mesh(
    geometry(new PlaneGeometry(D, H)),
    material(
      new MeshStandardMaterial({
        map: spineTexture(colors.banner, texture),
        roughness: 0.5,
        metalness: 0,
      }),
    ),
  );
  spine.name = 'spine';
  spine.rotation.y = Math.PI / 2;
  const spineHome = { x: W / 2 + 0.0008, y: 0, z: 0 };
  spine.position.set(spineHome.x, spineHome.y, spineHome.z);

  // Cover: one bent sheet. The fore edge curls toward the reader by about 5 degrees.
  const sheet = geometry(new PlaneGeometry(W, H, 28, 1));
  const zone = W * 0.14,
    lift = (zone * Math.tan((5 * Math.PI) / 180)) / 2;
  const positions = sheet.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const fromForeEdge = positions.getX(i) + W / 2;
    if (fromForeEdge < zone) positions.setZ(i, lift * Math.pow(1 - fromForeEdge / zone, 2));
  }
  positions.needsUpdate = true;
  sheet.computeVertexNormals();
  const front = new Mesh(
    sheet,
    material(
      new MeshStandardMaterial({ map: coverMap, roughness: 0.5, metalness: 0, side: FrontSide }),
    ),
  );
  front.name = 'cover-front';
  const inside = new Mesh(
    sheet,
    material(
      new MeshStandardMaterial({
        color: paper.clone().multiplyScalar(0.9),
        roughness: 0.7,
        metalness: 0,
        side: BackSide,
      }),
    ),
  );
  inside.name = 'cover-inside';
  front.position.x = inside.position.x = -W / 2;
  const coverPart = new Group();
  coverPart.name = 'cover';
  coverPart.add(front, inside);
  const coverHome = { x: W / 2, y: 0, z: D / 2 };
  coverPart.position.set(coverHome.x, coverHome.y, coverHome.z);

  book.add(back, pages, spine, coverPart);
  const parts: Record<BookPartName, Object3D> = {
    cover: coverPart,
    pages,
    back,
    spine,
  };

  const shadowMap = radial(texture);
  const shadow = new Mesh(
    geometry(new PlaneGeometry(1, 1)),
    material(
      new MeshBasicMaterial({
        map: shadowMap,
        transparent: true,
        depthWrite: false,
        opacity: 0.85,
      }),
    ),
  );
  shadow.name = 'contact-shadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -H / 2 - 0.002;
  scene.add(shadow);

  scene.add(
    new HemisphereLight(0xffffff, 0xf0ebe0, 2.2),
    (() => {
      const key = new DirectionalLight(0xffffff, 1.75);
      key.position.set(-1.4, 1.8, 2.6);
      return key;
    })(),
    (() => {
      const rim = new DirectionalLight(0xdce8ff, 0.55);
      rim.position.set(1.8, 0.7, -1.6);
      return rim;
    })(),
  );

  // Pose and framing. The camera dollies out as the cover opens so the open cover stays in frame.
  let width = 1,
    height = 1;
  let progress: number = options.initialProgress ?? 0;
  let state: BookSceneState = progress ? 'open' : 'closed';
  let exploded = 0;
  let pointerX = 0,
    pointerY = 0,
    smoothX = 0,
    smoothY = 0;
  const showcaseYaw = (-14 * Math.PI) / 180,
    showcasePitch = (3 * Math.PI) / 180;
  let baseYaw = showcaseYaw,
    basePitch = showcasePitch;
  const fov = (camera.fov * Math.PI) / 180;
  function frame(p: number) {
    const spanW = W * (1.34 + 0.62 * p),
      spanH = H * (1.18 + 0.1 * p);
    const aspect = width / Math.max(1, height);
    const distance = Math.max(
      spanH / 2 / Math.tan(fov / 2),
      spanW / 2 / Math.tan(fov / 2) / aspect,
    );
    camera.aspect = aspect;
    camera.position.set(0, H * 0.1, distance);
    camera.lookAt(0, -H * 0.02, 0);
    camera.updateProjectionMatrix();
  }
  function pose(p: number, seconds: number) {
    coverPart.rotation.y = ((OPEN_ANGLE_DEG * Math.PI) / 180) * p;
    rig.position.x = -W * 0.415 * p;
    rig.rotation.y = baseYaw + idleSwayRadians(seconds, !reducedMotion) + smoothX * 0.1;
    rig.rotation.x = basePitch - smoothY * 0.06;
    shadow.position.x = rig.position.x + W * 0.2 * p;
    shadow.scale.set(W * (1.1 + 0.9 * p), 0.5, 1);
    const spread = exploded * 0.18;
    back.position.z = backHome.z - spread * 2;
    pages.position.z = pagesHome.z - spread;
    spine.position.x = spineHome.x + spread;
    coverPart.position.z = coverHome.z + spread * 2;
    frame(p);
  }
  let frames = 0;
  function draw() {
    frames += 1;
    renderer.render(scene, camera);
  }
  function resize() {
    const box = canvas.parentElement?.getBoundingClientRect() ?? canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(box.width));
    height = Math.max(1, Math.round(box.height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
  }

  // Render loop, paused when off screen or hidden. Static (reduced motion) scenes draw on demand.
  let raf = 0,
    visible = true,
    disposed = false,
    clock0 = 0,
    seconds = 0;
  let transition: {
    from: number;
    to: number;
    start: number;
    duration: number;
    done: () => void;
  } | null = null;
  const animating = () => Boolean(transition) || !reducedMotion;
  function tick(now: number) {
    raf = 0;
    if (disposed) return;
    if (!clock0) clock0 = now;
    seconds = (now - clock0) / 1000;
    smoothX += (pointerX - smoothX) * 0.08;
    smoothY += (pointerY - smoothY) * 0.08;
    if (transition) {
      const elapsed = now - transition.start;
      progress = transitionProgress(transition.from, transition.to, elapsed, transition.duration);
      if (elapsed >= transition.duration) finish();
    }
    pose(progress, seconds);
    draw();
    schedule();
  }
  function schedule() {
    if (raf || disposed || !visible || document.hidden || !animating()) return;
    raf = requestAnimationFrame(tick);
  }
  function redraw() {
    pose(progress, seconds);
    draw();
    schedule();
  }
  function setState(next: BookSceneState) {
    state = next;
    options.onState?.(next);
  }
  function finish() {
    if (!transition) return;
    const done = transition.done;
    progress = transition.to;
    transition = null;
    setState(progress ? 'open' : 'closed');
    done();
  }
  function go(to: 0 | 1, duration: number) {
    if (disposed) return Promise.resolve();
    if (transition) finish();
    if (progress === to) return Promise.resolve();
    if (reducedMotion) {
      progress = to;
      setState(to ? 'open' : 'closed');
      redraw();
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      let timer = 0;
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      transition = { from: progress, to, start: performance.now(), duration, done };
      setState(to ? 'opening' : 'closing');
      // A hidden tab pauses requestAnimationFrame. Never leave Start waiting on it.
      timer = window.setTimeout(() => {
        if (transition?.done === done) finish();
        redraw();
      }, duration + 150);
      schedule();
    });
  }

  const onPointer = (event: PointerEvent) => {
    const box = canvas.getBoundingClientRect();
    pointerX = Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width) * 2 - 1));
    pointerY = Math.max(-1, Math.min(1, ((event.clientY - box.top) / box.height) * 2 - 1));
    schedule();
  };
  if (options.finePointer && !reducedMotion) window.addEventListener('pointermove', onPointer);
  const onVisibility = () => {
    if (!document.hidden) schedule();
  };
  document.addEventListener('visibilitychange', onVisibility);
  const observer =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver((entries) => {
          visible = entries.some((entry) => entry.isIntersecting);
          if (visible) schedule();
        });
  observer?.observe(canvas);
  const resizeObserver =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          resize();
          redraw();
        });
  resizeObserver?.observe(canvas.parentElement ?? canvas);
  const onLost = (event: Event) => {
    event.preventDefault();
    options.onContextLost?.();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  resize();
  redraw();

  return {
    parts,
    anisotropy,
    thickness: D / H,
    get state() {
      return state;
    },
    get progress() {
      return progress;
    },
    get frames() {
      return frames;
    },
    memory: () => ({
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    }),
    open: () => go(1, OPEN_MS),
    close: () => go(0, CLOSE_MS),
    explode(amount) {
      exploded = Math.max(0, Math.min(1, amount));
      redraw();
    },
    // Deterministic pose for tests and screenshots: no clock, no pointer.
    renderAt(at, time = 0, frontal = false) {
      baseYaw = frontal ? 0 : showcaseYaw;
      basePitch = frontal ? 0 : showcasePitch;
      progress = Math.max(0, Math.min(1, at));
      seconds = time;
      smoothX = smoothY = 0;
      pose(progress, seconds);
      draw();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      transition?.done();
      transition = null;
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      observer?.disconnect();
      resizeObserver?.disconnect();
      for (const item of disposables) item.dispose();
      // Safety net: any texture still attached to a material is released too.
      scene.traverse((node) => {
        const materials = (node as Mesh).material;
        for (const entry of Array.isArray(materials) ? materials : materials ? [materials] : [])
          for (const value of Object.values(entry))
            if ((value as Texture | null)?.isTexture) (value as Texture).dispose();
      });
      renderer.dispose();
    },
  };
}
