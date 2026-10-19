'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AnalyticsParticipant } from '@/lib/analytics';
import {
  DISCRIMINATION_FLOOR,
  SMALL_GROUP,
  biggestLoss,
  cityPerformance,
  dropOff,
  isSmall,
  itemVerdict,
  joinInsights,
  participationFunnel,
  readingAgainstScore,
  registrationHeat,
  reviewSignals,
  sourceAttribution,
  stageCityMatrix,
  summarizeGuidance,
  weekdays,
  type InsightsData,
  type ItemStat,
} from '@/lib/analytics-insights';
import { stageKeys, stageNames } from '@/lib/competition-domain';
import { api } from './ui';
import { MakePoster, type PosterHook } from './admin-analytics-charts';
import type { ChartKind } from '@/lib/media/charts';

const number = (v: number) => v.toLocaleString('ar-SA', { maximumFractionDigits: 1 });
const pct = (v: number | null) => (v === null ? '—' : `${number(v)}٪`);
// Groups under five are never shown as an exact number.
const count = (n: number) => (isSmall(n) ? 'أقل من ٥' : number(n));
const stageList = stageKeys.map((k) => stageNames[k]);
const keyOf = (name: string) => stageKeys.find((k) => stageNames[k] === name);
const hourLabel = (h: number) => `${number(h % 12 || 12)} ${h < 12 ? 'ص' : 'م'}`;

function Panel({
  title,
  subtitle,
  foot,
  wide,
  children,
  poster,
  chart,
}: {
  title: string;
  subtitle?: ReactNode;
  foot?: ReactNode;
  wide?: boolean;
  children: ReactNode;
  poster?: PosterHook;
  chart?: ChartKind;
}) {
  return (
    <section className={`panel analytics-visual insight-panel${wide ? ' wide' : ''}`}>
      <div className="panel-heading">
        <h2>{title}</h2>
        {subtitle && <span>{subtitle}</span>}
        {chart && <MakePoster poster={poster} chart={chart} />}
      </div>
      <div className="analytics-visual-body">{children}</div>
      {foot && <p className="insight-foot">{foot}</p>}
    </section>
  );
}
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(420);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(240, Math.floor(entry.contentRect.width))),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}
const ServerOnly = () => <p className="empty-inline">متاحة لبيانات المسابقة الفعلية فقط.</p>;

export function AdminAnalyticsInsights({
  people,
  stage,
  live,
  poster,
}: {
  people: AnalyticsParticipant[];
  stage: string;
  live: boolean;
  poster?: PosterHook;
}) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      setData(await api<InsightsData>('admin/analytics'));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!live) return;
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 60000);
    return () => clearInterval(timer);
  }, [live]);
  const rows = joinInsights(people, live ? data?.rows : undefined);
  const ready = live && !!data;
  const funnel = participationFunnel(rows);
  const loss = biggestLoss(funnel);
  const heat = registrationHeat(people);
  const cities = cityPerformance(people);
  const matrix = stageCityMatrix(people, stageList);
  const reading = readingAgainstScore(rows);
  const sources = sourceAttribution(rows);
  const signals = reviewSignals(rows);
  const startedStages = stageList.filter((s) => rows.some((p) => p.stage === s && p.attempt_id));
  const [pickedStage, setPickedStage] = useState('');
  const focusStage = stage || pickedStage || startedStages[0] || stageList[0];
  const drop = dropOff(rows, focusStage);
  const items = data?.items[keyOf(focusStage) ?? ''];

  return (
    <div className="analytics-insights">
      <div className="insights-bar">
        <span className="eyebrow">قراءة أعمق</span>
        {live ? (
          <span className="muted">
            {data
              ? `آخر تحديث ${new Date(data.generatedAt).toLocaleTimeString('ar-SA', { hour: 'numeric', minute: '2-digit' })}`
              : busy
                ? 'جارٍ التحميل…'
                : ''}
          </span>
        ) : (
          <span className="muted">
            بيانات المحاكاة: تظهر الرسوم المحسوبة من قائمة المشاركين فقط.
          </span>
        )}
        {live && (
          <button type="button" className="text-link" disabled={busy} onClick={load}>
            تحديث
          </button>
        )}
        {!stage && (
          <div className="insight-stage" role="group" aria-label="مرحلة الأسئلة">
            {stageList.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={focusStage === s}
                onClick={() => setPickedStage(s)}
              >
                {s.replace('المرحلة ', '')}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}

      <div className="analytics-visual-grid">
        <Panel
          title="مسار المشاركة"
          subtitle="من التسجيل إلى الإرسال"
          poster={poster}
          chart="funnel"
          foot={
            ready && loss
              ? `أكبر فقد بين «${loss.from}» و«${loss.to}»: ${count(loss.lost)} مشاركًا.`
              : undefined
          }
        >
          {!people.length ? (
            <p className="empty-inline">لا توجد بيانات مطابقة.</p>
          ) : (
            <ol className="insight-funnel">
              {funnel.map((step) => {
                const needsServer = ['opened', 'answered'].includes(step.key) && !ready;
                return (
                  <li key={step.key}>
                    <div>
                      <span>{step.label}</span>
                      <bdi>{needsServer ? '—' : count(step.count)}</bdi>
                    </div>
                    <div className="insight-track">
                      <span style={{ width: `${needsServer ? 0 : (step.ofStart ?? 0)}%` }} />
                    </div>
                    <small>
                      {needsServer
                        ? 'يحتاج بيانات المسابقة الفعلية'
                        : step.fromPrevious === null
                          ? 'نقطة البداية'
                          : `${pct(step.fromPrevious)} من الخطوة السابقة`}
                    </small>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
        <Panel
          title="أين يتوقف من لم يُكمل"
          subtitle={`آخر سؤال أُجيب عنه · ${focusStage}`}
          foot={
            ready && drop.total
              ? drop.peak
                ? `أكثر توقف بعد السؤال ${number(drop.peak)} من ${number(drop.questionCount)}. ${count(drop.bins[0].count)} لم يُجيبوا عن أي سؤال.`
                : `${count(drop.total)} محاولة لم تُجب عن أي سؤال بعد.`
              : undefined
          }
        >
          {!live ? <ServerOnly /> : !ready ? null : <DropChart drop={drop} />}
        </Panel>
        <Panel
          title="متى يسجّل المشاركون"
          subtitle="اليوم والساعة بتوقيت المملكة"
          poster={poster}
          chart="heat"
          foot={
            heat.peak
              ? `الذروة يوم ${weekdays[heat.peak.day]} عند ${hourLabel(heat.peak.hour)}: وقت مناسب لنشر التذكيرات.`
              : undefined
          }
        >
          <Heatmap grid={heat.grid} max={heat.max} />
        </Panel>
        <Panel
          title="المدن: الحجم مقابل الأداء"
          subtitle="الإكمال والدرجة · حجم الدائرة عدد المسجلين"
          poster={poster}
          chart="bubbles"
          foot={<CityNote cities={cities} />}
        >
          <CityBubbles cities={cities} />
        </Panel>
      </div>

      <div className="analytics-visual-grid insight-grid-wide">
        <Panel
          title="صحة الأسئلة"
          subtitle={
            items
              ? `${number(items.items.length)} سؤالًا · ${count(items.submitted)} مشاركة مكتملة · ${focusStage}`
              : focusStage
          }
          foot={`أسفل الخط المتقطع: يجيب عنه أصحاب الدرجات العالية والمنخفضة بالقدر نفسه تقريبًا، فيُراجع نصه أو مفتاحه.`}
        >
          {!live ? (
            <ServerOnly />
          ) : !ready ? null : !items || items.submitted < SMALL_GROUP ? (
            <p className="empty-inline">تظهر بعد خمس مشاركات مكتملة على الأقل في المرحلة.</p>
          ) : (
            <ItemHealth items={items.items} />
          )}
        </Panel>
        <Panel
          title="وقت القراءة والدرجة"
          subtitle={
            ready && reading.r !== null
              ? `معامل الارتباط ${number(Math.round(reading.r * 100) / 100)} · ${count(reading.points.length)} مشاركة`
              : 'كل نقطة مشاركة مكتملة'
          }
          foot={ready && reading.r !== null ? <ReadingNote r={reading.r} /> : undefined}
        >
          {!live ? (
            <ServerOnly />
          ) : !ready ? null : reading.points.length < SMALL_GROUP ? (
            <p className="empty-inline">تظهر بعد خمس مشاركات مكتملة على الأقل.</p>
          ) : (
            <ReadingScatter points={reading.points} />
          )}
        </Panel>
      </div>

      <div className="insight-grid-3">
        <Panel title="المنشورات التي جلبت مشاركين" subtitle="حسب رمز الرابط ‎?ref=">
          {!live ? (
            <ServerOnly />
          ) : !ready ? null : (
            <SourceList sources={sources} names={data.postNames ?? {}} />
          )}
        </Panel>
        <Panel
          title="الإكمال حسب المرحلة والمدينة"
          subtitle="نسبة المكتملين من المسجلين"
          poster={poster}
          chart="matrix"
        >
          <Matrix matrix={matrix} />
        </Panel>
        <Panel title="مؤشرات للمراجعة" subtitle="للجنة فقط">
          {!live ? (
            <ServerOnly />
          ) : !ready ? null : (
            <ul className="insight-signals">
              {signals.map((s) => (
                <li key={s.key} data-on={s.count > 0 || undefined}>
                  <div>
                    <strong>{s.label}</strong>
                    <small>{s.note}</small>
                  </div>
                  <bdi>{s.count ? count(s.count) : '٠'}</bdi>
                </li>
              ))}
            </ul>
          )}
          <p className="fine-print">مؤشرات للمراجعة، وليست حكمًا على أي مشارك.</p>
        </Panel>
      </div>

      <GuidancePanel
        data={ready ? data.guidance : undefined}
        live={live}
        stageKey={keyOf(focusStage) ?? ''}
        stageName={focusStage}
      />

      <Panel wide title="صحة رموز التحقق" subtitle="نسبة الرسائل الفاشلة كل ساعة · آخر ٢٤ ساعة">
        {!live ? (
          <ServerOnly />
        ) : !ready ? null : !data.otp.enabled ? (
          <p className="empty-inline">التحقق برمز الجوال متوقف حاليًا؛ لا توجد رسائل لقياسها.</p>
        ) : (
          <OtpHealth hours={data.otp.hours} now={Date.parse(data.generatedAt)} />
        )}
      </Panel>
    </div>
  );
}

function DropChart({ drop }: { drop: ReturnType<typeof dropOff> }) {
  const { ref, width } = useWidth();
  if (!drop.total)
    return <p className="empty-inline">لا توجد محاولات غير مكتملة في هذه المرحلة.</p>;
  const height = 210,
    left = 34,
    top = 14,
    bottom = 40,
    plotH = height - top - bottom,
    plotW = width - left - 8,
    slot = plotW / drop.bins.length,
    max = Math.max(1, ...drop.bins.map((b) => b.count));
  return (
    <div ref={ref} className="analytics-plot">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="آخر سؤال أجاب عنه من لم يرسل"
      >
        <line
          className="analytics-gridline"
          x1={left}
          x2={width - 8}
          y1={top + plotH}
          y2={top + plotH}
        />
        {drop.bins.map((b) => {
          const h = (b.count / max) * plotH,
            x = left + slot * b.question;
          return (
            <g key={b.question}>
              <rect
                className={
                  b.question === drop.peak ? 'insight-mark-strong' : 'analytics-primary-mark'
                }
                x={x + 1}
                y={top + plotH - h}
                width={Math.max(1, slot - 2)}
                height={h}
              >
                <title>{`${b.question ? `توقف بعد السؤال ${b.question}` : 'لم يُجب عن أي سؤال'}: ${count(b.count)}`}</title>
              </rect>
              {(b.question === 0 || b.question % 5 === 0 || b.question === drop.questionCount) && (
                <text x={x + slot / 2} y={top + plotH + 16} textAnchor="middle">
                  {number(b.question)}
                </text>
              )}
            </g>
          );
        })}
        <text x={left + plotW / 2} y={height - 4} textAnchor="middle">
          رقم آخر سؤال أُجيب عنه (٠ = لا إجابة)
        </text>
      </svg>
    </div>
  );
}

function Heatmap({ grid, max }: { grid: number[][]; max: number }) {
  if (!max) return <p className="empty-inline">لا توجد تسجيلات مطابقة.</p>;
  return (
    <div className="insight-heat" role="table" aria-label="التسجيل حسب اليوم والساعة">
      <div className="insight-heat-row insight-heat-hours" role="row" aria-hidden>
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h}>{h % 3 === 0 ? number(h) : ''}</span>
        ))}
      </div>
      {grid.map((row, day) => (
        <div className="insight-heat-row" role="row" key={day}>
          <span role="rowheader">{weekdays[day]}</span>
          {row.map((n, h) => (
            <span
              role="cell"
              key={h}
              className="insight-heat-cell"
              style={{ ['--heat' as string]: n ? 0.14 + 0.86 * (n / max) : 0 }}
              title={`${weekdays[day]} · ${hourLabel(h)}: ${n ? count(n) : 'لا تسجيلات'}`}
            />
          ))}
        </div>
      ))}
      <div className="insight-heat-scale">
        <span>أقل</span>
        <i />
        <span>أكثر</span>
      </div>
    </div>
  );
}

function CityBubbles({ cities }: { cities: ReturnType<typeof cityPerformance> }) {
  const { ref, width } = useWidth();
  const shown = cities.filter((c) => !c.small && c.completion !== null);
  if (!shown.length)
    return <p className="empty-inline">تظهر المدن التي سجّل فيها خمسة مشاركين على الأقل.</p>;
  const height = 300,
    left = 40,
    right = 16,
    top = 22,
    bottom = 40,
    plotW = width - left - right,
    plotH = height - top - bottom,
    biggest = Math.max(...shown.map((c) => c.total));
  const xs = shown.map((c) => c.completion!),
    ys = shown.map((c) => c.average ?? 0);
  // Axes fit the data (in steps of 5) so nearby cities spread apart.
  const range = (values: number[]) => {
    let lo = Math.max(0, Math.floor((Math.min(...values) - 6) / 5) * 5),
      hi = Math.min(100, Math.ceil((Math.max(...values) + 6) / 5) * 5);
    if (hi - lo < 20) [lo, hi] = [Math.max(0, hi - 20), Math.max(hi, 20)];
    return [lo, hi] as const;
  };
  const [xMin, xMax] = range(xs),
    [yMin, yMax] = range(ys);
  const X = (v: number) => left + ((v - xMin) / (xMax - xMin)) * plotW,
    Y = (v: number) => top + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const total = shown.reduce((s, c) => s + c.total, 0);
  const meanX = shown.reduce((s, c) => s + c.completion! * c.total, 0) / total,
    meanY = shown.reduce((s, c) => s + (c.average ?? 0) * c.total, 0) / total;
  // Labels go above, below, then beside each bubble, wherever they do not collide.
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const labels = [...shown]
    .sort((a, b) => b.total - a.total)
    .map((c) => {
      const cx = X(c.completion!),
        cy = Y(c.average ?? 0),
        r = 5 + 16 * Math.sqrt(c.total / biggest),
        w = c.city.length * 6.6 + 4;
      const spots = [
        { x: cx, y: cy - r - 5, anchor: 'middle' },
        { x: cx, y: cy + r + 13, anchor: 'middle' },
        { x: cx + r + 4, y: cy + 4, anchor: 'start' },
        { x: cx - r - 4, y: cy + 4, anchor: 'end' },
      ] as const;
      const spot = spots.find((s) => {
        const x0 = s.anchor === 'middle' ? s.x - w / 2 : s.anchor === 'start' ? s.x : s.x - w;
        const box = { x0, x1: x0 + w, y0: s.y - 11, y1: s.y + 2 };
        if (box.x0 < 0 || box.x1 > width || box.y0 < 0) return false;
        if (placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0))
          return false;
        placed.push(box);
        return true;
      });
      return { city: c.city, spot };
    });
  return (
    <div ref={ref} className="analytics-plot">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="المدن حسب نسبة الإكمال ومتوسط الدرجة"
      >
        {[xMin, xMax].map((v) => (
          <text key={`x${v}`} x={X(v)} y={top + plotH + 16} textAnchor="middle">
            {number(v)}٪
          </text>
        ))}
        {[yMin, yMax].map((v) => (
          <g key={`y${v}`}>
            <line className="analytics-gridline" x1={left} x2={width - right} y1={Y(v)} y2={Y(v)} />
            <text x={left - 6} y={Y(v) + 4} textAnchor="end">
              {number(v)}٪
            </text>
          </g>
        ))}
        <line className="insight-mean" x1={X(meanX)} x2={X(meanX)} y1={top} y2={top + plotH} />
        <line className="insight-mean" x1={left} x2={width - right} y1={Y(meanY)} y2={Y(meanY)} />
        {[...shown]
          .sort((a, b) => b.total - a.total)
          .map((c) => (
            <circle
              key={c.city}
              className="insight-bubble"
              cx={X(c.completion!)}
              cy={Y(c.average ?? 0)}
              r={5 + 16 * Math.sqrt(c.total / biggest)}
            >
              <title>{`${c.city}: ${number(c.total)} مسجل · إكمال ${pct(c.completion)} · متوسط ${pct(c.average)}`}</title>
            </circle>
          ))}
        {labels.map(
          ({ city, spot }) =>
            spot && (
              <text
                key={city}
                x={spot.x}
                y={spot.y}
                textAnchor={spot.anchor}
                className="insight-bubble-label"
              >
                {city}
              </text>
            ),
        )}
        <text x={left + plotW / 2} y={height - 4} textAnchor="middle">
          نسبة الإكمال
        </text>
        <text x={left} y={top - 4} textAnchor="start">
          متوسط الدرجة
        </text>
      </svg>
    </div>
  );
}
function CityNote({ cities }: { cities: ReturnType<typeof cityPerformance> }) {
  const shown = cities.filter((c) => !c.small && c.completion !== null);
  const hidden = cities.filter((c) => c.small).length;
  if (!shown.length) return null;
  const best = [...shown].sort(
    (a, b) => (b.completion ?? 0) + (b.average ?? 0) - ((a.completion ?? 0) + (a.average ?? 0)),
  )[0];
  return (
    <>
      الخطان المتقطعان هما المتوسط العام. الأعلى إكمالًا ودرجةً معًا: {best.city} (
      {pct(best.completion)} إكمال، {pct(best.average)} متوسط).
      {hidden ? ` ${number(hidden)} مدن فيها أقل من ٥ مسجلين لا تظهر.` : ''}
    </>
  );
}

const verdictText: Record<string, string> = {
  ok: 'سليم',
  review: 'يُراجع',
  hard: 'صعب جدًا',
  easy: 'سهل جدًا',
  small: 'عدد قليل',
};
function ItemHealth({ items }: { items: ItemStat[] }) {
  const { ref, width } = useWidth();
  const height = 240,
    left = 40,
    right = 12,
    top = 12,
    bottom = 40,
    plotW = width - left - right,
    plotH = height - top - bottom;
  const lo = Math.min(-0.2, ...items.map((i) => i.discrimination ?? 0)),
    hi = Math.max(0.8, ...items.map((i) => i.discrimination ?? 0));
  const X = (v: number) => left + (v / 100) * plotW,
    Y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * plotH;
  const flagged = items.filter((i) => ['review', 'hard', 'easy'].includes(itemVerdict(i)));
  return (
    <div ref={ref} className="analytics-plot">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="صعوبة كل سؤال وارتباطه بالدرجة"
      >
        <line className="analytics-gridline" x1={left} x2={width - right} y1={Y(0)} y2={Y(0)} />
        <line
          className="insight-floor"
          x1={left}
          x2={width - right}
          y1={Y(DISCRIMINATION_FLOOR)}
          y2={Y(DISCRIMINATION_FLOOR)}
        />
        {[0, 50, 100].map((v) => (
          <text key={v} x={X(v)} y={top + plotH + 16} textAnchor="middle">
            {number(v)}٪
          </text>
        ))}
        <text x={left - 6} y={Y(DISCRIMINATION_FLOOR) + 4} textAnchor="end">
          {number(DISCRIMINATION_FLOOR)}
        </text>
        {items.map((i) => (
          <circle
            key={i.questionId}
            className={`insight-item ${itemVerdict(i)}`}
            cx={X(i.difficulty)}
            cy={Y(i.discrimination ?? 0)}
            r={5}
          >
            <title>{`${i.title}\nنسبة الإجابة الصحيحة ${pct(i.difficulty)} · الارتباط ${i.discrimination === null ? '—' : number(Math.round(i.discrimination * 100) / 100)} · ${verdictText[itemVerdict(i)]}`}</title>
          </circle>
        ))}
        <text x={left + plotW / 2} y={height - 4} textAnchor="middle">
          نسبة من أجاب إجابة صحيحة
        </text>
        <text x={left} y={top - 2} textAnchor="start">
          الارتباط بالدرجة
        </text>
      </svg>
      {flagged.length > 0 && (
        <details className="analytics-chart-data" open={flagged.length <= 4}>
          <summary>أسئلة تحتاج مراجعة ({number(flagged.length)})</summary>
          <ul className="insight-items">
            {flagged.map((i) => (
              <li key={i.questionId}>
                <span className={`insight-verdict ${itemVerdict(i)}`}>
                  {verdictText[itemVerdict(i)]}
                </span>
                <span>{i.title}</span>
                <bdi>{pct(i.difficulty)}</bdi>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ReadingScatter({ points }: { points: { id: string; x: number; y: number }[] }) {
  const { ref, width } = useWidth();
  const height = 240,
    left = 40,
    right = 12,
    top = 12,
    bottom = 40,
    plotW = width - left - right,
    plotH = height - top - bottom,
    xMax = Math.max(5, Math.ceil(Math.max(...points.map((p) => p.x)) / 5) * 5);
  const X = (v: number) => left + (v / xMax) * plotW,
    Y = (v: number) => top + (1 - v / 100) * plotH;
  return (
    <div ref={ref} className="analytics-plot">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="وقت القراءة مقابل الدرجة"
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line className="analytics-gridline" x1={left} x2={width - right} y1={Y(v)} y2={Y(v)} />
            <text x={left - 6} y={Y(v) + 4} textAnchor="end">
              {number(v)}٪
            </text>
          </g>
        ))}
        {[0, xMax / 2, xMax].map((v) => (
          <text key={v} x={X(v)} y={top + plotH + 16} textAnchor="middle">
            {number(Math.round(v))}
          </text>
        ))}
        {points.map((p) => (
          <circle key={p.id} className="insight-dot" cx={X(p.x)} cy={Y(p.y)} r={3.5} />
        ))}
        <text x={left + plotW / 2} y={height - 4} textAnchor="middle">
          دقائق القراءة المحتسبة في الكتاب
        </text>
      </svg>
    </div>
  );
}
function ReadingNote({ r }: { r: number }) {
  const strength = Math.abs(r) < 0.2 ? 'ضعيفة' : Math.abs(r) < 0.5 ? 'متوسطة' : 'قوية';
  return (
    <>
      العلاقة {strength}
      {Math.abs(r) >= 0.2
        ? r > 0
          ? '؛ القراءة الأطول ترتبط بدرجة أعلى.'
          : '؛ القراءة الأطول ترتبط بدرجة أقل.'
        : '.'}
    </>
  );
}

function SourceList({
  sources,
  names,
}: {
  sources: ReturnType<typeof sourceAttribution>;
  names: Record<string, string>;
}) {
  const coded = sources.filter((s) => s.source);
  const max = Math.max(1, ...sources.map((s) => s.total));
  return (
    <>
      {!coded.length && (
        <p className="empty-inline">
          لم يصل أحد عبر رابط منشور بعد. أضف ‎?ref=رمز‎ لروابط المنشورات، مثل ‎?ref=x-launch‎.
        </p>
      )}
      <div className="analytics-count-bars">
        {sources.map((s) => (
          <div className="analytics-count-row" key={s.source || 'direct'}>
            <div>
              <span>
                {s.source ? (
                  names[s.source] ? (
                    <>
                      {names[s.source]} <bdi dir="ltr">{s.source}</bdi>
                    </>
                  ) : (
                    <bdi dir="ltr">{s.source}</bdi>
                  )
                ) : (
                  'دخول مباشر'
                )}
                <small>{s.completion === null ? 'إكمال —' : `إكمال ${pct(s.completion)}`}</small>
              </span>
              <bdi>{count(s.total)}</bdi>
            </div>
            <div className="chart-track">
              <span style={{ width: `${(s.total / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Matrix({ matrix }: { matrix: ReturnType<typeof stageCityMatrix> }) {
  if (!matrix.cities.length) return <p className="empty-inline">لا توجد بيانات مطابقة.</p>;
  return (
    <div className="table-scroll">
      <table className="insight-matrix">
        <thead>
          <tr>
            <th>المدينة</th>
            {stageList.map((s) => (
              <th key={s}>{s.replace('المرحلة ', '')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.cities.map((city, i) => (
            <tr key={city}>
              <th scope="row">{city}</th>
              {matrix.cells[i].map((cell, j) => (
                <td
                  key={j}
                  style={{ ['--rate' as string]: cell.rate === null ? 0 : cell.rate / 100 }}
                  data-small={cell.small || undefined}
                  title={`${city} · ${stageList[j]}: ${count(cell.total)} مسجل`}
                >
                  {cell.total === 0 ? '—' : cell.small ? '<٥' : pct(Math.round(cell.rate!))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OtpHealth({ hours, now }: { hours: InsightsData['otp']['hours']; now: number }) {
  const { ref, width } = useWidth();
  const end = Math.floor(now / 3600_000) * 3600_000;
  const slots = Array.from({ length: 24 }, (_, i) => {
    const t = end - (23 - i) * 3600_000;
    const h = hours.find((x) => Date.parse(x.hour) === t);
    return { t, sent: h?.sent ?? 0, failed: h?.failed ?? 0 };
  });
  const sent = slots.reduce((s, x) => s + x.sent, 0),
    failed = slots.reduce((s, x) => s + x.failed, 0);
  const height = 150,
    left = 34,
    top = 10,
    bottom = 30,
    plotW = width - left - 8,
    plotH = height - top - bottom,
    slot = plotW / 24;
  const hour = (t: number) =>
    new Intl.DateTimeFormat('ar-SA', { hour: 'numeric', timeZone: 'Asia/Riyadh' }).format(t);
  if (!sent) return <p className="empty-inline">لا توجد طلبات رموز في آخر ٢٤ ساعة.</p>;
  return (
    <div ref={ref} className="analytics-plot">
      <p className="insight-otp-total">
        {number(sent)} طلب رمز · {number(failed)} فشل ({pct((failed / sent) * 100)})
      </p>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="نسبة فشل رسائل التحقق لكل ساعة"
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line
              className="analytics-gridline"
              x1={left}
              x2={width - 8}
              y1={top + plotH * (1 - v / 100)}
              y2={top + plotH * (1 - v / 100)}
            />
            <text x={left - 6} y={top + plotH * (1 - v / 100) + 4} textAnchor="end">
              {number(v)}٪
            </text>
          </g>
        ))}
        {slots.map((s, i) => {
          const rate = s.sent ? s.failed / s.sent : 0,
            h = rate * plotH;
          return (
            <g key={s.t}>
              <rect
                className={rate > 0.1 ? 'insight-mark-bad' : 'analytics-primary-mark'}
                x={left + slot * i + 1}
                y={top + plotH - Math.max(h, s.sent ? 1.5 : 0)}
                width={Math.max(1, slot - 2)}
                height={Math.max(h, s.sent ? 1.5 : 0)}
              >
                <title>{`${hour(s.t)}: ${number(s.sent)} طلب · ${number(s.failed)} فشل`}</title>
              </rect>
              {i % 6 === 0 && (
                <text x={left + slot * i + slot / 2} y={height - 8} textAnchor="middle">
                  {hour(s.t)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const gapLabels: Record<string, string> = {
  unreached: 'لم يصل',
  'too-fast': 'مرّ سريعًا',
  skipped: 'تجاوز الصفحة',
};
function GuidancePanel({
  data,
  live,
  stageKey,
  stageName,
}: {
  data: InsightsData['guidance'];
  live: boolean;
  stageKey: string;
  stageName: string;
}) {
  const [source, setSource] = useState<'participants' | 'tests'>('participants');
  const summary = summarizeGuidance(data?.[source], stageKey);
  return (
    <Panel
      wide
      title="الإرشاد إلى صفحة الإجابة"
      subtitle={`كل مرة نقل فيها الاختبار كتاب الطالب إلى موضع الإجابة · ${stageName}`}
      foot="كثرة الإرشاد في سؤال تعني أن موضعه في الكتاب غير واضح للطلاب، أو أن نصه يحتاج مراجعة. وكثرته عند مشارك ملاحظة للمراجعة، وليست حكمًا عليه."
    >
      {!live ? (
        <ServerOnly />
      ) : !data ? null : (
        <div className="guidance-panel">
          <div className="insight-stage" role="group" aria-label="مصدر البيانات">
            {(
              [
                ['participants', 'المشاركون'],
                ['tests', 'تجارب الإدارة'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={source === value}
                onClick={() => setSource(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <dl className="guidance-stats">
            <div>
              <dt>مرات الإرشاد</dt>
              <dd>{number(summary.events)}</dd>
            </div>
            <div>
              <dt>محاولات احتاجت إرشادًا</dt>
              <dd>
                {number(summary.guided)} <small>من {number(summary.started)}</small>
              </dd>
            </div>
            <div>
              <dt>متوسط الإرشاد للمحاولة</dt>
              <dd>{summary.guided ? number(Math.round(summary.perAttempt * 10) / 10) : '—'}</dd>
            </div>
          </dl>
          {!summary.events ? (
            <p className="empty-inline">لم يحتج أحد إلى الإرشاد في هذه المرحلة بعد.</p>
          ) : (
            <div className="guidance-tables">
              <div className="table-scroll">
                <table>
                  <caption>الأسئلة الأكثر إرشادًا</caption>
                  <thead>
                    <tr>
                      <th>السؤال</th>
                      <th>المرات</th>
                      <th>المحاولات</th>
                      <th>السبب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.questions.slice(0, 10).map((q) => (
                      <tr key={q.questionId}>
                        <td title={q.title}>
                          {q.title.length > 70
                            ? `${q.title.slice(0, 70)}…`
                            : q.title || q.questionId}
                        </td>
                        <td>{number(q.events)}</td>
                        <td>{number(q.attempts)}</td>
                        <td className="guidance-gaps">
                          {Object.entries(q.gaps)
                            .sort((a, b) => b[1] - a[1])
                            .map(([gap, n]) => `${gapLabels[gap] ?? gap} ${number(n)}`)
                            .join(' · ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-scroll">
                <table>
                  <caption>أكثر من اعتمد على الإرشاد</caption>
                  <thead>
                    <tr>
                      <th>رقم المشارك</th>
                      <th>المدينة</th>
                      <th>المرات</th>
                      <th>الأسئلة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.people.slice(0, 10).map((p) => (
                      <tr key={p.attemptId}>
                        <td>
                          <bdi dir="ltr">{p.label}</bdi>
                        </td>
                        <td>{p.city || '—'}</td>
                        <td>{number(p.events)}</td>
                        <td>{number(p.questions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
