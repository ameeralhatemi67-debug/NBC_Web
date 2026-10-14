'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PracticeStatus } from '@/lib/simulation-domain';
import { riyadhDateTime } from '@/lib/format';
import { api } from './ui';

export function SimulationEntry() {
  const [run, setRun] = useState<PracticeStatus | null>(null);
  const [stale, setStale] = useState(false);
  useEffect(() => {
    let alive = true,
      busy = false;
    const load = async () => {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      try {
        const status = await api<{ run: PracticeStatus | null }>(
          'simulation/status',
          undefined,
          AbortSignal.timeout(12000),
        );
        if (alive) {
          setRun(status.run);
          setStale(false);
        }
      } catch {
        if (alive) setStale(true);
      } finally {
        busy = false;
      }
    };
    void load();
    const timer = setInterval(() => void load(), 5000);
    document.addEventListener('visibilitychange', load);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, []);
  if (!run?.canFinish) return null;
  return (
    <section className="simulation-entry container" aria-label="تجربة الاختبار">
      <div>
        <h2>{run.entryOpen ? 'جرّب الاختبار قبل انطلاق المسابقة' : 'مهلة إكمال التجربة قائمة'}</h2>
        <p>
          تجربة للمشاركين المسجلين، لا تُحتسب ضمن النتائج أو الجوائز.{' '}
          {run.entryOpen ? 'يمكنك الدخول الآن.' : 'الدخول مغلق؛ يمكن للمشاركات القائمة المتابعة.'}
        </p>
        <p className="fine-print">
          يغلق الدخول {riyadhDateTime(run.entryClosesAt)}، وتنتهي مهلة الإكمال{' '}
          {riyadhDateTime(run.finishUntil)}.{' '}
          {stale && 'تعذر تحديث الحالة؛ يتحقق الموقع من الموعد عند الدخول.'}
        </p>
      </div>
      <Link className="button outline" href={`/participate?practice=${encodeURIComponent(run.id)}`}>
        {run.entryOpen ? 'دخول التجربة' : 'متابعة التجربة'}
      </Link>
    </section>
  );
}
