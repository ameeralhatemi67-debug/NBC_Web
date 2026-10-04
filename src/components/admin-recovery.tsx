'use client';
import { useState } from 'react';
export function AdminRecovery({
  participants,
  busy,
  mutate,
}: {
  participants: { attempt_id: string | null; name: string; submitted_at: string | null }[];
  busy: boolean;
  mutate: (path: string, body: unknown, message: string) => Promise<unknown>;
}) {
  const [id, setId] = useState('');
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState(60);
  return (
    <details className="admin-panel">
      <summary>معالجة عطل تقني موثق</summary>
      <p>
        تُمنح مهلة للمشاركة غير المكتملة. لا تُحذف الإجابات المثبتة أو المحاولة السابقة. يُسجل السبب
        وهوية المسؤول والحالة قبل المعالجة وبعدها.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void mutate(
            'admin/recovery',
            { attemptId: id, reason, minutes },
            'سُجلت المعالجة والمهلة في سجل التدقيق.',
          );
        }}
      >
        <label>
          المشاركة
          <select required value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">اختر مشاركة غير مكتملة</option>
            {participants
              .filter((p) => p.attempt_id && !p.submitted_at)
              .map((p) => (
                <option key={p.attempt_id} value={p.attempt_id!}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          سبب العطل المؤكد
          <textarea
            required
            minLength={15}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <label>
          المهلة بالدقائق
          <input
            type="number"
            min={1}
            max={1440}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </label>
        <button className="button outline" disabled={busy || !id}>
          تسجيل معالجة تقنية
        </button>
      </form>
    </details>
  );
}
