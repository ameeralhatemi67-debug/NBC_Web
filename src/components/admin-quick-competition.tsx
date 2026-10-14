'use client';
import { useEffect, useId, useState } from 'react';
import type {
  BookVersion,
  Competition,
  CompetitionQuestion,
  Stage,
} from '@/lib/competition-domain';
import { launchStep, preconditions, trackLabels } from '@/lib/admin-launch';
import { HoldButton } from './hold-button';

export function AdminQuickCompetition({
  competition,
  book,
  questions,
  busy,
  mutate,
  onSettings,
  onQuestions,
}: {
  competition: Competition;
  book: BookVersion;
  questions: CompetitionQuestion[];
  busy: boolean;
  mutate: (path: string, body: unknown, message: string) => Promise<unknown>;
  onSettings: () => void;
  onQuestions: (stage: Stage) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const reasonId = useId();
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const step = launchStep(competition, now);
  const ready = preconditions(book, questions, competition);
  const canStart = step === 1 || step === 2;
  const canClose = step === 2 || step === 3;
  const act = (action: 'open' | 'close') =>
    void mutate(
      'admin/competition',
      { action, version: competition.version },
      action === 'open' ? 'بدأت المسابقة.' : 'أُغلقت المسابقة، وبقيت المشاركات محفوظة.',
    );
  return (
    <section className="admin-panel" aria-label="التحكم السريع بالمسابقة">
      <div className="launch-actions">
        <strong role="status">حالة المسابقة: {trackLabels[step]}</strong>
        <HoldButton
          disabled={busy || !canStart}
          describedBy={reasonId}
          onConfirm={() => act('open')}
        >
          اضغط مطولًا لبدء المسابقة
        </HoldButton>
        <HoldButton danger disabled={busy || !canClose} onConfirm={() => act('close')}>
          اضغط مطولًا لإغلاق المسابقة
        </HoldButton>
        <button type="button" className="text-link" onClick={onSettings}>
          إعدادات المسابقة
        </button>
      </div>
      <div id={reasonId}>
        {step === 0 ? (
          <>
            <p>
              {ready.canFreeze
                ? 'الكتاب والأسئلة جاهزة. اعتمد نسخة الأسئلة من إعدادات المسابقة لتفعيل البدء.'
                : 'البدء غير متاح. أكمل المتطلبات التالية، ثم اعتمد نسخة الأسئلة من إعدادات المسابقة.'}
            </p>
            <ul className="launch-checks" aria-label="متطلبات بدء المسابقة">
              <li className={book.approved ? 'ok' : 'bad'}>
                <span className="check-text">
                  <strong>{ready.list[0].label}</strong>
                </span>
                {!book.approved && (
                  <button type="button" className="text-link" onClick={onSettings}>
                    اعتماد الكتاب
                  </button>
                )}
              </li>
              {ready.stages.map((stage) => (
                <li
                  key={stage.stage}
                  className={stage.ok ? 'ok' : 'bad'}
                  data-check={`quick-stage-${stage.stage}`}
                >
                  <span className="check-text">
                    <strong>{stage.name}</strong>
                    <small>
                      {stage.active} من {stage.expected} سؤالًا محمّلًا · {stage.approved} معتمدًا
                    </small>
                    {!stage.ok && (
                      <small>
                        {stage.active === 0
                          ? 'بنك المرحلة فارغ. استورد الأسئلة أولًا.'
                          : stage.reason}
                      </small>
                    )}
                  </span>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => onQuestions(stage.stage)}
                  >
                    مراجعة أسئلة المرحلة
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="button outline" onClick={onSettings}>
              افتح إعدادات اعتماد النسخة
            </button>
          </>
        ) : canStart ? (
          <p className="muted">
            نسخة الأسئلة معتمدة. اضغط مطولًا حتى يكتمل شريط التأكيد لبدء المسابقة.
          </p>
        ) : step >= 4 ? (
          <p className="muted">
            انتهت هذه المسابقة. يمكنك إنشاء مسابقة جديدة من الإعدادات مع الاحتفاظ بالمشاركات
            السابقة.
          </p>
        ) : (
          <p className="muted">المسابقة مفتوحة لاستقبال المشاركات.</p>
        )}
      </div>
    </section>
  );
}
