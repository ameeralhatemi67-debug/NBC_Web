'use client';
import { useEffect, useRef, useState } from 'react';
import type { Competition } from '@/lib/competition-domain';
import type { ParticipantReport } from '@/lib/service';
import { simulationParticipants } from '@/lib/simulation-fixtures';
import {
  playbackPosition,
  restorePlayback,
  simulationPhases,
  trackTime,
  type Playback,
  type PracticeStatus,
  type SimulationSource,
} from '@/lib/simulation-domain';
import { riyadhDateTime } from '@/lib/format';
import { api, ErrorMessage } from './ui';

type Report = { run: PracticeStatus | null; blocker: string; participants: ParticipantReport[] };
export function AdminSimulation({
  competition,
  source,
  onSource,
  onRows,
  onPracticeRows,
  onEnd,
}: {
  competition?: Competition;
  source: SimulationSource;
  onSource: (source: SimulationSource) => void;
  onRows: (rows: ParticipantReport[]) => void;
  onPracticeRows: (rows: ParticipantReport[]) => void;
  onEnd: () => Promise<void>;
}) {
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [now, setNow] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const serverOffset = useRef(0);
  const loading = useRef(false);
  const alive = useRef(false);
  const generation = useRef(0);
  const run = report?.run;
  const serverNow = now + serverOffset.current;
  const entryOpen = Boolean(run?.entryOpen && serverNow < Date.parse(run.entryClosesAt));
  const canFinish = Boolean(run?.canFinish && serverNow < Date.parse(run.finishUntil));
  const position = playback ? playbackPosition(playback, now) : 0;
  const playing = playback?.playing && position < 300;
  const phase = simulationPhases.filter((p) => p.at <= position).at(-1)!;
  async function refresh(checkBank = false) {
    if (loading.current || !alive.current) return;
    loading.current = true;
    const requestGeneration = generation.current;
    try {
      const result = await api<Report>(
        checkBank ? 'admin/simulation' : 'admin/simulation?readiness=0',
        undefined,
        AbortSignal.timeout(12000),
      );
      if (!alive.current || requestGeneration !== generation.current) return;
      serverOffset.current = result.run ? Date.parse(result.run.serverNow) - Date.now() : 0;
      setReport((previous) => ({
        ...result,
        blocker: checkBank || result.blocker ? result.blocker : (previous?.blocker ?? ''),
      }));
      onPracticeRows(result.participants);
      setError('');
    } catch (e) {
      if (alive.current && requestGeneration === generation.current)
        setError(`تعذر تحديث التجربة. البيانات السابقة محفوظة. ${(e as Error).message}`);
    } finally {
      if (requestGeneration === generation.current) loading.current = false;
    }
  }
  useEffect(() => {
    alive.current = true;
    generation.current++;
    loading.current = false;
    try {
      const stored = restorePlayback(
        JSON.parse(sessionStorage.getItem('nbc-dashboard-simulation') ?? 'null'),
      );
      if (stored) {
        setPlayback(stored);
        onSource('generated');
      }
    } catch {
      /* Invalid or unavailable browser storage starts a fresh track. */
    }
    setNow(Date.now());
    setReady(true);
    void refresh(true);
    const timer = setInterval(() => setNow(Date.now()), 250);
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 5000);
    const focus = () => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now());
        void refresh(true);
      }
    };
    document.addEventListener('visibilitychange', focus);
    window.addEventListener('focus', focus);
    return () => {
      alive.current = false;
      clearInterval(timer);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', focus);
      window.removeEventListener('focus', focus);
    };
  }, [competition?.id]);
  useEffect(() => {
    if (!ready) return;
    try {
      if (playback) sessionStorage.setItem('nbc-dashboard-simulation', JSON.stringify(playback));
      else sessionStorage.removeItem('nbc-dashboard-simulation');
    } catch {
      /* Playback still works when storage is unavailable. */
    }
  }, [playback, ready]);
  useEffect(() => {
    onRows(
      playback
        ? simulationParticipants(
            playback.seed,
            position,
            playback.referenceDate,
            competition?.eligibility,
            competition?.questionCounts,
          )
        : [],
    );
  }, [playback, Math.floor(position), competition, onRows]);
  function seek(value: number) {
    setPlayback((p) =>
      p
        ? { ...p, position: value, anchor: Date.now(), playing: Boolean(playing) && value < 300 }
        : null,
    );
  }
  function start() {
    const time = Date.now();
    setNow(time);
    setPlayback({
      id: crypto.randomUUID(),
      seed: new Uint32Array(crypto.getRandomValues(new Uint32Array(1)))[0],
      referenceDate: new Date(new Date(time).setUTCHours(6, 0, 0, 0)).toISOString(),
      position: 0,
      anchor: time,
      playing: true,
    });
    onSource('generated');
  }
  async function mutate(action: 'open' | 'close') {
    setBusy(true);
    setError('');
    try {
      const result = await api<Report>(
        'admin/simulation',
        action === 'open' ? { action } : { action, id: run?.id, version: run?.version },
      );
      serverOffset.current = result.run ? Date.parse(result.run.serverNow) - Date.now() : 0;
      setReport(result);
      onPracticeRows(result.participants);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function end() {
    try {
      if (entryOpen) await mutate('close');
      setPlayback(null);
      onSource('actual');
      await onEnd();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="admin-simulation" aria-label="محاكاة المسابقة">
      <div className="simulation-heading">
        <div>
          <h2>محاكاة المسابقة</h2>
          <p>شاهد حركة المشاركة، وافتح تجربة الاختبار للمسجلين على الموقع.</p>
        </div>
        {!playback && (
          <button className="button outline" onClick={start} disabled={!ready}>
            بدء المحاكاة
          </button>
        )}
      </div>
      {playback && (
        <div className="simulation-track">
          <div className="simulation-transport">
            <button
              className="button outline"
              onClick={() => {
                setPlayback((p) =>
                  p
                    ? {
                        ...p,
                        position: position >= 300 ? 0 : position,
                        anchor: Date.now(),
                        playing: !playing,
                      }
                    : null,
                );
              }}
            >
              {position >= 300 ? 'إعادة التشغيل' : playing ? 'إيقاف مؤقت' : 'تشغيل'}
            </button>
            <bdi dir="ltr" className="simulation-time">
              {trackTime(position)} / 05:00
            </bdi>
            <span role="status">
              {position >= 300
                ? 'اكتملت المحاكاة'
                : playing
                  ? phase.label
                  : `متوقفة · ${phase.label}`}
            </span>
            <button className="button outline" disabled={busy} onClick={() => void end()}>
              إنهاء المحاكاة
            </button>
          </div>
          <input
            type="range"
            min="0"
            max="300"
            step="1"
            value={Math.floor(position)}
            dir="ltr"
            aria-label="موضع المحاكاة"
            aria-valuetext={trackTime(position)}
            onChange={(e) => seek(Number(e.target.value))}
          />
          <div className="simulation-markers">
            {simulationPhases.map((p) => (
              <button key={p.at} className="text-link" onClick={() => seek(p.at)}>
                <bdi dir="ltr">{trackTime(p.at)}</bdi> {p.label}
              </button>
            ))}
          </div>
          <p className="fine-print">
            بيانات افتراضية لـ 240 مشاركًا. خمس دقائق تعرض يومًا تنافسيًا مضغوطًا؛ ليست مدة الاختبار
            الفعلية. الفترة المعروضة تبدأ {riyadhDateTime(playback.referenceDate)}.
          </p>
        </div>
      )}
      <div className="simulation-window">
        <div>
          <strong>
            {entryOpen
              ? 'الدخول إلى التجربة مفتوح'
              : canFinish
                ? 'انتهى الدخول · مهلة الإكمال قائمة'
                : 'نافذة التجربة مغلقة'}
          </strong>
          <p>
            {run ? (
              <>
                يغلق الدخول {riyadhDateTime(run.entryClosesAt)}. آخر موعد للإكمال{' '}
                {riyadhDateTime(run.finishUntil)}.
              </>
            ) : (
              'خمس دقائق للدخول، ثم 15 دقيقة للإكمال. لا تُحتسب المحاولات ضمن نتائج المسابقة.'
            )}
          </p>
          {entryOpen && (
            <span>
              متبقي للدخول{' '}
              <bdi dir="ltr">{trackTime((Date.parse(run!.entryClosesAt) - serverNow) / 1000)}</bdi>
            </span>
          )}
          {report?.blocker && <p className="fine-print">{report.blocker}</p>}
        </div>
        <div className="simulation-actions">
          {entryOpen ? (
            <button
              className="button outline"
              disabled={busy}
              onClick={() => void mutate('close').catch(() => {})}
            >
              إغلاق الدخول الآن
            </button>
          ) : (
            <button
              className="button primary"
              disabled={busy || !report || Boolean(report.blocker) || canFinish}
              onClick={() => void mutate('open').catch(() => {})}
            >
              {busy ? 'جارٍ الحفظ…' : 'فتح نافذة التجربة'}
            </button>
          )}
          {run && canFinish && (
            <a
              className="button outline"
              target="_blank"
              rel="noopener noreferrer"
              href={`/participate?practice=${encodeURIComponent(run.id)}`}
            >
              فتح التجربة على الموقع
            </a>
          )}
        </div>
      </div>
      <label className="simulation-source">
        البيانات المعروضة
        <select value={source} onChange={(e) => onSource(e.target.value as SimulationSource)}>
          <option value="actual">البيانات الفعلية</option>
          <option value="generated" disabled={!playback}>
            بيانات المحاكاة
          </option>
          <option value="practice" disabled={!run}>
            نتائج التجربة
          </option>
        </select>
      </label>
      <p className="fine-print">
        إيقاف المسار أو تحريكه لا يغير مهلة التجربة أو إجابات المشاركين. إنهاء المحاكاة يغلق الدخول،
        ويترك 15 دقيقة للمشاركات القائمة.
      </p>
      <ErrorMessage message={error} />
    </section>
  );
}
