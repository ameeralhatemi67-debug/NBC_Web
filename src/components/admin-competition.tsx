'use client';
import { useEffect, useId, useState } from 'react';
import type {
  BookVersion,
  Competition,
  CompetitionQuestion,
  Stage,
} from '@/lib/competition-domain';
import {
  changedSettings,
  graceSentence,
  launchStep,
  leaderboardCards,
  nextAction,
  preconditions,
  relativePhrase,
  scheduleIssue,
  studentResultPreview,
  trackLabels,
  type LaunchAction,
  type LaunchCounts,
} from '@/lib/admin-launch';
import { riyadhDateTime } from '@/lib/format';
import { HoldButton } from './hold-button';
import { Icon } from './ui';

type Mutation = (path: string, body: unknown, message: string) => Promise<unknown>;
const RIYADH_OFFSET_MS = 3 * 3600000;
const localTime = (iso: string | null) =>
  iso ? new Date(Date.parse(iso) + RIYADH_OFFSET_MS).toISOString().slice(0, 16) : '';
const fromLocal = (value: string) => (value ? new Date(`${value}:00+03:00`).toISOString() : null);

function useNow(interval = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [interval]);
  return now;
}

// The raw datetime-local input (and its mm/dd/yyyy placeholder) only appears on request, and is
// always pre-filled. Everything else shows the formatted Riyadh time and a relative chip.
function ScheduleField({
  label,
  value,
  fallback,
  now,
  onChange,
}: {
  label: string;
  value: string | null;
  fallback: () => string;
  now: number;
  onChange: (iso: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const id = useId();
  return (
    <div className="launch-field">
      <span className="launch-field-label" id={`${id}-label`}>
        {label}
      </span>
      <div className="launch-field-value">
        {value ? (
          <>
            <time dateTime={value}>{riyadhDateTime(value)}</time>
            <span className="relative-chip">{relativePhrase(value, now)}</span>
          </>
        ) : (
          <span className="muted">غير محدد</span>
        )}
        <button
          type="button"
          className="text-link"
          aria-expanded={editing}
          aria-controls={`${id}-input`}
          onClick={() => {
            if (!editing && !value) onChange(fallback());
            setEditing(!editing);
          }}
        >
          {editing ? 'تم' : value ? 'تعديل' : 'تحديد'}
        </button>
      </div>
      {editing && value && (
        <input
          id={`${id}-input`}
          type="datetime-local"
          aria-labelledby={`${id}-label`}
          value={localTime(value)}
          onChange={(event) => onChange(fromLocal(event.target.value))}
        />
      )}
      <span className="field-hint">بتوقيت الرياض</span>
    </div>
  );
}

export function AdminCompetition({
  competition: c,
  book,
  questions,
  counts,
  busy,
  mutate,
  onOpenTestRun,
  onOpenQuestions,
}: {
  competition: Competition;
  book: BookVersion;
  questions: CompetitionQuestion[];
  counts: LaunchCounts;
  busy: boolean;
  mutate: Mutation;
  onOpenTestRun: () => void;
  onOpenQuestions: (stage: Stage) => void;
}) {
  const now = useNow();
  const [form, setForm] = useState(c);
  const [toast, setToast] = useState('');
  useEffect(() => setForm(c), [c.id, c.version]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);
  const step = launchStep(c, now);
  const next = nextAction(step, counts);
  const pre = preconditions(book, questions);
  const dirty = changedSettings(c, form);
  const locked = c.state === 'RESULTS_PUBLISHED';
  const descriptionId = useId();
  const act = (action: string) =>
    mutate('admin/competition', { action, version: c.version }, 'تم تحديث المسابقة.');
  const close = c.closedAt ?? c.closesAt;
  const graceEnds =
    step === 4 && c.closingPolicy === 'grace' && close
      ? Date.parse(close) + c.graceMinutes * 60000
      : 0;
  const publishWait = next.action === 'publish' && graceEnds > now;
  const blocker =
    step === 0 && !pre.canFreeze
      ? 'أكمل المتطلبات أعلاه لتفعيل الزر.'
      : publishWait
        ? `انتظر انتهاء مهلة المزامنة حتى ${riyadhDateTime(new Date(graceEnds).toISOString())}.`
        : busy
          ? 'جارٍ تنفيذ إجراء سابق.'
          : '';
  const disabled = Boolean(blocker);
  const issue = scheduleIssue(form.opensAt, form.closesAt, now);
  const preview = studentResultPreview(form.leaderboardMode);
  const saveSettings = (scheduled: boolean, message: string) =>
    mutate(
      'admin/competition',
      { ...form, feedbackMode: 'educational', action: 'settings', version: c.version, scheduled },
      message,
    );
  return (
    <section className="admin-panel launch-control">
      <h2>{c.title}</h2>
      <div className="launch-container">
        <section className="launch-card launch-track-card">
          <ol className="launch-track" aria-label="مراحل المسابقة">
            {trackLabels.map((label, i) => (
              <li
                key={label}
                className={i < step ? 'done' : i === step ? 'now' : ''}
                aria-current={i === step ? 'step' : undefined}
              >
                <i aria-hidden="true">{i < step ? <Icon name="check" size={12} /> : null}</i>
                {label}
              </li>
            ))}
          </ol>
        </section>
        <div className="launch-grid">
          <div className="launch-column">
            <section className="launch-card" aria-labelledby={`${descriptionId}-title`}>
              <h3 id={`${descriptionId}-title`}>الخطوة التالية: {next.title}</h3>
              <p id={descriptionId} className="launch-description">
                {next.description}
              </p>
              {step <= 1 && (
                <ul className="launch-checks">
                  {pre.list.map((item) => (
                    <li
                      key={item.id}
                      className={item.informational ? 'info' : item.ok ? 'ok' : 'bad'}
                      data-check={item.id}
                    >
                      <span className="check-icon" aria-hidden="true">
                        <Icon
                          name={item.informational ? 'play' : item.ok ? 'check' : 'warn'}
                          size={16}
                        />
                      </span>
                      <span className="check-text">
                        <strong>{item.label}</strong>
                        <small>{item.detail}</small>
                      </span>
                      {item.id === 'book' && !book.approved && (
                        <button
                          type="button"
                          className="button outline"
                          disabled={busy}
                          onClick={() => act('approve-book')}
                        >
                          اعتمد ملف الكتاب الحالي
                        </button>
                      )}
                      {item.stage && !item.ok && (
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => onOpenQuestions(item.stage!)}
                        >
                          افتح بنك الأسئلة
                        </button>
                      )}
                      {item.id === 'rehearsal' && (
                        <button type="button" className="button outline" onClick={onOpenTestRun}>
                          افتح تجربة الإدارة
                        </button>
                      )}
                      {item.stage && (
                        <div
                          className="check-bar"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={20}
                          aria-valuenow={pre.stages.find((s) => s.stage === item.stage)!.approved}
                          aria-label={item.label}
                        >
                          <b
                            style={{
                              width: `${Math.min(100, (pre.stages.find((s) => s.stage === item.stage)!.approved / 20) * 100)}%`,
                            }}
                          />
                        </div>
                      )}
                      {item.id === 'book' && (
                        <details className="check-details">
                          <summary>بصمة الملف SHA-256</summary>
                          <code className="checksum">{book.sha256}</code>
                        </details>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="launch-actions">
                {next.hold ? (
                  <HoldButton
                    danger={next.danger}
                    disabled={disabled}
                    describedBy={descriptionId}
                    onConfirm={() => void act(next.action)}
                  >
                    {next.label}
                  </HoldButton>
                ) : (
                  <button
                    type="button"
                    className="button primary"
                    disabled={disabled}
                    aria-describedby={descriptionId}
                    onClick={() => void act(next.action)}
                  >
                    {next.label}
                  </button>
                )}
                {step === 1 && (
                  <button
                    type="button"
                    className="button outline"
                    disabled={busy || Boolean(issue)}
                    onClick={() => void saveSettings(true, 'تمت جدولة المسابقة.')}
                  >
                    جدولة الفتح بدل الآن
                  </button>
                )}
                {step === 2 && (
                  <HoldButton danger onConfirm={() => void act('close')}>
                    اضغط مطولًا لإلغاء الجدولة وإغلاق المسابقة
                  </HoldButton>
                )}
                {blocker && (
                  <span className="launch-reason" role="note">
                    {blocker}
                  </span>
                )}
                {step === 1 && issue && !blocker && (
                  <span className="launch-reason" role="note">
                    للجدولة: {issue}
                  </span>
                )}
              </div>
            </section>
            <section className="launch-card">
              <h3>الموعد</h3>
              <ScheduleField
                label="تفتح"
                value={form.opensAt}
                now={now}
                fallback={() =>
                  fromLocal(
                    new Date(now + RIYADH_OFFSET_MS + 86400000).toISOString().slice(0, 11) +
                      '09:00',
                  )!
                }
                onChange={(opensAt) => setForm({ ...form, opensAt })}
              />
              <ScheduleField
                label="تغلق"
                value={form.closesAt}
                now={now}
                fallback={() =>
                  fromLocal(
                    new Date(
                      Date.parse(form.opensAt ?? new Date(now).toISOString()) +
                        RIYADH_OFFSET_MS +
                        7 * 86400000,
                    )
                      .toISOString()
                      .slice(0, 11) + '21:00',
                  )!
                }
                onChange={(closesAt) => setForm({ ...form, closesAt })}
              />
            </section>
          </div>
          <div className="launch-column">
            <section className="launch-card">
              <h3>اسم المسابقة</h3>
              <input
                aria-label="اسم المسابقة"
                value={form.title}
                maxLength={160}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </section>
            <section className="launch-card">
              <h3 id="results-heading">النتائج والترتيب</h3>
              <div className="radio-cards" role="radiogroup" aria-labelledby="results-heading">
                {leaderboardCards.map((card) => (
                  <label key={card.value} className="radio-card">
                    <input
                      type="radio"
                      name="leaderboardMode"
                      value={card.value}
                      checked={form.leaderboardMode === card.value}
                      onChange={() => setForm({ ...form, leaderboardMode: card.value })}
                    />
                    <span>
                      <b>{card.title}</b>
                      <small>{card.detail}</small>
                    </span>
                  </label>
                ))}
              </div>
              <div className="student-preview" aria-live="polite" data-mode={form.leaderboardMode}>
                <div className="student-preview-title">ما الذي يراه الطالب عند الانتهاء</div>
                <div className="student-preview-body">
                  <b>{preview.title}</b>
                  <span>{preview.sentence}</span>
                  <span className="muted">{preview.policy}</span>
                  {preview.ranking && <span className="muted">{preview.ranking}</span>}
                </div>
              </div>
            </section>
            <section className="launch-card">
              <h3 id="closing-heading">سياسة الإغلاق</h3>
              <div className="segmented" role="radiogroup" aria-labelledby="closing-heading">
                {(
                  [
                    ['immediate', 'إيقاف فوري'],
                    ['grace', 'مهلة مزامنة'],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className={form.closingPolicy === value ? 'on' : ''}>
                    <input
                      type="radio"
                      name="closingPolicy"
                      value={value}
                      checked={form.closingPolicy === value}
                      onChange={() => setForm({ ...form, closingPolicy: value })}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {form.closingPolicy === 'grace' ? (
                <div className="launch-field">
                  <label htmlFor="grace-minutes">مهلة المزامنة بالدقائق</label>
                  <input
                    id="grace-minutes"
                    type="number"
                    min={0}
                    max={10080}
                    value={form.graceMinutes}
                    onChange={(event) =>
                      setForm({ ...form, graceMinutes: Number(event.target.value) })
                    }
                  />
                  <span className="field-hint" data-testid="grace-sentence">
                    {graceSentence(form.closesAt, form.graceMinutes)}
                  </span>
                </div>
              ) : (
                <p className="muted">تتوقف المحاولات القائمة عند لحظة الإغلاق.</p>
              )}
            </section>
            <p className="policy-note">
              <Icon name="info" size={18} />
              <span>
                تظهر الإجابة الصحيحة والتوضيح بعد تثبيت الإجابة، ولا يمكن تغيير الإجابة المثبتة. هذه
                سياسة ثابتة وليست خيارًا.
              </span>
            </p>
            <details className="launch-more">
              <summary>خيارات أخرى</summary>
              <p className="muted">
                إنشاء حملة جديدة يبقي المحاولات السابقة محفوظة. يلزم إغلاق المسابقة الحالية أولًا.
              </p>
              <button
                type="button"
                className="button outline"
                disabled={busy || [2, 3].includes(step)}
                onClick={() =>
                  void mutate(
                    'admin/competition',
                    { action: 'create', title: 'مسابقة جديدة' },
                    'تم إنشاء مسابقة مسودة جديدة. المحاولات السابقة محفوظة.',
                  )
                }
              >
                إنشاء حملة جديدة
              </button>
            </details>
          </div>
        </div>
      </div>
      {dirty.length > 0 && (
        <div className="save-bar" role="region" aria-label="حفظ الإعدادات">
          <span>
            {dirty.length} {dirty.length === 1 ? 'تغيير غير محفوظ' : 'تغييرات غير محفوظة'}
            {locked && ' · اسحب النشر قبل تغيير السياسة'}
          </span>
          <button type="button" className="button outline" onClick={() => setForm(c)}>
            تجاهل
          </button>
          <button
            type="button"
            className="button primary"
            disabled={busy || locked}
            onClick={async () => {
              if ((await saveSettings(false, '')) !== false) setToast('تم حفظ الإعدادات');
            }}
          >
            حفظ الإعدادات
          </button>
        </div>
      )}
      <div className="admin-toast" role="status" aria-live="polite" hidden={!toast}>
        <Icon name="check" size={16} /> {toast}
      </div>
      <p className="fine-print">
        تغيير بنك الأسئلة بعد الاعتماد يجهز إصدارًا لاحقًا؛ النسخة المنشورة لا تتغير. لا تُنشر
        الجوائز تلقائيًا.
      </p>
    </section>
  );
}
