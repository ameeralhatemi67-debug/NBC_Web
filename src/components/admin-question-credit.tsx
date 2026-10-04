'use client';
import { useState } from 'react';
import type { CompetitionQuestion } from '@/lib/competition-domain';
export function AdminQuestionCredit({
  questions,
  busy,
  mutate,
}: {
  questions: CompetitionQuestion[];
  busy: boolean;
  mutate: (path: string, body: unknown, message: string) => Promise<unknown>;
}) {
  const [questionId, setQuestionId] = useState('');
  const [reason, setReason] = useState('');
  return (
    <details className="admin-panel">
      <summary>قرار اللجنة بشأن سؤال غير صالح</summary>
      <p>
        يمنح هذا القرار نقطة السؤال لكل المحاولات المتأثرة في هذه المسابقة، ويعيد حساب النتائج
        المكتملة. تبقى الإجابات ونسخ الأسئلة الأصلية محفوظة. اسحب النشر أولًا، وسجل سببًا معتمدًا.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void mutate(
            'admin/question-credit',
            { questionId, reason },
            'سُجل التعويض وإعادة الحساب في سجل التدقيق.',
          );
        }}
      >
        <label>
          السؤال
          <select required value={questionId} onChange={(e) => setQuestionId(e.target.value)}>
            <option value="">اختر السؤال في النسخة المعتمدة</option>
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.stage} · {q.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          قرار اللجنة وسبب بطلان السؤال
          <textarea
            required
            minLength={15}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button className="button outline" disabled={busy || !questionId}>
          تسجيل قرار منح نقطة السؤال للجميع
        </button>
      </form>
    </details>
  );
}
