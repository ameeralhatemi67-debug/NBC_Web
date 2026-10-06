/* ---------- shared helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* Arabic plural forms: one, two, few (3-10), many (11-99). Used in place of "1 أحداث". */
function arPlural(n, forms) {
  const [one, two, few, many] = forms;
  if (n === 1) return one;
  if (n === 2) return two;
  const m = n % 100;
  if (m >= 3 && m <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}
const pairLtr = (a, b) => `<bdi dir="ltr">${a} / ${b}</bdi>`;

/* ---------- the student exam prototype ---------- */
const Proto = (() => {
  const root = $('#px-root');
  const px = document.createElement('div');
  px.className = 'px'; px.dataset.design = 'original'; px.dataset.screen = 'intro'; px.lang = 'ar'; px.dir = 'rtl';
  px.dataset.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches ? '1' : '0';
  root.appendChild(px);

  const S = {
    screen: 'intro', q: 0, sel: QS.map(() => []), locked: QS.map(() => false), pending: QS.map(() => false), visited: QS.map((_, i) => i === 0),
    page: 2, maxPage: 2, zoom: 1, hint: false, offline: false, search: false, night: false, bookOpen: true, snap: 1, review: false, peekHeights: [0, 0.46, 0.8],
    sync: 0,
  };
  const total = QS.length;
  const correct = (i) => { const q = QS[i], a = S.sel[i]; return a.length === q.a.length && a.every((x) => q.a.includes(x)); };
  const hintOk = (i) => S.maxPage > QS[i].pg;
  const lockedCount = () => S.locked.filter(Boolean).length;
  const results = () => QS.map((_, i) => (!S.locked[i] ? 'none' : S.pending[i] ? 'pend' : correct(i) ? 'ok' : 'bad'));

  px.innerHTML = `
  <section class="scr s-intro" aria-label="المقدمة">
    <div class="intro-grid">
      <div class="intro-copy">
        <h1>أهلًا يوسف</h1>
        <span class="pill">المرحلة المتوسطة</span>
        <ul class="facts">
          <li><span class="ic">${ic('book')}</span><span><b>10 أسئلة</b> من الكتاب (في المسابقة الفعلية 20)</span></li>
          <li><span class="ic">${ic('clock')}</span><span>بلا مؤقّت لكل سؤال، خذ وقتك</span></li>
          <li><span class="ic">${ic('lock')}</span><span>الإجابة نهائية بعد تثبيتها</span></li>
          <li><span class="ic">${ic('book-open')}</span><span>الكتاب مفتوح بجانب السؤال</span></li>
        </ul>
        <div class="ready">${ic('check')} الكتاب جاهز دون اتصال، وتُحفظ إجاباتك تلقائيًا</div>
        <div class="cta-row">
          <button class="pbtn pri" id="start">ابدأ المشاركة ${ic('arrow-l')}</button>
          <span class="close-note">تُغلق المسابقة بعد 3 أيام</span>
        </div>
      </div>
      <div class="intro-book" aria-hidden="true"><canvas id="cv-intro"></canvas></div>
    </div>
  </section>

  <section class="scr s-exam" aria-label="الاختبار">
    <header class="px-top">
      <h1>المرحلة المتوسطة</h1>
      <div class="strip" id="strip" role="group" aria-label="الأسئلة"></div>
      <span class="save ok" id="save" role="status" aria-live="polite"></span>
    </header>
    <div class="px-off" id="off" hidden><span>${ic('wifi-off')}</span><span id="off-t"></span><button class="pbtn" id="off-retry">أعد المحاولة</button></div>
    <div class="split" id="split">
      <section class="pq" aria-label="السؤال">
        <div class="pq-scroll" id="qscroll"></div>
        <footer class="pq-foot" id="qfoot"></footer>
      </section>
      <div class="handle" id="handle" role="button" tabindex="0" aria-label="تبديل عرض الكتاب"><span class="grip"></span><span class="lbl" id="handle-l"></span></div>
      <section class="pbk" id="pbk" aria-label="الكتاب">
        <div class="bk-bar">
          <div class="bk-toc"><button class="pbtn ghost mini" id="toc-b" aria-expanded="false" aria-haspopup="true">${ic('list')} المحتويات</button><div class="bk-pop" id="toc-pop" hidden></div></div>
          <div class="grp pg"><button class="ibtn" id="pg-prev" aria-label="الصفحة السابقة">${ic('chev-l')}</button><input class="pgi" id="pg-in" inputmode="numeric" aria-label="رقم الصفحة"><span id="pg-tot">/ ${BOOK_PAGES}</span><button class="ibtn" id="pg-next" aria-label="الصفحة التالية">${ic('chev-r')}</button></div>
          <span class="sp"></span>
          <div class="grp zoom"><button class="ibtn" id="z-out" aria-label="تصغير">${ic('minus')}</button><span id="z-v" style="min-width:40px;text-align:center;font-variant-numeric:tabular-nums">100%</span><button class="ibtn" id="z-in" aria-label="تكبير">${ic('plus')}</button></div>
          <div class="grp"><button class="ibtn" id="b-search" aria-label="بحث في الكتاب" aria-pressed="false" hidden>${ic('search')}</button><button class="ibtn" id="b-night" aria-label="وضع القراءة الليلي" aria-pressed="false">${ic('moon')}</button></div>
        </div>
        <div class="bk-search" id="bk-search" hidden><input id="bk-q" placeholder="ابحث في الكتاب" aria-label="ابحث في الكتاب"><div class="bk-res" id="bk-res"></div></div>
        <div class="bk-hint" id="bk-hint" hidden><span>التلميح: صفحة المصدر والتي قبلها فقط</span><button id="hint-off">العودة إلى الكتاب كاملًا</button></div>
        <div class="bk-scroll" id="bk-scroll" tabindex="0" aria-label="صفحات الكتاب"></div>
      </section>
    </div>
    <div class="sheet-back" id="sheet" hidden>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t">
        <h2 id="sh-t">راجع إجاباتك قبل الإرسال</h2>
        <div class="strip rv-grid" id="rv-grid"></div>
        <div class="rv-sum" id="rv-sum"></div>
        <div class="warn">${ic('lock')}<span>بعد الإرسال لا يمكنك تعديل أي إجابة، ولا بدء محاولة ثانية.</span></div>
        <div class="acts"><button class="pbtn pri" id="sh-go">أرسل مشاركتي</button><button class="pbtn" id="sh-back">سأراجع أولًا</button></div>
      </div>
    </div>
  </section>

  <section class="scr s-receipt" aria-label="النتيجة">
    <div class="rc">
      <div class="rc-main">
        <h1>تم استلام مشاركتك</h1>
        <p class="sub" id="rc-sum"></p>
        <div class="score-strip" id="rc-strip" aria-hidden="true"></div>
        <div class="ticket"><div><div class="muted" style="font-size:13px;color:var(--p-muted)">رقم المشارك</div><bdi>NBC-4F7K29</bdi></div><button class="pbtn" id="copy">${ic('copy')} <span id="copy-t">نسخ الرقم</span></button></div>
        <p class="note-policy" id="rc-policy"></p>
        <div id="rc-revisit"></div>
        <div class="rev" id="rc-rev"></div>
        <div class="cta-row"><button class="pbtn" id="rc-again">${ic('refresh')} ابدأ العرض من جديد</button></div>
      </div>
      <div class="rc-book" aria-hidden="true"><canvas id="cv-rc"></canvas></div>
    </div>
    <div class="bk-modal" id="rc-modal" hidden></div>
  </section>`;

  const el = (id) => px.querySelector('#' + id);
  const bkScroll = el('bk-scroll'), pbk = el('pbk'), split = el('split');
  let introBook = null, rcBook = null, ioPages = null, toast = null;

  /* ----- book pages ----- */
  function buildPages(into = bkScroll) {
    into.innerHTML = '';
    for (let n = 1; n <= BOOK_PAGES; n++) {
      const d = document.createElement('div'); d.className = 'bk-page' + (n === 1 ? ' cover' : ''); d.dataset.page = n;
      if (n === 1) d.innerHTML = `<img data-cover alt="غلاف الكتاب" src="${BookGL.coverImage()}">`;
      else if (PAGES[n] && PAGES[n].toc) d.innerHTML = `<div class="ph"><span>الانتماء واللحمة الوطنية</span><span>2</span></div><h4>فهرس المحتويات</h4><div class="toc">${TOC.map(([t, p]) => `<button data-go="${p}"><span>${t}</span><span dir="ltr">${p}</span></button>`).join('')}</div>`;
      else { const pg = PAGES[n]; d.innerHTML = `<div class="ph"><span>الانتماء واللحمة الوطنية</span><span>${n}</span></div><h4>${pg.t}</h4>${pg.p.map((x) => `<p>${x}</p>`).join('')}`; }
      into.appendChild(d);
    }
    $$('[data-go]', into).forEach((b) => b.addEventListener('click', () => goPage(+b.dataset.go)));
  }
  function observePages() {
    if (ioPages) ioPages.disconnect();
    ioPages = new IntersectionObserver((ents) => {
      let best = null;
      for (const e of ents) if (e.isIntersecting && (!best || e.intersectionRatio > best.intersectionRatio)) best = e;
      if (performance.now() < (S.progUntil || 0)) return;
      if (best && best.intersectionRatio >= 0.4) { const n = +best.target.dataset.page; if (n !== S.page) { S.page = n; S.maxPage = Math.max(S.maxPage, n); syncBar(); renderQuestion(true); } }
    }, { root: bkScroll, threshold: [0.4, 0.6, 0.8] });
    $$('.bk-page', bkScroll).forEach((p) => ioPages.observe(p));
  }
  function scrollToPage(n, smooth = true) {
    const t = bkScroll.querySelector(`[data-page="${n}"]`);
    if (!t) return;
    const behavior = smooth && px.dataset.reduce !== '1' ? 'smooth' : 'auto';
    S.progUntil = performance.now() + (behavior === 'smooth' ? 900 : 450);
    bkScroll.scrollTo({ top: t.offsetTop - bkScroll.offsetTop - 12, behavior });
  }
  function goPage(n, smooth = true) {
    n = Math.max(1, Math.min(BOOK_PAGES, n));
    if (S.hint) { const q = QS[S.q]; n = Math.max(q.pg - 1, Math.min(q.pg, n)); }
    S.page = n; S.maxPage = Math.max(S.maxPage, n);
    if (!S.bookOpen) setSnap(1);
    scrollToPage(n, smooth); syncBar(); closeToc(); renderQuestion(true);
  }
  function syncBar() {
    const lo = S.hint ? Math.max(1, QS[S.q].pg - 1) : 1, hi = S.hint ? QS[S.q].pg : BOOK_PAGES;
    el('pg-in').value = S.page; el('pg-prev').disabled = S.page <= lo; el('pg-next').disabled = S.page >= hi;
    el('z-v').textContent = Math.round(S.zoom * 100) + '%'; el('z-out').disabled = S.zoom <= 0.75; el('z-in').disabled = S.zoom >= 2;
    pbk.style.setProperty('--zoom', S.zoom);
    el('handle-l').innerHTML = `${ic('book')} الكتاب · صفحة ${S.page}`;
  }
  function setHint(on) {
    S.hint = on; const q = QS[S.q];
    $$('.bk-page', bkScroll).forEach((p) => { const n = +p.dataset.page; p.hidden = on && !(n === q.pg || n === q.pg - 1); });
    el('bk-hint').hidden = !on;
    if (on) { S.page = q.pg; if (!S.bookOpen) setSnap(1); requestAnimationFrame(() => scrollToPage(q.pg - 1, false)); }
    else requestAnimationFrame(() => scrollToPage(S.page, false));
    syncBar(); renderQuestion(true);
  }
  function openToc(on) { const b = el('toc-b'), p = el('toc-pop'); b.setAttribute('aria-expanded', on); p.hidden = !on; }
  function closeToc() { openToc(false); }

  /* ----- question card ----- */
  let lastQ = -1;
  function renderQuestion(keepScroll) {
    const i = S.q, q = QS[i], locked = S.locked[i], pend = S.pending[i], sel = S.sel[i], res = results()[i];
    const sc = el('qscroll'); const top = keepScroll ? sc.scrollTop : 0;
    const animate = lastQ !== i && !S.kb; lastQ = i;
    const opts = q.o.map((t, k) => {
      let cls = 'opt', badge = '';
      if (locked && !pend) {
        if (q.a.includes(k)) { cls += ' ok'; badge = `<span class="ores">${ic('check')}<span class="tx">${sel.includes(k) ? 'إجابتك صحيحة' : 'الصحيحة'}</span></span>`; }
        else if (sel.includes(k)) { cls += ' bad'; badge = `<span class="ores">${ic('x')}<span class="tx">غير صحيحة</span></span>`; }
        else cls += ' dim';
      } else if (sel.includes(k)) cls += ' sel';
      return `<button class="${cls}" data-k="${k}" role="${q.multi ? 'checkbox' : 'radio'}" aria-checked="${sel.includes(k)}" ${locked ? 'disabled' : ''}><span class="let">${LET[k]}</span><span class="otx">${esc(t)}</span>${badge}</button>`;
    }).join('');
    let hint = '';
    if (!locked) {
      if (S.hint) hint = `<div class="hintrow">${ic('book-open')} التلميح مفتوح: صفحتان فقط. <button class="pbtn mini" id="hint-close">الكتاب كاملًا</button></div>`;
      else if (hintOk(i)) hint = `<div class="hintrow"><button class="pbtn mini" id="hint-open">${ic('spark')} اعرض التلميح</button><span>يعرض صفحتين فقط من الكتاب</span></div>`;
      else hint = `<div class="hintrow"><button class="pbtn mini" disabled aria-describedby="hint-why">${ic('lock')} التلميح</button><span id="hint-why">يُفتح بعد أن تتصفّح الكتاب إلى ما بعد موضع الإجابة.</span></div>`;
    }
    let fb = '';
    if (locked && pend) fb = `<div class="fb" role="status"><strong>${ic('lock')} تم تثبيت إجابتك</strong><span>ستظهر النتيجة عند عودة الاتصال.</span></div>`;
    else if (locked) fb = `<div class="fb ${res}" role="status"><strong>${ic(res === 'ok' ? 'check' : 'x')} ${res === 'ok' ? 'إجابتك صحيحة' : 'إجابتك غير صحيحة'}</strong><span>${esc(q.ex)}</span><button class="srcchip" data-src="${q.pg}">${ic('book-open')} افتح الصفحة ${q.pg}</button></div>`;
    sc.innerHTML = `<div class="qh"><span>السؤال <b>${i + 1}</b> من ${total}</span><span>${q.multi ? 'حدد كل الإجابات الصحيحة' : 'اختر إجابة واحدة'}</span></div>
      <h2 class="qtext" tabindex="-1" id="qt">${esc(q.q)}</h2><div class="opts" role="${q.multi ? 'group' : 'radiogroup'}" aria-labelledby="qt">${opts}</div>${hint}${fb}`;
    sc.scrollTop = top;
    if (animate && px.dataset.reduce !== '1') { sc.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 160, easing: 'cubic-bezier(0.23,1,0.32,1)' }); }
    $$('.opt', sc).forEach((b) => b.addEventListener('click', () => choose(+b.dataset.k)));
    const ho = $('#hint-open', sc), hc = $('#hint-close', sc); if (ho) ho.onclick = () => setHint(true); if (hc) hc.onclick = () => setHint(false);
    const sc2 = $('.srcchip', sc); if (sc2) sc2.onclick = () => { setHint(false); goPage(+sc2.dataset.src); flashPage(+sc2.dataset.src); };
    renderFoot(); renderStrip(); renderSave();
  }
  function flashPage(n) { const p = bkScroll.querySelector(`[data-page="${n}"]`); if (!p) return; p.classList.remove('src'); void p.offsetWidth; p.classList.add('src'); }
  function renderFoot() {
    const i = S.q, f = el('qfoot'), locked = S.locked[i], last = i === total - 1, all = lockedCount() === total;
    let main;
    if (!locked) main = `<button class="pbtn pri" id="lock" ${S.sel[i].length ? '' : 'disabled'}>ثبّت إجابتي <span class="kbd">Enter</span></button>`;
    else if (all) main = `<button class="pbtn pri" id="review">راجع وأرسل ${ic('arrow-l')}</button>`;
    else main = `<button class="pbtn pri" id="next">${last ? 'إلى أول سؤال لم يُثبَّت' : 'السؤال التالي'} ${ic('arrow-l')}</button>`;
    f.innerHTML = `${main}<button class="pbtn ghost" id="prev" ${i === 0 ? 'disabled' : ''} aria-label="السؤال السابق">${ic('arrow-r')} السابق</button>`;
    const L = $('#lock', f), N = $('#next', f), R = $('#review', f), P = $('#prev', f);
    if (L) L.onclick = lock; if (N) N.onclick = next; if (R) R.onclick = () => openReview(); if (P) P.onclick = () => go(i - 1);
  }
  function renderStrip() {
    const r = results(), strip = el('strip');
    strip.innerHTML = r.map((st, i) => `<button class="seg-c ${st === 'ok' ? 'ok' : st === 'bad' ? 'bad' : st === 'pend' ? 'pend' : ''}" data-i="${i}" ${i === S.q ? 'aria-current="step"' : ''} aria-label="السؤال ${i + 1}${st === 'ok' ? '، صحيح' : st === 'bad' ? '، غير صحيح' : st === 'pend' ? '، بانتظار التأكيد' : ''}">${st === 'ok' ? ic('check') : st === 'bad' ? ic('x') : st === 'pend' ? ic('lock') : i + 1}</button>`).join('');
    $$('.seg-c', strip).forEach((b) => b.addEventListener('click', () => go(+b.dataset.i)));
  }
  function renderSave() {
    const n = S.pending.filter(Boolean).length, s = el('save');
    if (S.offline && n) { s.className = 'save pend'; s.innerHTML = `${ic('wifi-off')} ${arPlural(n, ['إجابة واحدة بانتظار الإرسال', 'إجابتان بانتظار الإرسال', 'إجابات بانتظار الإرسال', 'إجابة بانتظار الإرسال'])}`; }
    else if (S.offline) { s.className = 'save pend'; s.innerHTML = `${ic('wifi-off')} دون اتصال`; }
    else if (S.sync) { s.className = 'save'; s.innerHTML = `${ic('refresh')} جارٍ الحفظ`; }
    else { s.className = 'save ok'; s.innerHTML = `${ic('cloud-check')} محفوظ`; }
    const off = el('off');
    if (S.offline) { off.hidden = false; el('off-t').textContent = 'أنت دون اتصال. إجاباتك محفوظة على جهازك وتُرسل تلقائيًا عند عودة الاتصال.'; }
    else off.hidden = true;
  }

  /* ----- actions ----- */
  function choose(k) {
    if (S.locked[S.q]) return;
    const q = QS[S.q];
    S.sel[S.q] = q.multi ? (S.sel[S.q].includes(k) ? S.sel[S.q].filter((x) => x !== k) : [...S.sel[S.q], k]) : [k];
    renderQuestion(true);
  }
  function lock() {
    const i = S.q; if (S.locked[i] || !S.sel[i].length) return;
    S.locked[i] = true;
    if (S.offline) S.pending[i] = true;
    if (S.hint) { S.hint = false; setHint(false); }
    renderQuestion(true);
    if (!S.offline) { S.sync = 1; renderSave(); setTimeout(() => { S.sync = 0; renderSave(); }, 500); }
    const t = px.querySelector('.fb'); if (t) t.scrollIntoView({ block: 'nearest', behavior: px.dataset.reduce === '1' ? 'auto' : 'smooth' });
  }
  function go(i) {
    if (i < 0 || i >= total) return;
    if (S.hint) { S.hint = false; $$('.bk-page', bkScroll).forEach((p) => (p.hidden = false)); el('bk-hint').hidden = true; }
    S.q = i; S.visited[i] = true; lastQ = -1; renderQuestion(false); syncBar();
    const t = el('qt'); if (t) t.focus({ preventScroll: true });
  }
  function next() {
    if (S.q < total - 1) go(S.q + 1);
    else { const f = S.locked.findIndex((x) => !x); if (f >= 0) go(f); }
  }
  function openReview() {
    S.review = true; const r = results();
    el('rv-grid').innerHTML = r.map((st, i) => `<button class="seg-c ${st === 'ok' ? 'ok' : st === 'bad' ? 'bad' : ''}" data-i="${i}" aria-label="السؤال ${i + 1}">${st === 'ok' ? ic('check') : st === 'bad' ? ic('x') : i + 1}</button>`).join('');
    const ok = r.filter((x) => x === 'ok').length, bad = r.filter((x) => x === 'bad').length;
    el('rv-sum').innerHTML = `<span>${ic('check')} ${ok} صحيحة</span><span>${ic('x')} ${bad} غير صحيحة</span><span>${pairLtr(lockedCount(), total)} مثبتة</span>`;
    $$('#rv-grid .seg-c').forEach((b) => b.addEventListener('click', () => { closeReview(); go(+b.dataset.i); }));
    el('sheet').hidden = false; el('sh-go').focus();
  }
  function closeReview() { S.review = false; el('sheet').hidden = true; }
  function submit() {
    closeReview();
    const t = el('sh-go');
    showScreen('receipt');
  }

  /* ----- receipt ----- */
  function renderReceipt() {
    const r = results(), ok = r.filter((x) => x === 'ok').length;
    el('rc-sum').innerHTML = `أجبت إجابة صحيحة عن <b>${ok}</b> من <b>${total}</b> أسئلة.`;
    el('rc-strip').innerHTML = r.map((s, i) => `<i class="${s === 'ok' ? 'ok' : s === 'bad' ? 'bad' : ''}" style="animation-delay:${i * 40}ms"></i>`).join('');
    const mode = Proto.leaderboard || 'publish_after_close';
    const policy = {
      hidden: 'نتيجتك تظهر لك فقط. لا يُعلن ترتيب المشاركين.',
      own_result_only: 'نتيجتك تظهر لك فقط. تعتمد اللجنة الفائزين وتعلنهم بنفسها.',
      publish_after_close: 'يُعلن الترتيب بعد إغلاق المسابقة واعتماد اللجنة. التعادل لا يُحسم بسرعة المشاركة.',
      public_live: 'الترتيب العام مباشر ويتغير مع كل مشاركة. اعتماد الفائزين للجنة.',
    }[mode];
    el('rc-policy').innerHTML = `${ic('info')} <span>${policy}</span>`;
    const wrong = QS.map((q, i) => (r[i] === 'bad' ? i : -1)).filter((i) => i >= 0);
    const pages = [...new Set(wrong.map((i) => QS[i].pg))].sort((a, b) => a - b);
    el('rc-revisit').innerHTML = wrong.length ? `<div class="revisit"><b>اقرأ مرة أخرى:</b>${pages.map((p) => `<button class="srcchip" data-open="${p}">${ic('book-open')} صفحة ${p}</button>`).join('')}</div>` : `<p class="note-policy">${ic('check')} <span>أجبت عن كل الأسئلة إجابة صحيحة.</span></p>`;
    el('rc-rev').innerHTML = wrong.length ? `<b>الأسئلة التي تحتاج مراجعة</b>` + wrong.map((i) => { const q = QS[i]; return `<details><summary>${ic('x')}<span class="t">${i + 1}. ${esc(q.q)}</span></summary><div class="bd"><div>إجابتك: ${esc(S.sel[i].map((k) => q.o[k]).join('، '))}</div><div>الصحيحة: <b>${esc(q.a.map((k) => q.o[k]).join('، '))}</b></div><div>${esc(q.ex)}</div><button class="srcchip" data-open="${q.pg}">${ic('book-open')} افتح الصفحة ${q.pg}</button></div></details>`; }).join('') : '';
    $$('[data-open]', px.querySelector('.s-receipt')).forEach((b) => b.addEventListener('click', () => openModal(+b.dataset.open)));
  }
  function openModal(n) {
    const m = el('rc-modal');
    m.hidden = false;
    m.innerHTML = `<div class="bk-bar"><strong>الكتاب · صفحة ${n}</strong><span class="sp"></span><button class="pbtn mini" id="m-close">${ic('x')} إغلاق</button></div><div class="bk-scroll" id="m-scroll" style="max-height:none"></div>`;
    const sc = m.querySelector('#m-scroll'); buildPages(sc); $$('.bk-page', sc).forEach((p) => { p.style.setProperty('--zoom', 1); });
    sc.style.setProperty('--zoom', 1);
    requestAnimationFrame(() => { const t = sc.querySelector(`[data-page="${n}"]`); sc.scrollTop = t.offsetTop - sc.offsetTop - 12; });
    m.querySelector('#m-close').onclick = () => { m.hidden = true; };
    m.querySelector('#m-close').focus();
  }

  /* ----- screens ----- */
  function showScreen(name) {
    S.screen = name; px.dataset.screen = name;
    if (name === 'intro') { if (!introBook) introBook = BookGL.mount(el('cv-intro'), { baseY: -0.5, baseX: 0.1 }); introBook.setOpen(0, 0); }
    if (name === 'receipt') { renderReceipt(); if (!rcBook) rcBook = BookGL.mount(el('cv-rc'), { baseY: -0.45, baseX: 0.08 }); rcBook.setOpen(0.55, 0); setTimeout(() => rcBook && rcBook.setOpen(0, 800), 120); }
    if (name === 'exam') { applyLayout(); renderQuestion(false); syncBar(); }
  }
  function start() {
    if (introBook && px.dataset.reduce !== '1') { introBook.setOpen(1, 700); setTimeout(() => showScreen('exam'), 640); }
    else showScreen('exam');
  }

  /* ----- mobile split ----- */
  function narrow() { return root.clientWidth < 820; }
  function setSnap(k) {
    S.snap = k; S.bookOpen = k > 0;
    const h = split.clientHeight; const px_ = Math.round(h * S.peekHeights[k]);
    if (narrow()) pbk.style.setProperty('--book-h', k === 0 ? '0px' : px_ + 'px');
    pbk.dataset.snap = k; px.dataset.peek = narrow() ? '1' : '0';
    if (k > 0) requestAnimationFrame(() => scrollToPage(S.page, false));
    el('handle').setAttribute('aria-expanded', k > 0);
  }
  function applyLayout() {
    if (narrow()) { if (!px.dataset.layoutN) { S.snap = 0; } setSnap(S.snap); px.dataset.layoutN = '1'; }
    else { pbk.style.removeProperty('--book-h'); delete px.dataset.peek; delete px.dataset.layoutN; S.bookOpen = true; }
  }
  const h = el('handle');
  let drag = null;
  h.addEventListener('pointerdown', (e) => { drag = { y: e.clientY, h0: pbk.offsetHeight, t: performance.now(), moved: false }; h.setPointerCapture(e.pointerId); px.dataset.drag = '1'; });
  h.addEventListener('pointermove', (e) => {
    if (!drag) return; const dy = drag.y - e.clientY; if (Math.abs(dy) > 3) drag.moved = true;
    const max = split.clientHeight * 0.88; let nh = drag.h0 + dy; if (nh > max) nh = max + (nh - max) * 0.25; if (nh < 0) nh = nh * 0.25;
    pbk.style.setProperty('--book-h', Math.max(0, nh) + 'px');
  });
  h.addEventListener('pointerup', (e) => {
    if (!drag) return; px.dataset.drag = '0';
    const dt = performance.now() - drag.t, dy = drag.y - e.clientY, v = dy / Math.max(1, dt);
    if (!drag.moved) { setSnap(S.snap === 0 ? 1 : 0); drag = null; return; }
    const cur = drag.h0 + dy, hs = S.peekHeights.map((p) => p * split.clientHeight);
    let k = hs.reduce((b, x, i) => (Math.abs(x - cur) < Math.abs(hs[b] - cur) ? i : b), 0);
    if (Math.abs(v) > 0.5) k = v > 0 ? Math.min(2, S.snap + 1) : Math.max(0, S.snap - 1);
    setSnap(k); drag = null;
  });
  h.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSnap(S.snap === 0 ? 1 : 0); } });
  new ResizeObserver(() => { if (S.screen === 'exam') applyLayout(); }).observe(root);

  /* ----- wire controls ----- */
  el('start').onclick = start;
  el('pg-prev').onclick = () => goPage(S.page - 1); el('pg-next').onclick = () => goPage(S.page + 1);
  el('pg-in').addEventListener('change', (e) => goPage(parseInt(e.target.value, 10) || S.page));
  el('z-in').onclick = () => { S.zoom = Math.min(2, S.zoom + 0.25); syncBar(); }; el('z-out').onclick = () => { S.zoom = Math.max(0.75, S.zoom - 0.25); syncBar(); };
  el('b-night').onclick = (e) => { S.night = !S.night; pbk.classList.toggle('night', S.night); e.currentTarget.setAttribute('aria-pressed', S.night); };
  el('toc-b').onclick = () => openToc(el('toc-pop').hidden);
  el('toc-pop').innerHTML = TOC.map(([t, p]) => `<button data-p="${p}"><span>${t}</span><span dir="ltr">${p}</span></button>`).join('');
  $$('#toc-pop button').forEach((b) => b.addEventListener('click', () => goPage(+b.dataset.p)));
  el('hint-off').onclick = () => setHint(false);
  el('sh-back').onclick = closeReview; el('sh-go').onclick = submit;
  el('rc-again').onclick = () => api.scene(1);
  el('copy').onclick = () => { const t = 'NBC-4F7K29'; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).catch(() => {}).finally(() => { el('copy-t').textContent = 'تم النسخ'; setTimeout(() => (el('copy-t').textContent = 'نسخ الرقم'), 1600); }); };
  el('off-retry').onclick = () => api.setOffline(false);
  el('b-search').onclick = (e) => { const on = el('bk-search').hidden; el('bk-search').hidden = !on; e.currentTarget.setAttribute('aria-pressed', on); if (on) el('bk-q').focus(); };
  el('bk-q').addEventListener('input', (e) => {
    const t = e.target.value.trim(), out = el('bk-res'); out.innerHTML = '';
    if (t.length < 2) return;
    const hits = [];
    for (let n = 3; n <= BOOK_PAGES; n++) { const pg = PAGES[n]; if (!pg || !pg.p) continue; const txt = pg.p.join(' '); const k = txt.indexOf(t); if (k >= 0) hits.push([n, txt.slice(Math.max(0, k - 20), k + 40).replace(t, `<mark>${esc(t)}</mark>`)]); }
    out.innerHTML = hits.slice(0, 6).map(([n, s]) => `<button data-n="${n}">صفحة ${n}: ${s}</button>`).join('') || '<span style="padding:6px 8px;color:var(--p-muted)">لا نتائج</span>';
    $$('button', out).forEach((b) => b.addEventListener('click', () => { goPage(+b.dataset.n); flashPage(+b.dataset.n); }));
  });
  px.addEventListener('keyup', () => { S.kb = false; });
  px.addEventListener('keydown', (e) => {
    S.kb = true;
    if (S.screen !== 'exam' || S.review) { if (e.key === 'Escape' && S.review) closeReview(); return; }
    const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea') return;
    if (e.key === 'Escape') { if (!el('toc-pop').hidden) closeToc(); else if (S.hint) setHint(false); return; }
    if (/^[1-4]$/.test(e.key)) { choose(+e.key - 1); e.preventDefault(); }
    else if (e.key === 'Enter' && tag !== 'button') { if (!S.locked[S.q]) lock(); else if (lockedCount() === total) openReview(); else next(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { go(S.q + 1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { go(S.q - 1); e.preventDefault(); }
  });
  px.addEventListener('click', (e) => { if (!e.target.closest('.bk-toc')) closeToc(); });
  bkScroll.addEventListener('keydown', (e) => { if (e.key === 'Escape') bkScroll.blur(); });

  /* ----- public api (used by the shell) ----- */
  function reset(keep = {}) {
    Object.assign(S, { q: 0, sel: QS.map(() => []), locked: QS.map(() => false), pending: QS.map(() => false), visited: QS.map((_, i) => i === 0), page: 2, maxPage: 2, zoom: 1, hint: false, review: false, sync: 0, night: false });
    pbk.classList.remove('night'); el('b-night').setAttribute('aria-pressed', 'false'); el('rc-modal').hidden = true; closeReview();
    $$('.bk-page', bkScroll).forEach((p) => (p.hidden = false)); el('bk-hint').hidden = true;
    S.snap = narrow() ? 0 : 1; S.bookOpen = !narrow();
  }
  function fillAll(pattern = [1, 1, 1, 0, 1, 1, 0, 1, 1, 1]) {
    QS.forEach((q, i) => { const wrongK = q.multi ? [0, 3] : [(q.a[0] + 1) % 4]; S.sel[i] = pattern[i % pattern.length] ? q.a.slice() : wrongK; S.locked[i] = true; S.pending[i] = false; S.visited[i] = true; });
  }
  const api = {
    S, reset,
    setDesign(d) { px.dataset.design = d; $$('.ax').forEach((a) => (a.dataset.design = d)); },
    setSearch(on) { S.search = on; el('b-search').hidden = !on; if (!on) el('bk-search').hidden = true; },
    setOffline(on) {
      const was = S.offline; S.offline = on;
      if (was && !on) { const n = S.pending.filter(Boolean).length; S.sync = 1; renderSave(); setTimeout(() => { S.pending = S.pending.map(() => false); S.sync = 0; renderQuestion(true); }, 700); }
      else renderQuestion(true);
      const sw = $('#sw-offline'); if (sw) sw.checked = on;
    },
    leaderboard: 'publish_after_close',
    setLeaderboard(m) { this.leaderboard = m; if (S.screen === 'receipt') renderReceipt(); },
    scene(n) {
      reset(); S.offline = false; const sw = $('#sw-offline'); if (sw) sw.checked = false; buildPages(); observePages();
      el('bk-scroll').style.setProperty('--zoom', 1);
      if (n === 1) { showScreen('intro'); return; }
      showScreen('exam');
      if (n === 2) { S.q = 0; S.page = 2; }
      if (n === 3) { S.q = 0; S.sel[0] = [1]; S.locked[0] = true; S.page = 3; S.maxPage = 3; }
      if (n === 4) { S.q = 2; S.page = 6; S.maxPage = 6; fillFirst(2); }
      if (n === 5) { fillFirst(3); S.q = 3; S.sel[3] = [0, 1, 2]; S.page = 6; S.maxPage = 6; S.offline = true; S.locked[3] = true; S.pending[3] = true; if (sw) sw.checked = true; }
      if (n === 6) { fillAll(); S.q = total - 1; S.maxPage = 12; S.page = 11; }
      if (n === 7) { fillAll(); S.maxPage = 12; showScreen('receipt'); return; }
      renderQuestion(false); syncBar(); applyLayout();
      requestAnimationFrame(() => { if (S.bookOpen || !narrow()) scrollToPage(S.page, false); if (n === 4) setHint(true); if (n === 6) openReview(); if (n === 3) { flashPage(3); } });
      if (n === 2 && narrow()) setSnap(1);
    },
  };
  function fillFirst(n) { for (let i = 0; i < n; i++) { const q = QS[i]; S.sel[i] = q.a.slice(); S.locked[i] = true; S.visited[i] = true; } }
  buildPages(); observePages();
  // initial paint of intro
  requestAnimationFrame(() => { if (typeof THREE !== 'undefined' || true) api.scene(1); });
  return api;
})();
