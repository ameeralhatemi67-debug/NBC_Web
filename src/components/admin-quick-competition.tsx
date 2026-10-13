'use client';
import { useEffect, useState } from 'react';
import type { Competition } from '@/lib/competition-domain';
import { launchStep, trackLabels } from '@/lib/admin-launch';
import { HoldButton } from './hold-button';

export function AdminQuickCompetition({
  competition,
  busy,
  mutate,
  onSettings,
}: {
  competition: Competition;
  busy: boolean;
  mutate: (path: string, body: unknown, message: string) => Promise<unknown>;
  onSettings: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const step = launchStep(competition, now);
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
        <HoldButton disabled={busy || !canStart} onConfirm={() => act('open')}>
          اضغط مطولًا لبدء المسابقة
        </HoldButton>
        <HoldButton danger disabled={busy || !canClose} onConfirm={() => act('close')}>
          اضغط مطولًا لإغلاق المسابقة
        </HoldButton>
        <button type="button" className="text-link" onClick={onSettings}>
          إعدادات المسابقة
        </button>
      </div>
      {step === 0 && <p className="muted">اعتمد نسخة الأسئلة من إعدادات المسابقة لتفعيل البدء.</p>}
      {step >= 4 && (
        <p className="muted">
          انتهت هذه المسابقة. يمكنك إنشاء مسابقة جديدة من الإعدادات مع الاحتفاظ بالمشاركات السابقة.
        </p>
      )}
    </section>
  );
}
