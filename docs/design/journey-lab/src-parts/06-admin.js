/* ---------- admin prototype: launch control + question workshop ---------- */
const Admin = (() => {
  const host = $('#admin-proto');
  const TRACK = ['مسودة', 'الأسئلة معتمدة', 'مجدولة', 'مفتوحة', 'مغلقة', 'النتائج منشورة'];
  const fmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Riyadh' });
  const rel = (ms) => { const d = Math.round(ms / 86400000); return d <= 0 ? 'اليوم' : d === 1 ? 'غدًا' : d === 2 ? 'بعد يومين' : d <= 10 ? `بعد ${d} أيام` : `بعد ${d} يومًا`; };
  const A = {
    idx: 0, banks: { middle: 20, high: 20, uni: 14 }, rehearsed: false, scheduled: false,
    opens: Date.now() + 8 * 86400000, closes: Date.now() + 22 * 86400000,
    saved: { lb: 'publish_after_close', policy: 'grace', grace: 60 }, cur: { lb: 'publish_after_close', policy: 'grace', grace: 60 },
    sub: 'launch', registrants: 312,
  };
  const STG = [['middle', 'المتوسطة'], ['high', 'الثانوية'], ['uni', 'الجامعية']];
  const ready = () => A.banks.middle >= 20 && A.banks.high >= 20 && A.banks.uni >= 20;
  const LB = [
    ['hidden', 'محجوب كليًا', 'لا نتيجة ولا ترتيب حتى تقرر اللجنة.'],
    ['own_result_only', 'النتيجة الشخصية فقط', 'كل مشارك يرى نتيجته. الفائزون تعلنهم اللجنة.'],
    ['publish_after_close', 'النتيجة الشخصية، والترتيب بعد الإغلاق', 'يظهر الترتيب بعد إغلاق المسابقة واعتماد النشر.'],
    ['public_live', 'ترتيب عام مباشر', 'يتغير الترتيب مع كل مشاركة.'],
  ];
  const svText = {
    hidden: ['نتيجتك تظهر لك فقط. لا يُعلن ترتيب المشاركين.', 'سلمان، أجبت إجابة صحيحة عن 14 من 20.'],
    own_result_only: ['نتيجتك تظهر لك فقط. تعتمد اللجنة الفائزين وتعلنهم بنفسها.', 'أجبت إجابة صحيحة عن 14 من 20.'],
    publish_after_close: ['يُعلن الترتيب بعد إغلاق المسابقة واعتماد اللجنة. التعادل لا يُحسم بسرعة المشاركة.', 'أجبت إجابة صحيحة عن 14 من 20.'],
    public_live: ['الترتيب العام مباشر ويتغير مع كل مشاركة. اعتماد الفائزين للجنة.', 'أجبت إجابة صحيحة عن 14 من 20. ترتيبك الحالي: 41 من 312.'],
  };
  const NEXT = [
    { t: 'اعتمد نسخة الأسئلة', d: 'تُثبَّت الأسئلة والكتاب لهذه النسخة. التعديل بعدها يُنشئ إصدارًا جديدًا ولا يغيّر المحاولات القائمة.', b: 'اعتمد نسخة الأسئلة', hold: false, need: () => ready() && A.rehearsed },
    { t: 'افتح المسابقة', d: `ستُتاح المسابقة فورًا لـ ${A.registrants} مسجّلًا. لا يمكن تعديل الأسئلة بعد الفتح.`, b: 'اضغط مطولًا لفتح المسابقة', hold: true, need: () => true },
    { t: 'المسابقة مجدولة', d: 'ستفتح تلقائيًا في الموعد المحدد. يمكنك فتحها الآن.', b: 'اضغط مطولًا للفتح الآن', hold: true, need: () => true },
    { t: 'أغلق المسابقة', d: 'يتوقف استلام المشاركات. تبقى المحاولات القائمة قابلة للمزامنة حسب سياسة الإغلاق.', b: 'اضغط مطولًا للإغلاق', hold: true, need: () => true },
    { t: 'اعتمد نشر النتائج', d: 'تصبح النتيجة والترتيب ظاهرين للمشاركين وفق الإعداد المختار.', b: 'اعتمد النشر', hold: false, need: () => true },
    { t: 'النتائج منشورة', d: 'يمكنك سحب النشر إن لزم. يختفي الترتيب عن المشاركين فورًا.', b: 'اضغط مطولًا لسحب النشر', hold: true, danger: true, need: () => true },
  ];
  const dirty = () => ['lb', 'policy', 'grace'].filter((k) => A.saved[k] !== A.cur[k]).length;

  function holdButton(btn, ms, done) {
    let t0 = 0, raf = 0, active = false;
    const tick = () => { const p = Math.min(1, (performance.now() - t0) / ms); btn.style.setProperty('--prog', p); if (p >= 1) { stop(false); done(); } else raf = requestAnimationFrame(tick); };
    const start = () => { if (active || btn.disabled) return; active = true; t0 = performance.now(); btn.classList.add('holding'); raf = requestAnimationFrame(tick); };
    const stop = (reset = true) => { if (!active) return; active = false; cancelAnimationFrame(raf); btn.classList.remove('holding'); if (reset) { btn.style.transition = '--prog 160ms'; btn.style.setProperty('--prog', 0); } };
    btn.addEventListener('pointerdown', (e) => { btn.setPointerCapture(e.pointerId); start(); });
    btn.addEventListener('pointerup', () => stop()); btn.addEventListener('pointercancel', () => stop()); btn.addEventListener('pointerleave', () => stop());
    btn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(); } });
    btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') stop(); });
    btn.addEventListener('blur', () => stop());
  }

  function render() {
    const n = NEXT[A.idx], pre = A.idx <= 1;
    host.innerHTML = `
    <div class="ax" data-design="${$('#px-root .px').dataset.design}">
      <div class="ax-wrap">
        <div class="ax-grid">
          <div style="display:grid;gap:20px;min-width:0">
            <section class="ax-card">
              <h2>مسابقة الانتماء واللحمة الوطنية 1448 / 2026</h2>
              <ol class="track" aria-label="مراحل المسابقة">${TRACK.map((t, i) => `<li class="${i < A.idx ? 'done' : i === A.idx ? 'now' : ''}" ${i === A.idx ? 'aria-current="step"' : ''}><i></i>${t}</li>`).join('')}</ol>
            </section>
            <section class="ax-card" aria-labelledby="nx-t">
              <h3 id="nx-t">الخطوة التالية: ${n.t}</h3>
              <p class="muted">${n.d}</p>
              ${pre ? `<ul class="pre">
                <li class="ok"><span class="st">${ic('check')}</span><span class="tx">ملف الكتاب معتمد<small>66 صفحة PDF</small></span><details style="flex-basis:100%"><summary style="cursor:pointer;font-size:13px;color:var(--p-muted)">بصمة الملف SHA-256</summary><code class="mono" style="font-size:12px;overflow-wrap:anywhere;direction:ltr;display:block">ec07ef57e563ada8bba244317aeeef0e34c8caa0ea7e10bee228232615db79fd</code></details></li>
                ${STG.map(([k, nm]) => { const c = A.banks[k], ok = c >= 20; return `<li class="${ok ? 'ok' : ''}"><span class="st">${ok ? ic('check') : ic('warn')}</span><span class="tx">المرحلة ${nm}<small>${c} من 20 سؤالًا معتمدًا</small></span>${ok ? '' : `<button class="pbtn mini" data-appr="${k}">اعتمد ${20 - c} مسودات</button>`}<div class="bar"><b style="width:${(c / 20) * 100}%"></b></div></li>`; }).join('')}
                <li class="${A.rehearsed ? 'ok' : ''}"><span class="st">${A.rehearsed ? ic('check') : ic('play')}</span><span class="tx">تجربة المسابقة كاملة بهذه النسخة<small>${A.rehearsed ? 'نُفّذت اليوم من حساب اللجنة' : 'لم تُجرَّ بعد. تفتح بنفس واجهة الطالب'}</small></span>${A.rehearsed ? '' : '<button class="pbtn mini" id="ax-reh">ابدأ التجربة</button>'}</li>
              </ul>` : ''}
              <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
                <button class="pbtn pri ${n.hold ? 'hold' : ''}" id="ax-go" ${n.need() ? '' : 'disabled'} ${n.danger ? 'style="background:var(--p-danger)"' : ''}>${n.b}</button>
                ${A.idx === 1 && !A.scheduled ? '<button class="pbtn" id="ax-sched">جدولة الفتح بدل الآن</button>' : ''}
                ${!n.need() ? '<span class="muted" style="font-size:13.5px">أكمل المتطلبات أعلاه لتفعيل الزر.</span>' : ''}
                ${A.idx > 0 ? '<button class="pbtn ghost" id="ax-back">ابدأ العرض من جديد</button>' : ''}
              </div>
            </section>
            <section class="ax-card">
              <h3>الموعد</h3>
              <div class="field"><span class="lb">تفتح</span><div>${fmt.format(A.opens)} <span class="chip" style="margin-inline-start:6px">${rel(A.opens - Date.now())}</span></div><span class="hp">بتوقيت الرياض</span></div>
              <div class="field"><span class="lb">تغلق</span><div>${fmt.format(A.closes)} <span class="chip" style="margin-inline-start:6px">${rel(A.closes - Date.now())}</span></div></div>
            </section>
          </div>
          <div style="display:grid;gap:20px;min-width:0">
            <section class="ax-card">
              <h3>النتائج والترتيب</h3>
              <div class="radios" role="radiogroup" aria-label="النتائج والترتيب">${LB.map(([v, t, d]) => `<label class="rcard"><input type="radio" name="lb" value="${v}" ${A.cur.lb === v ? 'checked' : ''}><span><b>${t}</b></span><small>${d}</small></label>`).join('')}</div>
              <div class="sv" aria-live="polite"><div class="sv-t">ما الذي يراه الطالب عند الانتهاء</div><div class="sv-b"><b>تم استلام مشاركتك</b><span>${svText[A.cur.lb][1]}</span><span style="color:var(--p-muted);font-size:14px">${svText[A.cur.lb][0]}</span></div></div>
            </section>
            <section class="ax-card">
              <h3>سياسة الإغلاق</h3>
              <div class="seg" style="width:max-content"><button data-pol="immediate" aria-pressed="${A.cur.policy === 'immediate'}" style="font-family:inherit;color:inherit">إيقاف فوري</button><button data-pol="grace" aria-pressed="${A.cur.policy === 'grace'}" style="font-family:inherit;color:inherit">مهلة مزامنة</button></div>
              ${A.cur.policy === 'grace' ? `<div class="field"><label for="ax-grace">مهلة المزامنة بالدقائق</label><input id="ax-grace" type="text" inputmode="numeric" value="${A.cur.grace}" style="max-width:140px"><span class="hp">تبقى المحاولات القائمة قابلة للمزامنة حتى ${new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(A.closes + A.cur.grace * 60000)}.</span></div>` : '<p class="muted" style="font-size:14px">تتوقف المحاولات القائمة عند لحظة الإغلاق.</p>'}
            </section>
            <p class="muted" style="font-size:13.5px;display:flex;gap:8px;align-items:flex-start;padding-inline:4px">${ic('info')} <span>تظهر الإجابة الصحيحة والتوضيح بعد تثبيت الإجابة، ولا يمكن تغيير الإجابة المثبتة. هذه سياسة ثابتة وليست خيارًا.</span></p>
          </div>
        </div>
        <div class="savebar" id="ax-save" ${dirty() ? '' : 'hidden'}><span style="flex:1">${dirty()} تغييرات غير محفوظة</span><button class="pbtn ghost" id="ax-disc">تجاهل</button><button class="pbtn pri" id="ax-sv">حفظ الإعدادات</button></div>
        <div class="toast" id="ax-toast" hidden></div>
      </div>
    </div>`;
    bind();
  }
  function say(t) { const e = $('#ax-toast', host); if (!e) return; e.textContent = t; e.hidden = false; clearTimeout(say.t); say.t = setTimeout(() => (e.hidden = true), 2200); }
  function bind() {
    const go = $('#ax-go', host);
    const advance = () => { A.idx = Math.min(5, A.idx + (A.idx === 5 ? -1 : 1)); if (A.idx === 2 && !A.scheduled) A.idx = 3; render(); say(TRACK[A.idx]); };
    if (go) { const n = NEXT[A.idx]; if (n.hold) holdButton(go, 1100, advance); else go.addEventListener('click', advance); }
    $$('[data-appr]', host).forEach((b) => b.addEventListener('click', () => { A.banks[b.dataset.appr] = 20; render(); }));
    const reh = $('#ax-reh', host); if (reh) reh.addEventListener('click', () => { A.rehearsed = true; render(); say('تمت التجربة. يمكنك اعتماد النسخة.'); });
    const sc = $('#ax-sched', host); if (sc) sc.addEventListener('click', () => { A.scheduled = true; A.idx = 2; render(); });
    const bk = $('#ax-back', host); if (bk) bk.addEventListener('click', () => { A.idx = 0; A.scheduled = false; render(); });
    $$('input[name=lb]', host).forEach((r) => r.addEventListener('change', () => { A.cur.lb = r.value; Proto.setLeaderboard(r.value); render(); const f = $('input[name=lb]:checked', host); if (f) f.focus(); }));
    $$('[data-pol]', host).forEach((b) => b.addEventListener('click', () => { A.cur.policy = b.dataset.pol; render(); }));
    const g = $('#ax-grace', host); if (g) g.addEventListener('change', () => { A.cur.grace = Math.max(0, Math.min(10080, parseInt(g.value, 10) || 0)); render(); });
    const sv = $('#ax-sv', host); if (sv) sv.addEventListener('click', () => { A.saved = { ...A.cur }; render(); say('تم حفظ الإعدادات'); });
    const dc = $('#ax-disc', host); if (dc) dc.addEventListener('click', () => { A.cur = { ...A.saved }; Proto.setLeaderboard(A.saved.lb); render(); });
  }

  /* ----- question workshop ----- */
  const W = { stage: 'middle', text: QS[4].q, opts: QS[4].o.slice(), correct: 2, pg: 7, ex: QS[4].ex, preview: 7 };
  function renderWorkshop() {
    const issues = [];
    const distinct = new Set(W.opts.map((o) => o.trim())).size === 4 && W.opts.every((o) => o.trim());
    if (!distinct) issues.push('الخيارات يجب أن تكون أربعة ومختلفة.');
    const lastPage = W.pg >= BOOK_PAGES;
    const pgOk = W.pg >= 1 && W.pg <= BOOK_PAGES;
    host.innerHTML = `
    <div class="ax" data-design="${$('#px-root .px').dataset.design}">
      <div class="ax-wrap">
        <section class="ax-card" style="margin-bottom:20px"><h3>تقدّم بنك الأسئلة</h3>
          <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">${STG.map(([k, nm]) => `<div><div style="display:flex;justify-content:space-between"><span>المرحلة ${nm}</span><b>${A.banks[k]} / 20</b></div><div class="pre"><li style="padding:0;background:none"><div class="bar" style="flex-basis:100%"><b style="width:${(A.banks[k] / 20) * 100}%"></b></div></li></div></div>`).join('')}</div>
        </section>
        <div class="ed-split">
          <section class="ax-card">
            <h2>تحرير السؤال</h2>
            <div class="field"><label for="w-text">نص السؤال</label><textarea id="w-text">${esc(W.text)}</textarea></div>
            <div class="field"><span class="lb">الخيارات، وحدّد الإجابة الصحيحة</span>
              ${W.opts.map((o, i) => `<div class="optrow"><input type="radio" name="w-c" id="w-r${i}" ${W.correct === i ? 'checked' : ''} aria-label="الخيار ${LET[i]} هو الصحيح"><input type="text" id="w-o${i}" value="${esc(o)}" aria-label="الخيار ${LET[i]}"></div>`).join('')}
            </div>
            <div class="field"><span class="lb">صفحة المصدر في الكتاب</span>
              <div class="page-stepper"><button class="ibtn" id="w-pm" aria-label="الصفحة السابقة">${ic('minus')}</button><b id="w-pg" style="min-width:34px;text-align:center">${W.pg}</b><button class="ibtn" id="w-pp" aria-label="الصفحة التالية">${ic('plus')}</button></div>
              <span class="hp">يعرض التلميح تلقائيًا الصفحة ${Math.max(1, W.pg - 1)} والصفحة ${W.pg}. لم يعد هناك حقلا بداية ونهاية التلميح.</span></div>
            <div class="field"><label for="w-ex">التوضيح بعد التثبيت</label><textarea id="w-ex">${esc(W.ex)}</textarea></div>
            <div class="chk">${distinct ? '<span class="chip">خيارات سليمة</span>' : '<span class="chip no">خيارات ناقصة أو مكررة</span>'}${pgOk ? '<span class="chip">الصفحة داخل الكتاب</span>' : '<span class="chip no">الصفحة خارج الكتاب</span>'}${lastPage ? '<span class="chip no">آخر صفحة: لن يُفتح التلميح</span>' : '<span class="chip">التلميح يمكن فتحه</span>'}</div>
            <div style="display:flex;gap:10px"><button class="pbtn pri" id="w-save" ${distinct && pgOk ? '' : 'disabled'}>حفظ مسودة إصدار جديد</button></div>
          </section>
          <section class="ax-card">
            <h2>كما يراه الطالب</h2>
            <div class="ax-live"><div class="px-mini">
              <div class="qh" style="display:flex;justify-content:space-between;color:var(--p-muted);font-size:13px"><span>السؤال 5 من 20</span><span>اختر إجابة واحدة</span></div>
              <h3 class="qtext" style="font:700 21px/1.7 var(--p-display);margin:0">${esc(W.text) || '...'}</h3>
              <div class="opts">${W.opts.map((o, i) => `<div class="opt ${W.correct === i ? 'ok' : ''}"><span class="let">${LET[i]}</span><span class="otx">${esc(o) || '...'}</span>${W.correct === i ? `<span class="ores">${ic('check')}<span class="tx">الصحيحة</span></span>` : ''}</div>`).join('')}</div>
              <div class="fb ok" style="transition:none"><strong>${ic('check')} بعد التثبيت</strong><span>${esc(W.ex) || '...'}</span><span class="srcchip">${ic('book-open')} افتح الصفحة ${W.pg}</span></div>
            </div></div>
            <h3>صفحة المصدر</h3>
            <div class="page-stepper"><button class="ibtn" id="w-vp" aria-label="السابقة">${ic('chev-l')}</button><span>${W.preview} / ${BOOK_PAGES}</span><button class="ibtn" id="w-vn" aria-label="التالية">${ic('chev-r')}</button><button class="pbtn mini" id="w-use" style="margin-inline-start:10px">اجعلها صفحة المصدر</button></div>
            <div class="bk-page" style="width:100%;max-width:340px;margin-inline:auto;background:#fffdf7;font-size:12px">${(() => { const pg = PAGES[W.preview]; if (W.preview === 1) return `<img data-cover src="${BookGL.coverImage()}" alt="" style="width:100%;height:100%;object-fit:cover">`; if (!pg) return ''; if (pg.toc) return '<h4>فهرس المحتويات</h4>'; return `<div class="ph"><span>الانتماء واللحمة الوطنية</span><span>${W.preview}</span></div><h4>${pg.t}</h4>${pg.p.map((x) => `<p>${x}</p>`).join('')}`; })()}</div>
            <h3>تغطية صفحات الكتاب</h3>
            <div class="cov" aria-label="كثافة الأسئلة لكل صفحة">${Array.from({ length: BOOK_PAGES }, (_, i) => { const n = i + 1; const c = QS.filter((q) => q.pg === n).length + (n === W.pg ? 1 : 0) - (QS[4].pg === n ? 1 : 0); return `<i class="${c > 2 ? 'c3' : c === 2 ? 'c2' : c === 1 ? 'c1' : ''}" title="صفحة ${n}: ${c}"></i>`; }).join('')}</div>
            <p class="muted" style="font-size:13px">صفحة واحدة بسؤالين أو أكثر تظهر بلون أغمق. الصفحات الفارغة بلا لون.</p>
          </section>
        </div>
        <div class="toast" id="ax-toast" hidden></div>
      </div>
    </div>`;
    const take = () => { W.text = $('#w-text', host).value; W.ex = $('#w-ex', host).value; W.opts = [0, 1, 2, 3].map((i) => $('#w-o' + i, host).value); };
    const live = (ids, fn) => ids.forEach((id) => { const e = $(id, host); if (e) e.addEventListener('input', () => { const pos = [e.id, e.selectionStart]; take(); renderWorkshop(); const f = $('#' + pos[0], host); if (f) { f.focus(); try { f.setSelectionRange(pos[1], pos[1]); } catch (_) {} } }); });
    live(['#w-text', '#w-ex', '#w-o0', '#w-o1', '#w-o2', '#w-o3']);
    [0, 1, 2, 3].forEach((i) => $('#w-r' + i, host).addEventListener('change', () => { W.correct = i; renderWorkshop(); }));
    $('#w-pm', host).onclick = () => { W.pg = Math.max(1, W.pg - 1); W.preview = W.pg; take(); renderWorkshop(); };
    $('#w-pp', host).onclick = () => { W.pg = Math.min(BOOK_PAGES, W.pg + 1); W.preview = W.pg; take(); renderWorkshop(); };
    $('#w-vp', host).onclick = () => { W.preview = Math.max(1, W.preview - 1); take(); renderWorkshop(); };
    $('#w-vn', host).onclick = () => { W.preview = Math.min(BOOK_PAGES, W.preview + 1); take(); renderWorkshop(); };
    $('#w-use', host).onclick = () => { W.pg = W.preview; take(); renderWorkshop(); say('تم تعيين صفحة المصدر ' + W.pg); };
    $('#w-save', host).onclick = () => say('تم حفظ مسودة إصدار جديد. تحتاج اعتماد اللجنة.');
  }

  /* ----- admin "today" screenshots ----- */
  const shotHost = $('#admin-shots');
  function renderShots() {
    shotHost.innerHTML = ADMIN_SHOTS.map((s) => `<figure style="margin:0;display:grid;gap:8px"><figcaption><b>${s.t}</b></figcaption><div class="shot" style="max-width:none">${shotHTML(IMG[s.k], s.pins)}</div></figure>`).join('') +
      `<ul class="fl card">${FINDINGS.filter((f) => f.s === 'admin').map((f) => findingLI(f)).join('')}</ul>`;
  }

  function setSub(s) {
    A.sub = s; $$('.ax-sub button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.sub === s));
    $('#admin-proto').hidden = s === 'today'; $('#admin-shots').hidden = s !== 'today';
    if (s === 'launch') render(); else if (s === 'workshop') renderWorkshop(); else renderShots();
  }
  $$('.ax-sub button').forEach((b) => b.addEventListener('click', () => setSub(b.dataset.sub)));
  return { init() { setSub('launch'); }, refresh() { if (A.sub === 'launch') render(); else if (A.sub === 'workshop') renderWorkshop(); } };
})();
