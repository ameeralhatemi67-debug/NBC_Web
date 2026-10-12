'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { stageNames, type Stage } from '@/lib/competition-domain';
import {
  PLACES,
  evaluateStage,
  reasonProblem,
  type Candidate,
  type StageEvaluation,
} from '@/lib/winners';
import { riyadhDateTime } from '@/lib/format';
import { api, ErrorMessage, Icon, Loading } from './ui';
import { HoldButton } from './hold-button';

type StageView = {
  stage: Stage;
  submitted: number;
  candidates: Candidate[];
  places: { place: number; attemptId: string | null; amount: number }[];
  reason: string;
  decidedBy: string | null;
  decidedAt: string | null;
};
type WinnersView = {
  competition: { id: string; title: string; state: string };
  blocker: string;
  stages: StageView[];
  media: { label: string; amount: number; decidedBy: string | null; decidedAt: string | null };
  publication: { publishedAt: string; publishedBy: string; showNames: boolean } | null;
};
const money = new Intl.NumberFormat('en-US');
const flagText: [keyof StageEvaluation, string][] = [
  ['tieAmongWinners', 'درجات متساوية وُزّعت على مراكز مختلفة.'],
  ['tieAtBoundary', 'مشارك خارج المراكز يساوي درجة آخر فائز.'],
  ['orderViolation', 'ترتيب المراكز يخالف ترتيب الدرجات.'],
  ['skippedHigher', 'مشارك بدرجة أعلى لم يُدرج بين الفائزين.'],
];

export function AdminWinners() {
  const [view, setView] = useState<WinnersView | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<WinnersView>('admin/winners')
      .then(setView)
      .catch((e) => setError((e as Error).message));
  }, []);
  async function run(body: Record<string, unknown>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setView(await api<WinnersView>('admin/winners', body));
      setNotice(message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!view) return error ? <ErrorMessage message={error} /> : <Loading />;
  const published = view.publication !== null;
  const locked = published || Boolean(view.blocker);
  return (
    <section className="admin-panel winners-admin">
      <ErrorMessage message={error} />
      {notice && (
        <div role="status" className="success-message">
          {notice}
        </div>
      )}
      {view.blocker && (
        <div className="notice" role="status">
          <Icon name="clock" />
          <span>{view.blocker}. يمكنك مراجعة الترتيب الآن، وتتاح القرارات بعد ذلك.</span>
        </div>
      )}
      {published && (
        <div className="notice" role="status">
          <Icon name="check" />
          <span>
            الإعلان منشور منذ {riyadhDateTime(view.publication!.publishedAt)}. اسحب النشر أولًا
            لتعديل القرارات.
          </span>
        </div>
      )}
      <p className="fine-print">
        اختيار الفائزين قرار للجنة. التعادل لا يُحسم بالوقت، ولا يُختار فائز تلقائيًا. أي تعادل أو
        مخالفة لترتيب الدرجات يتطلب سببًا مكتوبًا يُحفظ في سجل العمليات.
      </p>
      {view.stages.map((stage) => (
        <StageCard
          key={`${stage.stage}-${stage.decidedAt ?? 'new'}`}
          stage={stage}
          locked={locked}
          busy={busy}
          onSave={(places, reason) =>
            run(
              { action: 'save-stage', stage: stage.stage, places, reason },
              `حُفظ قرار ${stageNames[stage.stage]}.`,
            )
          }
        />
      ))}
      <MediaCard
        key={view.media.decidedAt ?? 'new'}
        media={view.media}
        locked={published}
        busy={busy}
        onSave={(label) =>
          run({ action: 'save-media', label }, label ? 'حُفظ فائز الإعلام.' : 'أُزيل فائز الإعلام.')
        }
      />
      <PublishCard view={view} busy={busy} blocked={Boolean(view.blocker)} run={run} />
    </section>
  );
}

function StageCard({
  stage,
  locked,
  busy,
  onSave,
}: {
  stage: StageView;
  locked: boolean;
  busy: boolean;
  onSave: (places: (string | null)[], reason: string) => Promise<boolean>;
}) {
  const saved = stage.places.map((p) => p.attemptId);
  const [places, setPlaces] = useState<(string | null)[]>(saved);
  const [reason, setReason] = useState(stage.reason);
  const rows = stage.candidates.map((c) => ({ attemptId: c.attemptId, percentage: c.percentage }));
  const evaluation = evaluateStage(rows, places);
  const problem = evaluation.errors[0] || reasonProblem(evaluation, reason);
  const changed = JSON.stringify(places) !== JSON.stringify(saved) || reason !== stage.reason;
  const chosen = places.filter(Boolean);
  const tieSize = (c: Candidate) =>
    stage.candidates.filter((o) => Math.abs(o.percentage - c.percentage) < 1e-6).length;
  const set = (i: number, value: string) =>
    setPlaces(places.map((p, j) => (j === i ? value || null : p)));
  const byId = new Map(stage.candidates.map((c) => [c.attemptId, c]));
  return (
    <section className="launch-card winners-stage">
      <header>
        <h3>{stageNames[stage.stage]}</h3>
        <span className="muted">
          {stage.submitted} مشاركة مكتملة
          {stage.decidedAt && ` · آخر قرار ${riyadhDateTime(stage.decidedAt)}`}
        </span>
      </header>
      {!stage.submitted ? (
        <p className="muted">لا توجد مشاركات مكتملة في هذه المرحلة.</p>
      ) : (
        <>
          {stage.submitted > stage.candidates.length && (
            <p className="field-hint">
              تُعرض أعلى {stage.candidates.length} درجة للاختيار من بين {stage.submitted}.
            </p>
          )}
          <ol className="award-list">
            {places.map((value, i) => {
              const picked = value ? byId.get(value) : undefined;
              return (
                <li key={i}>
                  <span className="award-place">المركز {i + 1}</span>
                  <select
                    aria-label={`${stageNames[stage.stage]}: المركز ${i + 1}`}
                    value={value ?? ''}
                    disabled={locked || busy}
                    onChange={(e) => set(i, e.target.value)}
                  >
                    <option value="">—</option>
                    {stage.candidates
                      .filter((c) => c.attemptId === value || !chosen.includes(c.attemptId))
                      .map((c) => (
                        <option key={c.attemptId} value={c.attemptId}>
                          {c.name} · {c.score}/{c.maxScore}
                          {tieSize(c) > 1 ? ' · تعادل' : ''} · {c.participantNumber}
                        </option>
                      ))}
                  </select>
                  <bdi className="award-amount">{money.format(stage.places[i].amount)} ريال</bdi>
                  {picked?.institution && <small className="muted">{picked.institution}</small>}
                </li>
              );
            })}
          </ol>
          <div className="winners-tools">
            <button
              type="button"
              className="text-link"
              disabled={locked || busy}
              onClick={() =>
                setPlaces(
                  Array.from({ length: PLACES }, (_, i) => stage.candidates[i]?.attemptId ?? null),
                )
              }
            >
              تعبئة حسب ترتيب الدرجات
            </button>
            <button
              type="button"
              className="text-link"
              disabled={locked || busy}
              onClick={() => setPlaces(Array(PLACES).fill(null))}
            >
              مسح الاختيار
            </button>
          </div>
          {evaluation.needsReason && (
            <div className="tie-card" role="status">
              <strong>قرار يحتاج إلى سبب موثّق</strong>
              <ul>
                {flagText
                  .filter(([key]) => evaluation[key])
                  .map(([key, text]) => (
                    <li key={key}>{text}</li>
                  ))}
              </ul>
              <label>
                سبب قرار اللجنة
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={reason}
                  disabled={locked || busy}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </div>
          )}
          {problem && changed && !locked && (
            <p className="launch-reason" role="note">
              {problem}
            </p>
          )}
          <div className="launch-actions">
            <button
              type="button"
              className="button primary"
              disabled={locked || busy || !changed || Boolean(problem)}
              onClick={() => void onSave(places, evaluation.needsReason ? reason : '')}
            >
              حفظ قرار {stageNames[stage.stage]}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function MediaCard({
  media,
  locked,
  busy,
  onSave,
}: {
  media: WinnersView['media'];
  locked: boolean;
  busy: boolean;
  onSave: (label: string) => Promise<boolean>;
}) {
  const [label, setLabel] = useState(media.label);
  return (
    <section className="launch-card winners-stage">
      <header>
        <h3>جائزة التفاعل والتميز الإعلامي</h3>
        <bdi className="award-amount">{money.format(media.amount)} ريال</bdi>
      </header>
      <p className="launch-description">
        جائزة مستقلة عن نتائج الأسئلة. اكتب اسم الفائز أو الجهة كما يُعلن، أو اتركه فارغًا لإزالتها
        من الإعلان.
      </p>
      <label>
        الفائز
        <input
          value={label}
          maxLength={160}
          disabled={locked || busy}
          onChange={(e) => setLabel(e.target.value)}
        />
      </label>
      <div className="launch-actions">
        <button
          type="button"
          className="button primary"
          disabled={locked || busy || label.trim() === media.label}
          onClick={() => void onSave(label)}
        >
          حفظ
        </button>
      </div>
    </section>
  );
}

function PublishCard({
  view,
  busy,
  blocked,
  run,
}: {
  view: WinnersView;
  busy: boolean;
  blocked: boolean;
  run: (body: Record<string, unknown>, message: string) => Promise<boolean>;
}) {
  const published = view.publication;
  const [showNames, setShowNames] = useState(published?.showNames ?? false);
  const changed = published && published.showNames !== showNames;
  return (
    <section className="launch-card winners-publish">
      <h3>إعلان الفائزين</h3>
      <p className="launch-description">
        يظهر الإعلان للجميع في الصفحة الرئيسية وصفحة «الفائزون» بما كان محفوظًا لحظة النشر. أي تعديل
        لاحق على القرارات يتطلب سحب الإعلان ثم نشره من جديد.
      </p>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={showNames}
          disabled={busy}
          onChange={(e) => setShowNames(e.target.checked)}
        />
        <span>
          إظهار أسماء الفائزين وجهات دراستهم. عند الإيقاف يظهر رقم المشارك فقط. بعض الفائزين قاصرون،
          فراجع موافقة أولياء الأمور قبل إظهار الأسماء.
        </span>
      </label>
      <div className="launch-actions">
        {!published || changed ? (
          <HoldButton
            disabled={busy || blocked}
            onConfirm={() => void run({ action: 'publish', showNames }, 'نُشر إعلان الفائزين.')}
          >
            {published ? 'اضغط مطولًا لتحديث طريقة العرض' : 'اضغط مطولًا لنشر إعلان الفائزين'}
          </HoldButton>
        ) : null}
        {published && (
          <HoldButton
            danger
            onConfirm={() => void run({ action: 'withdraw' }, 'سُحب إعلان الفائزين.')}
          >
            اضغط مطولًا لسحب الإعلان
          </HoldButton>
        )}
        {published && (
          <Link className="text-link" href="/winners" target="_blank">
            معاينة الصفحة العامة <Icon size={17} />
          </Link>
        )}
      </div>
    </section>
  );
}
