'use client';
import { useEffect, useState } from 'react';
import { api, ErrorMessage } from './ui';
import { Participation } from './participation';
import { stageKeys, stageNames, type CompetitionState, type Stage } from '@/lib/competition-domain';
export function AdminTestRun() {
  const [stage, setStage] = useState<Stage>('middle');
  const [closed, setClosed] = useState(false);
  const [offline, setOffline] = useState(false);
  const [run, setRun] = useState<CompetitionState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = sessionStorage.getItem('nbc-admin-test-run');
    if (id)
      api<CompetitionState>(`admin/test-run?id=${id}`)
        .then(setRun)
        .catch(() => {});
  }, []);
  async function start(reset = false) {
    setBusy(true);
    setError('');
    try {
      const state = await api<CompetitionState>(
        reset ? 'admin/test-run/reset' : 'admin/test-run/start',
        reset ? { id: run?.attempt?.id } : { stage, reveal: true, closed, synthetic: true },
      );
      setRun(state);
      sessionStorage.setItem('nbc-admin-test-run', state.attempt!.id);
      setEntered(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (entered && run?.attempt)
    return (
      <Participation
        key={run.attempt.id}
        testRunId={run.attempt.id}
        initialState={run}
        simulateOffline={offline}
        onExit={() => setEntered(false)}
        examView
        onStateChange={setRun}
      />
    );
  return (
    <section className="admin-test-area">
      <h2>تجربة المسابقة الكاملة</h2>
      <div className="test-run-banner">وضع تجربة الإدارة — لا يؤثر على نتائج المسابقة</div>
      <p>
        هذه التجربة تستخدم نفس واجهة المشاركة والكتاب والتلميحات ومحرك الإجابات. لا تُنشئ مشاركًا أو
        محاولة إنتاجية.
      </p>
      <p>
        عند عدم اكتمال بنك المرحلة، تستخدم التجربة أسئلة اصطناعية لاختبار النظام فقط. لا تُضاف إلى
        بنك المسابقة ولا تمثل محتوى الكتاب المعتمد.
      </p>
      <div className="test-controls">
        <label>
          المرحلة
          <select value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
            {stageKeys.map((s) => (
              <option key={s} value={s}>
                {stageNames[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} />{' '}
          محاكاة مسابقة مغلقة
        </label>
        <label>
          <input type="checkbox" checked={offline} onChange={(e) => setOffline(e.target.checked)} />{' '}
          محاكاة انقطاع المزامنة
        </label>
        <button className="button primary" disabled={busy} onClick={() => start()}>
          دخول الاختبار
        </button>
        {run && (
          <button className="button outline" disabled={busy} onClick={() => setEntered(true)}>
            متابعة التجربة الحالية
          </button>
        )}
        {run && (
          <button className="button outline" disabled={busy} onClick={() => start(true)}>
            إعادة تجربة المرحلة الحالية
          </button>
        )}
      </div>
      <ErrorMessage message={error} />
      {run?.attempt && (
        <>
          <details>
            <summary>معلومات الاختبار</summary>
            <p>
              المرحلة {run.participant.stage} · التصحيح {run.competition.feedbackMode} · حالة
              النافذة {run.competition.state}
            </p>
            <p>
              المصدر وصفحات التلميح وإصدارات الأسئلة معروضة في الرحلة. يمكنك القفز إلى أي سؤال من
              خريطة الأسئلة، أو تجاوز صفحة المصدر من قارئ PDF لإظهار التلميح.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
