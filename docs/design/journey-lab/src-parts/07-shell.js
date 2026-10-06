/* ---------- shell: tabs, journey, findings, ideas, design system ---------- */
const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
function shotHTML(src, pins) {
  return `<img src="${src}" alt="Captured screen from the local demo" width="1200">` + pins.map(([x, y, id]) => `<span class="pin" style="left:${x}%;top:${y}%" title="${id}">${id}</span>`).join('');
}
const SEVLABEL = { P1: 'Major', P2: 'Minor', P3: 'Polish' };
function findingLI(f) {
  return `<li><span class="sev ${f.sev}">${f.sev}</span><div style="display:grid;gap:2px;min-width:0"><strong><span class="mono">${f.id}</span> ${esc(f.t)}</strong><span class="why">${esc(f.why)}</span><span><b>Fix.</b> ${esc(f.fix)}</span><span class="file">${f.ref} (${f.ev === 'both' ? 'observed and in code' : f.ev === 'observed' ? 'observed in the running demo' : 'read in source'})</span></div></li>`;
}

/* tabs */
const TABS = ['journey', 'admin', 'findings', 'ideas', 'system'];
function showTab(t) {
  TABS.forEach((k) => { const on = k === t; $('#t-' + k).setAttribute('aria-selected', on); $('#v-' + k).hidden = !on; });
  LS.set('nbc-tab', t);
  if (t === 'admin') Admin.refresh();
  if (t === 'system') mountSystem();
  if (t === 'journey') requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}
TABS.forEach((k) => $('#t-' + k).addEventListener('click', () => { showTab(k); history.replaceState(null, '', '#' + k); }));
$('.tabs').addEventListener('keydown', (e) => {
  const i = TABS.findIndex((k) => $('#t-' + k).getAttribute('aria-selected') === 'true');
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length; showTab(TABS[n]); $('#t-' + TABS[n]).focus(); }
});

/* journey */
const J = { step: 1, view: 'proposed', device: 'desktop' };
const stepsEl = $('#steps');
stepsEl.innerHTML = STEPS.map((s) => `<button class="step" data-s="${s.id}"><b>${s.name}</b><span>${s.who}</span></button>`).join('');
function renderNotes() {
  const s = STEPS.find((x) => x.id === J.step);
  const fs = s.today.map((id) => FINDINGS.find((f) => f.id === id)).filter(Boolean);
  $('#notes').innerHTML = `
    <div class="card"><h2>${s.who}</h2><p class="muted">${s.moment}</p></div>
    <div class="card"><h3>Today</h3><ul class="fl">${fs.map(findingLI).join('')}</ul></div>
    <div class="card"><h3>Proposed</h3><ul class="bl">${s.proposed.map((p) => `<li>${p}</li>`).join('')}</ul></div>
    <div class="card"><h3>Lenses applied</h3><div class="lens">${s.lens.map(([n, w]) => `<span class="chip"><b>${n}</b> ${w}</span>`).join('')}</div></div>`;
}
function renderStage() {
  const s = STEPS.find((x) => x.id === J.step), stage = $('#stage'), dev = $('#device'), shot = $('#shot');
  stage.dataset.device = J.device;
  const today = J.view === 'today';
  dev.hidden = today; shot.hidden = !today;
  if (!today) return;
  if (!s.shot) {
    shot.className = 'nocap'; shot.style.maxWidth = '';
    shot.innerHTML = `<h3>No capture for this screen</h3><p class="muted">The intro needs a signed-in participant, so it was read from source instead. This is what <span class="file">participation.tsx:242</span> renders:</p><blockquote>${s.nocap.map(esc).join('<br>')}</blockquote><p class="muted">The state code is printed as stored.</p>`;
    return;
  }
  const phone = J.device === 'phone' && s.shot.m;
  shot.className = 'shot' + (s.shot.m ? ' has-m' : '');
  const pins = phone ? (s.shot.mpins || []) : s.shot.pins;
  shot.innerHTML = shotHTML(IMG[phone ? s.shot.m : s.shot.d], pins);
}
function setStep(n, restart = true) {
  J.step = n; $$('.step', stepsEl).forEach((b) => b.setAttribute('aria-current', +b.dataset.s === n ? 'step' : 'false'));
  renderNotes(); renderStage(); if (restart) Proto.scene(n); LS.set('nbc-step', n);
}
stepsEl.addEventListener('click', (e) => { const b = e.target.closest('.step'); if (b) setStep(+b.dataset.s); });
function seg(id, attr, fn) { $$(`#${id} button`).forEach((b) => b.addEventListener('click', () => { $$(`#${id} button`).forEach((x) => x.setAttribute('aria-pressed', x === b)); fn(b.dataset[attr]); })); }
seg('seg-view', 'v', (v) => { J.view = v; renderStage(); });
seg('seg-dev', 'd', (d) => { J.device = d; renderStage(); });
seg('seg-design', 'g', (g) => Proto.setDesign(g));
$('#sw-offline').addEventListener('change', (e) => Proto.setOffline(e.target.checked));
$('#sw-search').addEventListener('change', (e) => Proto.setSearch(e.target.checked));
$('#restart').addEventListener('click', () => Proto.scene(J.step));

/* findings */
function renderScores() {
  const tbl = (name, d) => {
    const scored = d.rows.reduce((a, r) => a + r[1], 0), pct = Math.round((scored / d.max) * 100);
    const band = pct >= 90 ? 'Excellent' : pct >= 70 ? 'Good' : pct >= 50 ? 'Acceptable' : pct >= 30 ? 'Poor' : 'Critical';
    return `<div class="card"><h2>${name}</h2><div class="tscroll"><table class="sc"><tbody>${d.rows.map((r, i) => `<tr><td class="n">${r[1]}</td><td>${r[0]}<div class="muted">${r[2]}</div></td></tr>`).join('')}<tr><td class="n">${scored}</td><td><b>of ${d.max}, ${band} (${pct}%)</b>${d.na ? `<div class="muted">${d.na}</div>` : ''}</td></tr></tbody></table></div></div>`;
  };
  $('#scores').innerHTML = tbl('Student exam, heuristic scores', SCORES.student) + tbl('Committee console, heuristic scores', SCORES.admin);
  $('#personas').innerHTML = `<h2>Persona red flags</h2><div class="two" style="margin-top:6px">${PERSONAS.map(([n, t]) => `<div><h3 style="color:var(--ink)">${n}</h3><p class="muted">${t}</p></div>`).join('')}</div><p class="muted" style="margin-top:8px">Scored by one reviewer in a single pass using the Impeccable heuristic scale. It is not the full two-agent critique run, so treat the numbers as a baseline, not a verdict.</p>`;
}
let ffilter = 'all';
function renderFindings() {
  const list = FINDINGS.filter((f) => ffilter === 'all' || f.s === ffilter);
  $('#f-count').textContent = `${list.length} findings`;
  $('#flist').innerHTML = list.map((f) => `<article class="fcard"><header><span class="sev ${f.sev}">${f.sev}</span><span class="mono">${f.id}</span><strong>${esc(f.t)}</strong></header><p class="why">${esc(f.why)}</p><p class="fx"><b>Fix.</b> ${esc(f.fix)}</p><p class="file">${f.ref} (${f.ev === 'both' ? 'observed and in code' : f.ev === 'observed' ? 'observed in the running demo' : 'read in source'})</p></article>`).join('');
}
seg('seg-f', 'f', (f) => { ffilter = f; renderFindings(); });

/* ideas with saved decisions */
let decisions = {}, DB = null;
try { decisions = JSON.parse(LS.get('nbc-decisions') || '{}'); } catch (e) { decisions = {}; }
function renderIdeas() {
  const counts = { build: 0, later: 0, skip: 0 };
  Object.values(decisions).forEach((v) => { if (counts[v] !== undefined) counts[v]++; });
  $('#ilist').innerHTML = IDEAS.map((i) => {
    const d = decisions[i.id];
    return `<article class="fcard idea" data-id="${i.id}"><header><span class="mono">${i.id}</span><strong>${esc(i.t)}</strong></header>
      <div class="meta"><span class="chip">Effort ${i.eff}</span><span class="chip">Impact ${i.imp}</span>${i.fixes.map((f) => `<span class="chip">fixes ${f}</span>`).join('')}<span class="chip">${i.lens}</span></div>
      <p class="file">${i.where}</p>
      <div class="decide" role="group" aria-label="Decision for ${esc(i.t)}">${['build', 'later', 'skip'].map((s) => `<button data-s="${s}" aria-pressed="${d === s}">${s === 'build' ? 'Build' : s === 'later' ? 'Later' : 'Skip'}</button>`).join('')}</div></article>`;
  }).join('');
  $('#sync').textContent = (DB ? 'Saved with this page. ' : 'Kept in this browser only. ') + `Build ${counts.build}, Later ${counts.later}, Skip ${counts.skip}.`;
}
$('#ilist').addEventListener('click', async (e) => {
  const b = e.target.closest('.decide button'); if (!b) return;
  const id = b.closest('.idea').dataset.id, s = b.dataset.s, was = decisions[id];
  const idea = IDEAS.find((x) => x.id === id);
  if (was === s) delete decisions[id]; else decisions[id] = s;
  LS.set('nbc-decisions', JSON.stringify(decisions)); renderIdeas();
  if (DB) {
    try {
      const ref = DB.doc('decisions/' + id);
      if (decisions[id]) await ref.set({ status: decisions[id], title: idea.t, fixes: idea.fixes, at: new Date().toISOString() }); else await ref.delete();
    } catch (err) { $('#sync').textContent = 'Could not save to the page. Kept in this browser only.'; }
  }
});
(async () => {
  try {
    if (!window.claude || !window.claude.use) return;
    DB = await window.claude.use('db'); if (!DB) return;
    DB.collection('decisions').onSnapshot((snap) => {
      const next = {}; snap.docs.forEach((d) => { const v = d.data(); if (v && v.status) next[d.id] = v.status; });
      if (Object.keys(next).length || Object.keys(decisions).length === 0) decisions = next;
      else if (Object.keys(decisions).length) { // push local-only choices once
        Object.entries(decisions).forEach(([id, s]) => { const i = IDEAS.find((x) => x.id === id); if (i) DB.doc('decisions/' + id).set({ status: s, title: i.t, fixes: i.fixes, at: new Date().toISOString() }).catch(() => {}); });
      }
      renderIdeas();
    }, () => {});
  } catch (e) { DB = null; }
})();

/* design system */
const TOKENS = [
  ['Original', [['paper', '#f7f3e8'], ['cream', '#f0eadc'], ['sand', '#e4dac5'], ['ink', '#193b30'], ['olive', '#18523f'], ['copper', '#846326'], ['danger', '#9a3328']]],
  ['Official', [['paper', '#ffffff'], ['cream', '#f0f7fa'], ['sand', '#dbe6ed'], ['ink', '#17384e'], ['blue', '#074572'], ['sky', '#0876a2'], ['accent', '#00a4e0']]],
  ['Hybrid', [['paper', '#ffffff'], ['cream', '#eff5f1'], ['sand', '#d9e5dd'], ['ink', '#193b30'], ['olive', '#18523f'], ['green', '#367356'], ['accent', '#4c9971']]],
];
$('#tokens').innerHTML = TOKENS.map(([n, c]) => `<div><h3 style="color:var(--ink);margin-bottom:6px">${n}</h3><div class="sw">${c.map(([k, v]) => `<div><i style="background:${v}"></i><span>${k} ${v}</span></div>`).join('')}</div></div>`).join('');
let sysBook = null;
const PARTD = { cover: 'Front cover. Hinged on the spine edge, opens about 146 degrees. Carries the projected title and banner texture.', pages: 'Page block. Fore edge and top use fine line textures so it reads as paper.', back: 'Back cover. Plain, with a short green stripe. Inferred, since the photo shows one side.', spine: 'Spine on the right edge, as in a right-to-left book. Green with gold rules.', ribbon: 'Ribbon bookmark with a swallow tail. A stylised addition, not in the reference.' };
function mountSystem() {
  if (sysBook) return;
  const holder = $('#b3d'); const labels = ['cover', 'pages', 'back', 'spine', 'ribbon'].map((p) => { const b = document.createElement('button'); b.className = 'part-lbl'; b.textContent = { cover: 'Cover', pages: 'Pages', back: 'Back', spine: 'Spine', ribbon: 'Ribbon' }[p]; b.setAttribute('aria-pressed', 'false'); b.dataset.p = p; holder.appendChild(b); return { el: b, part: p, at: { cover: [-0.35, 0.3, 0.05], pages: [-0.34, -0.2, 0], back: [0.2, 0.3, -0.05], spine: [0, 0.38, 0], ribbon: [0.02, -0.18, 0] }[p] }; });
  sysBook = BookGL.mount($('#cv-sys'), { baseY: -0.62, baseX: 0.18, dist: 3.4, labels });
  labels.forEach((l) => l.el.addEventListener('click', () => { const on = l.el.getAttribute('aria-pressed') !== 'true'; labels.forEach((x) => x.el.setAttribute('aria-pressed', 'false')); l.el.setAttribute('aria-pressed', on); sysBook.highlight(on ? l.part : null); $('#part-d').textContent = on ? PARTD[l.part] : 'Click a label to highlight a part.'; }));
  $('#explode').addEventListener('input', (e) => sysBook.setExplode(e.target.value / 100));
  seg('seg-open', 'o', (o) => sysBook.setOpen(+o));
}

/* boot */
renderScores(); renderFindings(); renderIdeas();
Admin.init();
const hash = (location.hash || '').replace('#', '');
showTab(TABS.includes(hash) ? hash : 'journey');
setStep(+LS.get('nbc-step') || 1);
