'use client';
import { useEffect, useState } from 'react';
import { stageKeys, stageNames, type Stage } from '@/lib/competition-domain';
import { arDigits, riyadhDateTime } from '@/lib/format';
import {
  DEFAULT_ALTERNATES,
  MAX_ALTERNATES,
  MAX_DRAW_PRIZES,
  MAX_PRIZE_LABEL,
  verifyDraw,
  type DrawStage,
  type VerificationFile,
} from '@/lib/prize-draw';
import type { DrawEntryView, DrawView, PrizeDrawState } from '@/lib/prize-draw-service';
import { api, ErrorMessage, Icon, Loading } from './ui';
import { HoldButton } from './hold-button';
import { PrizeDrawRoll } from './prize-draw-roll';

const stageChips: [DrawStage, string][] = [
  ['all', 'جميع المراحل'],
  ['middle', 'المتوسطة'],
  ['highschool', 'الثانوية'],
  ['university', 'الجامعية'],
];
const stageLabel = (s: DrawStage) => (s === 'all' ? 'جميع المراحل' : stageNames[s]);
const statusText: Record<DrawEntryView['status'], string> = {
  pending: 'بانتظار التواصل',
  confirmed: 'تم التواصل',
  unreachable: 'تعذر التواصل',
  ineligible: 'غير مؤهل',
};
const n = (v: number) => arDigits(v.toLocaleString('en-US'));
const registeredDate = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-arab', {
  dateStyle: 'medium',
  timeZone: 'Asia/Riyadh',
});
// Stored phones are E.164; the operator dials the local form.
const localPhone = (p: string | null) =>
  !p ? '—' : /^\+9665\d{8}$/.test(p) ? `0${p.slice(4)}` : p;

export function AdminPrizeDraw() {
  const [view, setView] = useState<PrizeDrawState | null>(null);
  const [stage, setStage] = useState<DrawStage>('all');
  const [excludeRanked, setExcludeRanked] = useState(true);
  const [excludeFlags, setExcludeFlags] = useState(false);
  const [prizes, setPrizes] = useState<string[]>(['']);
  const [alternates, setAlternates] = useState(DEFAULT_ALTERNATES);
  const [fresh, setFresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [verified, setVerified] = useState<Awaited<ReturnType<typeof verifyDraw>> | null>(null);
  const [focus, setFocus] = useState(0);
  const [play, setPlay] = useState(0);

  function show(next: PrizeDrawState) {
    setView(next);
    setStage(next.criteria.stage);
    setExcludeRanked(next.criteria.excludeRanked);
    setExcludeFlags(next.criteria.excludeFlags);
  }
  // Without criteria the server answers with the shown draw's own criteria.
  async function load(
    id: string | null,
    criteria?: { stage: DrawStage; excludeRanked: boolean; excludeFlags: boolean },
  ) {
    const q = new URLSearchParams({
      ...(criteria
        ? {
            stage: criteria.stage,
            excludeRanked: criteria.excludeRanked ? '1' : '0',
            excludeFlags: criteria.excludeFlags ? '1' : '0',
          }
        : {}),
      ...(id ? { id } : {}),
    });
    const next = await api<PrizeDrawState>(`admin/prize-draw?${q}`);
    show(next);
    return next;
  }
  useEffect(() => {
    load(null).catch((e) => setError((e as Error).message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(body: Record<string, unknown>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await api<PrizeDrawState>('admin/prize-draw', body);
      show(next);
      setFresh(false);
      setNotice(message);
      return next;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function preview(next: {
    stage: DrawStage;
    excludeRanked: boolean;
    excludeFlags: boolean;
  }) {
    setStage(next.stage);
    setExcludeRanked(next.excludeRanked);
    setExcludeFlags(next.excludeFlags);
    try {
      await load(null, next);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!view) return error ? <ErrorMessage message={error} /> : <Loading />;
  const draw: DrawView | null = fresh ? null : view.draw;
  const open = draw && !draw.drawnAt && !draw.cancelledAt ? draw : null;
  // A shown draw keeps its criteria; «سحب جديد» opens the setup.
  const setupLocked = Boolean(draw) || Boolean(view.blocker);
  const cleanPrizes = prizes.map((p) => p.trim()).filter(Boolean);
  const missing = excludeRanked
    ? view.rankedMissing.filter((s) => stage === 'all' || s === stage)
    : [];
  const s = view.stats;
  const holders = draw?.holders ?? [];
  const entryAt = (position: number | null) =>
    position === null ? undefined : draw?.entries.find((e) => e.position === position);
  const focused = entryAt(holders[focus] ?? null);

  async function verify() {
    if (!draw) return;
    setBusy(true);
    setError('');
    try {
      const file = await api<VerificationFile>(`admin/prize-draw/file?id=${draw.id}`);
      setVerified(await verifyDraw(file));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-panel prize-draw">
      <header className="draw-head">
        <div>
          <span className="eyebrow">بعد إغلاق المسابقة</span>
          <h2>سحب عشوائي قابل للتحقق</h2>
          <p className="launch-description">
            جوائز إضافية منفصلة عن مراكز الترتيب. تُجمَّد القائمة، ثم تُثبَّت بذرة سرية، ثم يُجرى
            السحب. من يحمل القائمة والبذرة المكشوفة يحصل على الفائزين أنفسهم.
          </p>
        </div>
        <div className="draw-head-actions">
          <a
            className="button outline"
            href="/admin/draw-screen"
            target="nbc-draw-screen"
            rel="noopener"
          >
            شاشة الجمهور <Icon name="pages" size={18} />
          </a>
          {draw?.drawnAt ? (
            <a
              className="button outline"
              href={`/api/admin/prize-draw/file?id=${draw.id}&download=1`}
            >
              ملف التحقق <Icon name="download" size={18} />
            </a>
          ) : (
            <button type="button" className="button outline" disabled>
              ملف التحقق <Icon name="download" size={18} />
            </button>
          )}
        </div>
      </header>

      <ErrorMessage message={error} />
      {notice && (
        <div role="status" className="success-message">
          {notice}
        </div>
      )}
      {view.blocker && (
        <div className="notice" role="status">
          <Icon name="clock" />
          <span>{view.blocker} يمكنك مراجعة القائمة الآن، ويتاح السحب بعد ذلك.</span>
        </div>
      )}
      {!open && missing.length > 0 && !view.blocker && (
        <div className="notice" role="status">
          <Icon name="trophy" />
          <span>
            لم يُحفظ قرار فائزي {missing.map((m) => stageNames[m]).join(' و')} بعد. احفظه في
            «الفائزون والجوائز» حتى يُستبعد أصحاب المراكز، أو ألغِ خيار الاستبعاد.
          </span>
        </div>
      )}

      <div className="draw-console">
        <div className="draw-criteria">
          <div className="draw-chips" role="group" aria-label="المرحلة">
            {stageChips.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="draw-chip"
                aria-pressed={stage === key}
                disabled={setupLocked || busy}
                onClick={() => preview({ stage: key, excludeRanked, excludeFlags })}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="draw-toggles">
            <label>
              <input
                type="checkbox"
                checked={excludeRanked}
                disabled={setupLocked || busy}
                onChange={(e) => preview({ stage, excludeRanked: e.target.checked, excludeFlags })}
              />
              استبعاد الفائزين بالمراكز
            </label>
            <label>
              <input
                type="checkbox"
                checked={excludeFlags}
                disabled={setupLocked || busy}
                onChange={(e) => preview({ stage, excludeRanked, excludeFlags: e.target.checked })}
              />
              استبعاد أصحاب ملاحظات القراءة
            </label>
          </div>
        </div>

        <dl className="draw-stats">
          {(
            [
              ['أكملوا المشاركة', s.submitted],
              ['مؤهلون للسحب', draw ? draw.poolSize : s.eligible],
              ['فائزون بمراكز', s.ranked],
              ['ملاحظات قراءة', s.flagged],
              ['هواتف مشتركة', s.sharedPhones],
            ] as const
          ).map(([label, value], i) => (
            <div key={label} data-key={i === 1 || undefined}>
              <dt>{label}</dt>
              <dd>{n(value)}</dd>
            </div>
          ))}
        </dl>
        <p className="fine-print">
          مؤهل للسحب: مشاركة مرسلة نهائيًا، من مدينة ضمن القائمة المعتمدة، ببيانات غير محذوفة، ولم
          يفز في سحب سابق. جائزة واحدة لكل جوال.
          {s.outsideCities + s.erased + s.previousPrize > 0 &&
            ` خارج القائمة: ${n(s.outsideCities)} من مدن غير معتمدة، ${n(s.erased)} بيانات محذوفة، ${n(s.previousPrize)} فائزون في سحب سابق.`}{' '}
          الملاحظات للتنبيه، ولا تستبعد إلا بالخيار.
        </p>

        {!draw || fresh ? (
          <fieldset className="draw-prizes" disabled={setupLocked || busy}>
            <legend>جوائز السحب</legend>
            <ol>
              {prizes.map((p, i) => (
                <li key={i}>
                  <span className="draw-prize-no">{arDigits(i + 1)}</span>
                  <input
                    aria-label={`وصف الجائزة ${i + 1}`}
                    placeholder="مثال: جهاز لوحي"
                    value={p}
                    maxLength={MAX_PRIZE_LABEL}
                    onChange={(e) =>
                      setPrizes(prizes.map((x, j) => (j === i ? e.target.value : x)))
                    }
                  />
                  {prizes.length > 1 && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`حذف الجائزة ${i + 1}`}
                      onClick={() => setPrizes(prizes.filter((_, j) => j !== i))}
                    >
                      <Icon name="close" size={18} />
                    </button>
                  )}
                </li>
              ))}
            </ol>
            <div className="draw-prize-tools">
              <button
                type="button"
                className="text-link"
                disabled={prizes.length >= MAX_DRAW_PRIZES}
                onClick={() => setPrizes([...prizes, ''])}
              >
                إضافة جائزة
              </button>
              <label className="draw-alternates">
                البدلاء لكل جائزة
                <input
                  type="number"
                  min={0}
                  max={MAX_ALTERNATES}
                  value={alternates}
                  onChange={(e) =>
                    setAlternates(
                      Math.max(0, Math.min(MAX_ALTERNATES, Number(e.target.value) || 0)),
                    )
                  }
                />
              </label>
            </div>
          </fieldset>
        ) : (
          <p className="draw-summary">
            <strong>{stageLabel(draw.stage)}</strong> · {draw.prizes.map((p) => p).join('، ')} ·{' '}
            {arDigits(draw.alternates)} بديل لكل جائزة ·{' '}
            {draw.excludeRanked ? 'يستبعد أصحاب المراكز' : 'يشمل أصحاب المراكز'}
            {draw.excludeFlags ? ' · يستبعد أصحاب الملاحظات' : ''}
          </p>
        )}

        <div className="draw-steps">
          <button
            type="button"
            className="button primary"
            disabled={
              busy ||
              Boolean(view.blocker) ||
              Boolean(draw) ||
              !cleanPrizes.length ||
              cleanPrizes.length !== prizes.length ||
              missing.length > 0 ||
              !s.eligible
            }
            onClick={() =>
              run(
                {
                  action: 'freeze',
                  stage,
                  prizes: cleanPrizes,
                  alternates,
                  excludeRanked,
                  excludeFlags,
                },
                'جُمّدت القائمة. اقرأ البصمة على الشهود ثم ثبّت البذرة.',
              )
            }
          >
            ١ · تجميد القائمة
          </button>
          <button
            type="button"
            className="button primary"
            disabled={busy || !open || Boolean(open.seedCommitment)}
            onClick={() =>
              open &&
              run({ action: 'commit', id: open.id }, 'ثُبّتت البذرة. بصمتها معروضة حتى الكشف.')
            }
          >
            ٢ · تثبيت البذرة
          </button>
          <HoldButton
            disabled={busy || !open?.seedCommitment || Boolean(view.blocker)}
            onConfirm={async () => {
              if (!open) return;
              const next = await run({ action: 'draw', id: open.id }, 'أُجري السحب وكُشفت البذرة.');
              if (next?.draw?.drawnAt) {
                setFocus(0);
                setVerified(null);
                setPlay(Date.now());
              }
            }}
          >
            ٣ · اضغط مطولًا لبدء السحب
          </HoldButton>
          <button
            type="button"
            className="button outline"
            disabled={busy || !draw?.drawnAt}
            onClick={verify}
          >
            إعادة التحقق
          </button>
          {open ? (
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() => setCancelReason(cancelReason === null ? '' : null)}
            >
              إلغاء السحب
            </button>
          ) : (
            draw && (
              <button
                type="button"
                className="text-link"
                disabled={busy}
                onClick={async () => {
                  setFresh(true);
                  setVerified(null);
                  setPrizes(['']);
                  await load(null, { stage, excludeRanked, excludeFlags });
                }}
              >
                سحب جديد
              </button>
            )
          )}
        </div>
        {open && cancelReason !== null && (
          <div className="tie-card draw-cancel">
            <label>
              سبب الإلغاء (يُحفظ في سجل العمليات، والقائمة المجمدة تبقى محفوظة)
              <textarea
                rows={2}
                maxLength={1000}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="button outline"
              disabled={busy || cancelReason.trim().length < 15}
              onClick={async () => {
                if (
                  await run({ action: 'cancel', id: open.id, reason: cancelReason }, 'أُلغي السحب.')
                ) {
                  setCancelReason(null);
                  setFresh(true);
                }
              }}
            >
              تأكيد الإلغاء
            </button>
          </div>
        )}

        <div className="draw-hashes" dir="ltr">
          <code>
            {draw
              ? `Pool fingerprint (${draw.poolSize} numbers) · ${draw.poolFingerprint}`
              : 'Pool fingerprint · not frozen yet'}
          </code>
          <code>
            {draw?.seedCommitment
              ? `Seed commitment · ${draw.seedCommitment}`
              : 'Seed commitment · not committed yet'}
          </code>
          {draw?.seed && <code>Seed revealed · {draw.seed}</code>}
          {verified && (
            <code
              className={
                verified.poolMatches && verified.seedMatches && verified.resultsMatch ? 'ok' : 'bad'
              }
            >
              {verified.poolMatches && verified.seedMatches && verified.resultsMatch
                ? '✓ Re-run from the pool file and seed gives the same winners and alternates'
                : `✗ Mismatch · pool ${verified.poolMatches ? 'ok' : 'differs'} · seed ${verified.seedMatches ? 'ok' : 'differs'} · results ${verified.resultsMatch ? 'ok' : 'differ'}`}
            </code>
          )}
        </div>
      </div>

      <div className="draw-out">
        <div className="draw-audience" aria-live="polite">
          <div className="draw-arch">
            <span className="draw-arch-label">
              {draw?.drawnAt ? draw.prizes[focus] : 'سحب الجوائز'} · رقم المشارك
            </span>
            <PrizeDrawRoll value={focused?.participantNumber ?? null} play={play} />
            <span className="draw-who">
              {focused && draw?.drawnAt && !focused.record.erased
                ? focused.record.name.trim().split(/\s+/)[0]
                : ''}
            </span>
          </div>
        </div>
        <div className="draw-record">
          {!draw?.drawnAt ? (
            <>
              <h3>سجل الفائز</h3>
              <p className="muted">يظهر السجل الكامل هنا بعد السحب، على شاشة المشغّل فقط.</p>
            </>
          ) : (
            <>
              {draw.prizes.length > 1 && (
                <div className="draw-chips" role="tablist" aria-label="الجوائز">
                  {draw.prizes.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      role="tab"
                      className="draw-chip"
                      aria-selected={focus === i}
                      aria-pressed={focus === i}
                      onClick={() => setFocus(i)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
              {focused ? (
                <WinnerRecord
                  key={`${draw.id}-${focused.position}`}
                  draw={draw}
                  entry={focused}
                  busy={busy}
                  onStatus={(status, note) =>
                    run(
                      { action: 'status', id: draw.id, position: focused.position, status, note },
                      status === 'confirmed'
                        ? 'سُجل التواصل مع الفائز.'
                        : 'سُجلت الحالة، وانتقلت الجائزة إلى البديل التالي.',
                    )
                  }
                />
              ) : (
                <p className="muted">
                  نفد البدلاء لهذه الجائزة. أجرِ سحبًا جديدًا لها إن قررت اللجنة ذلك.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {view.draws.length > 0 && (
        <section className="draw-history">
          <h3>سجل السحوبات</h3>
          <ul>
            {view.draws.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  aria-current={!fresh && draw?.id === d.id ? 'true' : undefined}
                  onClick={async () => {
                    setFresh(false);
                    setFocus(0);
                    setVerified(null);
                    setPlay(0);
                    try {
                      await load(d.id);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <strong>{stageLabel(d.stage)}</strong>
                  <span>
                    {arDigits(d.prizes)} جوائز · {n(d.poolSize)} في القائمة
                  </span>
                  <span
                    className={`badge ${d.cancelledAt ? 'neutral' : d.drawnAt ? 'success' : 'warning'}`}
                  >
                    {d.cancelledAt ? 'ملغى' : d.drawnAt ? 'أُجري' : 'قائم'}
                  </span>
                  <small>{riyadhDateTime(d.drawnAt ?? d.frozenAt)}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

function WinnerRecord({
  draw,
  entry,
  busy,
  onStatus,
}: {
  draw: DrawView;
  entry: DrawEntryView;
  busy: boolean;
  onStatus: (status: 'confirmed' | 'unreachable' | 'ineligible', note: string) => void;
}) {
  const [note, setNote] = useState('');
  const r = entry.record;
  const queue = draw.entries.filter(
    (e) => e.role === 'alternate' && e.holds === null && e.status === 'pending',
  );
  const history = draw.entries.filter(
    (e) => e.status !== 'pending' && e.position !== entry.position,
  );
  const fields: [string, string][] = [
    ['رقم المشارك', arDigits(entry.participantNumber)],
    ['المرحلة', stageNames[r.stage as Stage] ?? r.stage],
    ['الجهة التعليمية', r.institution || '—'],
    ['المدينة', `${r.locality} · ${r.region}`],
    ['الجنس', r.gender || '—'],
    ['الجوال', arDigits(localPhone(r.phone))],
    ['جوال احتياطي', arDigits(localPhone(r.backup))],
    [
      'الدرجة',
      `${arDigits(r.score)} من ${arDigits(r.maxScore)} (${arDigits(Math.round(r.percentage))}٪)`,
    ],
    ['الترتيب في المرحلة', `${n(r.stageRank)} من ${n(r.stageSubmitted)}`],
    ['مدة الإجابة', r.minutes === null ? '—' : `${n(r.minutes)} دقيقة`],
    ['وقت القراءة', `${n(r.readingMinutes)} دقيقة`],
    ['تاريخ التسجيل', registeredDate.format(new Date(r.registeredAt))],
    ['على الجوال نفسه', r.samePhone ? `${n(r.samePhone)} آخرون` : 'لا يوجد'],
    ['ملاحظات القراءة', r.flags.length ? r.flags.join('، ') : 'لا يوجد'],
    ['استعادة المحاولة', r.recovered ? 'استُعيدت بقرار اللجنة' : 'لا يوجد'],
  ];
  return (
    <div className="draw-winner">
      <header>
        <h3>{r.erased ? 'مشارك محذوف البيانات' : r.name}</h3>
        <small className="muted">
          {entry.role === 'winner'
            ? 'الفائز المسحوب'
            : `بديل رقم ${arDigits(entry.position - draw.prizes.length)}`}{' '}
          · الترتيب {arDigits(entry.position)} في السحب
        </small>
      </header>
      <div className="draw-pills">
        <span
          className={`badge ${entry.status === 'confirmed' ? 'success' : entry.status === 'pending' ? 'warning' : 'neutral'}`}
        >
          {statusText[entry.status]}
        </span>
        {r.flags.length > 0 && <span className="badge danger">يحتاج مراجعة اللجنة</span>}
        {r.samePhone > 0 && <span className="badge warning">جوال مشترك</span>}
        {r.ranked && <span className="badge neutral">فائز بمركز</span>}
        {r.erased && <span className="badge danger">بيانات محذوفة</span>}
      </div>
      <dl className="draw-fields">
        {fields.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="draw-queue">
        <small className="muted">البدلاء بالترتيب</small>
        <div>
          {queue.length ? (
            queue.map((a) => <span key={a.position}>{arDigits(a.participantNumber)}</span>)
          ) : (
            <span>—</span>
          )}
        </div>
      </div>
      {entry.status === 'pending' ? (
        <div className="draw-contact">
          <label>
            ملاحظة التواصل (مطلوبة لعدم الأهلية)
            <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="draw-steps">
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => onStatus('confirmed', note)}
            >
              تم التواصل
            </button>
            <button
              type="button"
              className="button outline"
              disabled={busy}
              onClick={() => onStatus('unreachable', note)}
            >
              تعذر التواصل
            </button>
            <button
              type="button"
              className="button outline"
              disabled={busy || note.trim().length < 15}
              onClick={() => onStatus('ineligible', note)}
            >
              غير مؤهل
            </button>
          </div>
        </div>
      ) : (
        <p className="fine-print">
          {statusText[entry.status]}
          {entry.note ? `: ${entry.note}` : ''} ·{' '}
          {entry.decidedAt && riyadhDateTime(entry.decidedAt)}
        </p>
      )}
      {history.length > 0 && (
        <ul className="draw-trail" aria-label="حالات مسجلة في هذا السحب">
          {history.map((h) => (
            <li key={h.position}>
              {arDigits(h.participantNumber)} · {statusText[h.status]}
              {h.note ? ` · ${h.note}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
