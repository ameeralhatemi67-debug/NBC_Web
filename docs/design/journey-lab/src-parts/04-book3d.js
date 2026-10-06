/* ---------- procedural 3D book (img2threejs approach: code-only, stylised, parts named for explode and click) ----------
   Reference: the competition book cover. Observed: flat paperback slab, aspect about 0.71, green vertical banner on the spine side
   with a scalloped lower edge and star lattice, medallion at the top of the banner, calligraphic green title on a pale ground.
   Inferred (hidden in a single view): page-block thickness, plain back cover, spine on the right for a right-to-left book.
   Not reproduced on purpose: the emblem, the author lines and the exact lettering. This is a stylised approximation. */
const BookGL = (() => {
  const W = 0.709, H = 1, T = 0.17, C = 0.02;
  const GREEN = '#2c9373';
  let coverCv = null, coverUrl = '';
  const coverTextures = new Set();
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function drawCover() {
    const w = 1024, h = Math.round(w / (W / H));
    const cv = coverCv || (coverCv = document.createElement('canvas'));
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.fillStyle = '#f3f5f2'; g.fillRect(0, 0, w, h);
    // soft pale swooshes
    g.save();
    for (const [x, y, rx, ry, rot, a] of [[0.25, 0.22, 0.55, 0.14, -0.5, 0.07], [0.3, 0.7, 0.6, 0.12, 0.35, 0.06], [0.15, 0.45, 0.4, 0.2, 0.9, 0.05]]) {
      g.beginPath(); g.ellipse(x * w, y * h, rx * w, ry * h, rot, 0, Math.PI * 2); g.fillStyle = `rgba(110,125,118,${a})`; g.fill();
    }
    g.restore();
    // banner
    const bx = 0.69 * w, bw = 0.255 * w, by = 0, bh = 0.86 * h;
    g.save();
    g.beginPath();
    g.moveTo(bx, by); g.lineTo(bx + bw, by); g.lineTo(bx + bw, bh - 40);
    const n = 7, step = bw / n;
    for (let i = 0; i < n; i++) { const x1 = bx + bw - i * step, x0 = x1 - step; g.quadraticCurveTo((x1 + x0) / 2, bh + 18, x0, bh - 40 + (i % 2 ? 0 : 0)); }
    g.lineTo(bx, bh - 40); g.closePath();
    // swallow point
    g.fillStyle = GREEN; g.fill();
    g.clip();
    g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 2;
    const s = 74;
    for (let y = -s; y < bh + s; y += s) for (let x = bx - s; x < bx + bw + s; x += s) {
      const cx = x + s / 2, cy = y + s / 2, r = s * 0.46;
      for (const rot of [0, Math.PI / 4]) { g.save(); g.translate(cx, cy); g.rotate(rot); g.strokeRect(-r, -r, r * 2, r * 2); g.restore(); }
    }
    g.restore();
    // medallion (geometric, not the real emblem)
    const mx = bx + bw / 2, my = 0.125 * h, mr = 0.07 * w;
    const gr = g.createLinearGradient(mx - mr, my - mr, mx + mr, my + mr); gr.addColorStop(0, '#e6bd55'); gr.addColorStop(1, '#a87a22');
    g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fillStyle = gr; g.fill();
    g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(mx, my, mr * 0.78, 0, 7); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, rr = i % 2 ? mr * 0.22 : mr * 0.5; g.lineTo(mx + Math.cos(a) * rr, my + Math.sin(a) * rr); }
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (const [yy, ww] of [[0.2, 0.17], [0.235, 0.2]]) { g.fillRect(mx - (ww * w) / 2, yy * h, ww * w, 7); }
    // title
    g.fillStyle = GREEN; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.direction = 'rtl';
    g.font = '700 205px "Noto Naskh Arabic", "Noto Sans Arabic", serif'; g.fillText('الانتماء', 0.355 * w, 0.46 * h);
    g.font = '700 108px "Noto Naskh Arabic", "Noto Sans Arabic", serif'; g.fillText('واللحمة الوطنية', 0.355 * w, 0.575 * h);
    g.fillStyle = '#b8892e'; g.fillRect(0.355 * w - 60, 0.63 * h, 120, 6);
    coverUrl = cv.toDataURL('image/jpeg', 0.86);
    return cv;
  }
  function coverImage() { if (!coverCv) drawCover(); return coverUrl; }
  function refreshCover() {
    drawCover();
    coverTextures.forEach((t) => (t.needsUpdate = true));
    document.querySelectorAll('img[data-cover]').forEach((im) => (im.src = coverUrl));
  }
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('700 100px "Noto Naskh Arabic"', 'الانتماء')]).then(refreshCover).catch(() => {});
  }

  function stripes(vertical) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const g = cv.getContext('2d');
    g.fillStyle = '#f2ecdc'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(150,138,110,0.35)';
    for (let i = 0; i < 256; i += 4) vertical ? g.fillRect(i, 0, 1, 256) : g.fillRect(0, i, 256, 1);
    return cv;
  }
  function spineCanvas() {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 512; const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, '#2a8a6b'); gr.addColorStop(1, '#23775c'); g.fillStyle = gr; g.fillRect(0, 0, 64, 512);
    g.fillStyle = '#d9a93a'; g.fillRect(0, 40, 64, 4); g.fillRect(0, 468, 64, 4);
    return cv;
  }
  function blobTexture() {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.38)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return cv;
  }
  function roundedRect(sh, w, h, r) {
    const x = -w / 2, y = -h / 2;
    sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r);
    sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h); sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r);
    sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
  }

  function build(THREE) {
    const tex = (cv, srgb = true) => { const t = new THREE.CanvasTexture(cv); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; };
    const rig = new THREE.Group(), book = new THREE.Group(); rig.add(book);

    // page block
    const edgeV = tex(stripes(true)), edgeH = tex(stripes(false));
    const plain = new THREE.MeshStandardMaterial({ color: 0xf4efe2, roughness: 0.95 });
    const pageMats = [plain, new THREE.MeshStandardMaterial({ map: edgeV, roughness: 0.95 }), new THREE.MeshStandardMaterial({ map: edgeH, roughness: 0.95 }), new THREE.MeshStandardMaterial({ map: edgeH, roughness: 0.95 }), plain, plain];
    const pageBlock = new THREE.Mesh(new THREE.BoxGeometry(W - 0.03, H - 0.035, T), pageMats);
    pageBlock.position.set(-0.004, 0, 0); pageBlock.name = 'pages';
    book.add(pageBlock);

    // covers (rounded extrusions)
    const cs = new THREE.Shape(); roundedRect(cs, W, H, 0.018);
    const cgeo = new THREE.ExtrudeGeometry(cs, { depth: C, bevelEnabled: false });
    const coverTex = tex(coverCv || drawCover()); coverTex.repeat.set(1 / W, 1 / H); coverTex.offset.set(0.5, 0.5); coverTextures.add(coverTex);
    const sideMat = new THREE.MeshStandardMaterial({ color: 0xe9ece7, roughness: 0.8 });
    const frontMat = [new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.52, metalness: 0 }), sideMat];
    const front = new THREE.Mesh(cgeo, frontMat); front.name = 'cover';
    const hinge = new THREE.Group(); hinge.name = 'cover';
    hinge.position.set(W / 2, 0, T / 2);
    front.position.set(-W / 2, 0, 0);
    hinge.add(front); book.add(hinge);

    const backTex = tex((() => { const c = document.createElement('canvas'); c.width = 256; c.height = 360; const g = c.getContext('2d'); g.fillStyle = '#f3f5f2'; g.fillRect(0, 0, 256, 360); g.fillStyle = GREEN; g.fillRect(176, 0, 52, 300); return c; })());
    backTex.repeat.set(1 / W, 1 / H); backTex.offset.set(0.5, 0.5);
    const back = new THREE.Mesh(cgeo, [new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.6 }), sideMat]);
    back.rotation.y = Math.PI; back.position.set(0, 0, -T / 2); back.name = 'back';
    book.add(back);

    // spine (right side, right-to-left book)
    const spineTex = tex(spineCanvas());
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.022, H, T + 2 * C), [new THREE.MeshStandardMaterial({ map: spineTex, roughness: 0.5 }), plain, plain, plain, plain, plain].map((m, i) => (i === 0 ? m : new THREE.MeshStandardMaterial({ color: 0x2a8a6b, roughness: 0.55 }))));
    spine.position.set(W / 2 + 0.006, 0, 0); spine.name = 'spine';
    book.add(spine);

    // ribbon bookmark (stylised addition, not in the reference)
    const rs = new THREE.Shape(); rs.moveTo(0, 0); rs.lineTo(0.04, 0); rs.lineTo(0.04, -0.24); rs.lineTo(0.02, -0.205); rs.lineTo(0, -0.24); rs.closePath();
    const ribbon = new THREE.Mesh(new THREE.ShapeGeometry(rs), new THREE.MeshStandardMaterial({ color: 0xb8892e, roughness: 0.6, side: THREE.DoubleSide }));
    ribbon.position.set(0.11, -(H - 0.035) / 2 + 0.01, T / 2 - 0.02); ribbon.name = 'ribbon';
    book.add(ribbon);

    // lights
    const amb = new THREE.HemisphereLight(0xffffff, 0xc9d6cf, 0.85); rig.add(amb);
    const key = new THREE.DirectionalLight(0xffffff, 0.95); key.position.set(-1.8, 2.6, 3.4); rig.add(key);
    const rim = new THREE.DirectionalLight(0xdff5ea, 0.35); rim.position.set(2.5, 1, -2); rig.add(rim);

    // soft ground blob
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobTexture()), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = -0.72; rig.add(blob);

    return { rig, book, hinge, pageBlock, back, spine, ribbon, blob, front, parts: { cover: hinge, pages: pageBlock, back, spine, ribbon } };
  }

  function mount(canvas, opts = {}) {
    const THREE = window.THREE;
    const holder = canvas.parentElement;
    const fallback = () => {
      holder.querySelectorAll('canvas').forEach((c) => c.remove());
      const im = document.createElement('img'); im.dataset.cover = '1'; im.alt = 'غلاف الكتاب'; im.src = coverImage();
      im.style.cssText = 'position:absolute;inset:8% 22%;height:84%;width:56%;object-fit:contain;border-radius:6px;box-shadow:0 18px 40px rgb(0 0 0 / .25);transform:perspective(900px) rotateY(-18deg) rotateX(4deg)';
      holder.appendChild(im);
      return { setOpen() {}, setExplode() {}, highlight() {}, destroy() {}, parts: {} };
    };
    if (!THREE) return fallback();
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { return fallback(); }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(opts.fov || 28, 1, 0.1, 30);
    cam.position.set(0, 0.06, opts.dist || 3.2); cam.lookAt(0, 0, 0);
    const M = build(THREE); scene.add(M.rig);
    const baseY = opts.baseY ?? -0.5, baseX = opts.baseX ?? 0.1;
    let open = 0, openT = 0, openFrom = 0, openStart = 0, openDur = 0;
    let explode = 0, hl = null, mx = 0.5, my = 0.5, ry = baseY, rx = baseX, t0 = performance.now(), last = t0, visible = true, raf = 0, alive = true;
    const labels = opts.labels || [];
    const v = new THREE.Vector3();

    function resize() {
      const w = holder.clientWidth, h = holder.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
      const fit = Math.min(1, (w / h) / 0.9); cam.position.z = (opts.dist || 3.2) / Math.max(0.62, fit);
    }
    const ro = new ResizeObserver(resize); ro.observe(holder); resize();

    function apply(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (openDur > 0) {
        const p = Math.min(1, (now - openStart) / openDur), e = 1 - Math.pow(1 - p, 3);
        open = openFrom + (openT - openFrom) * e; if (p >= 1) openDur = 0;
      }
      const idle = reduce() || opts.static ? 0 : 1;
      const tt = (now - t0) / 1000;
      const tRy = baseY + (mx - 0.5) * 0.55 + idle * Math.sin(tt * 0.6) * 0.07;
      const tRx = baseX - (my - 0.5) * 0.3 + idle * Math.sin(tt * 0.45) * 0.025;
      const k = 1 - Math.exp(-dt * 6);
      ry += (tRy - ry) * k; rx += (tRx - rx) * k;
      M.book.rotation.set(rx, ry, 0);
      M.book.position.y = idle * Math.sin(tt * 0.9) * 0.012;
      M.book.position.x = -open * 0.2;
      M.hinge.rotation.y = open * 2.55;
      const e = explode;
      M.hinge.position.z = T / 2 + e * 0.55; M.hinge.position.y = e * 0.05;
      M.back.position.z = -T / 2 - e * 0.55;
      M.spine.position.x = W / 2 + 0.006 + e * 0.32;
      M.ribbon.position.y = -(H - 0.035) / 2 + 0.01 - e * 0.28; M.ribbon.position.z = T / 2 - 0.02 + e * 0.1;
      M.blob.scale.set(1 + open * 0.5 + e * 0.4, 1, 1);
      M.rig.traverse((o) => {
        if (!o.material) return;
        const on = hl && (o.name === hl || (o.parent && o.parent.name === hl));
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.emissive) m.emissive.setHex(on ? 0x1b4a38 : 0x000000);
      });
      renderer.render(scene, cam);
      if (labels.length) {
        M.rig.updateMatrixWorld(true);
        const cw = holder.clientWidth, ch = holder.clientHeight;
        for (const l of labels) {
          const obj = M.parts[l.part]; v.set(...(l.at || [0, 0, 0])); obj.localToWorld(v); v.project(cam);
          l.el.style.left = (v.x * 0.5 + 0.5) * cw + 'px'; l.el.style.top = (-v.y * 0.5 + 0.5) * ch + 'px';
        }
      }
    }
    function loop(now) {
      if (!alive) return;
      raf = 0;
      if (visible && !document.hidden) { apply(now); raf = requestAnimationFrame(loop); }
    }
    const kick = () => { if (!raf && alive) { last = performance.now(); raf = requestAnimationFrame(loop); } };
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); });
    io.observe(canvas);
    document.addEventListener('visibilitychange', kick);
    if (opts.interactive !== false) {
      holder.addEventListener('pointermove', (e) => { const r = holder.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width; my = (e.clientY - r.top) / r.height; kick(); });
      holder.addEventListener('pointerleave', () => { mx = 0.5; my = 0.5; });
    }
    kick();
    return {
      parts: M.parts,
      setOpen(to, ms = 650) { openFrom = open; openT = to; openStart = performance.now(); openDur = reduce() ? 0 : ms; if (!openDur) open = to; kick(); },
      setExplode(v2) { explode = v2; kick(); },
      highlight(n) { hl = n; kick(); },
      get open() { return open; },
      destroy() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); },
    };
  }
  return { mount, coverImage, refreshCover };
})();
