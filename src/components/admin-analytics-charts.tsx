'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  completionMinutes,
  durationDistribution,
  groupParticipants,
  institutionParticipation,
  participationStatus,
  readingObservations,
  registrationTimeline,
  scoreDistribution,
  scorePercentage,
  type AnalyticsParticipant,
} from '@/lib/analytics';
import { stages } from '@/lib/content';
import { CityParticipationMap } from './city-participation-map';
import type { ChartKind } from '@/lib/media/charts';
import { Icon } from './ui';

const number = (value: number) => value.toLocaleString('ar-SA', { maximumFractionDigits: 1 });
const percentage = (value: number) => `${number(value)}٪`;
const states = [
  { key: 'completed', label: 'مكتملة' },
  { key: 'started', label: 'قيد المشاركة' },
  { key: 'new', label: 'لم تبدأ' },
] as const;
type Bucket = { label: string; count: number };
export type PosterHook = { enabled: boolean; make: (chart: ChartKind) => void };

export function MakePoster({ poster, chart }: { poster?: PosterHook; chart: ChartKind }) {
  if (!poster) return null;
  return (
    <button
      type="button"
      className="make-poster"
      disabled={!poster.enabled}
      title={
        poster.enabled
          ? 'افتح هذا الرسم منشورًا في المركز الإعلامي'
          : 'متاح لبيانات المسابقة الفعلية فقط'
      }
      onClick={() => poster.make(chart)}
    >
      <Icon name="image" size={14} /> اصنع منشورًا
    </button>
  );
}

function ChartPanel({
  title,
  subtitle,
  children,
  className = '',
  poster,
  chart,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  className?: string;
  poster?: PosterHook;
  chart?: ChartKind;
}) {
  return (
    <section className={`panel analytics-visual ${className}`}>
      <div className="panel-heading">
        <h2>{title}</h2>
        <span>{subtitle}</span>
        {chart && <MakePoster poster={poster} chart={chart} />}
      </div>
      <div className="analytics-visual-body">{children}</div>
    </section>
  );
}

function useChartWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(200, Math.floor(entry.contentRect.width))),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

function Histogram({
  buckets,
  title,
  unit,
  empty,
}: {
  buckets: Bucket[];
  title: string;
  unit: string;
  empty: string;
}) {
  const { ref, width } = useChartWidth();
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const height = 236,
    left = 44,
    top = 22,
    bottom = 66,
    plotHeight = height - top - bottom;
  const plotWidth = width - left - 12,
    slot = plotWidth / buckets.length,
    ceiling = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return (
    <div ref={ref} className="analytics-plot">
      {!total ? (
        <p className="empty-inline">{empty}</p>
      ) : (
        <>
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={title}
          >
            <title>{title}</title>
            {[0, ceiling].map((value) => (
              <g key={value}>
                <line
                  className="analytics-gridline"
                  x1={left}
                  x2={width - 12}
                  y1={top + plotHeight * (1 - value / ceiling)}
                  y2={top + plotHeight * (1 - value / ceiling)}
                />
                <text
                  x={left - 7}
                  y={top + plotHeight * (1 - value / ceiling) + 4}
                  textAnchor="end"
                >
                  {number(value)}
                </text>
              </g>
            ))}
            {buckets.map((bucket, i) => {
              const x = left + slot * i + 2,
                y = top + plotHeight * (1 - bucket.count / ceiling);
              return (
                <g key={bucket.label}>
                  <rect
                    className="analytics-primary-mark"
                    x={x}
                    y={y}
                    width={Math.max(1, slot - 4)}
                    height={top + plotHeight - y}
                  >
                    <title>{`${bucket.label}: ${number(bucket.count)} مشاركة`}</title>
                  </rect>
                  <text x={x + (slot - 4) / 2} y={y - 6} textAnchor="middle">
                    {number(bucket.count)}
                  </text>
                  <text x={x + (slot - 4) / 2} y={top + plotHeight + 22} textAnchor="middle">
                    {width < 360 ? String(i + 1) : bucket.label}
                  </text>
                </g>
              );
            })}
            <text x={left} y={13} textAnchor="start">
              عدد المكتملين
            </text>
            <text x={left + plotWidth / 2} y={height - 9} textAnchor="middle">
              {unit}
            </text>
          </svg>
          <div className="analytics-bin-legend">
            {buckets.map((bucket, i) => (
              <span key={bucket.label}>
                {width < 360 ? `${i + 1}. ` : ''}
                {bucket.label}: <bdi>{number(bucket.count)}</bdi>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GenderDonut({ people }: { people: AnalyticsParticipant[] }) {
  const groups = groupParticipants(people, 'gender');
  let offset = 0;
  return !people.length ? (
    <p className="empty-inline">لا توجد بيانات مطابقة.</p>
  ) : (
    <div className="analytics-donut-layout">
      <svg
        viewBox="0 0 180 180"
        className="analytics-donut"
        role="img"
        aria-label="حصة كل جنس من المسجلين"
      >
        <title>توزيع الجنس ضمن المرشحات الحالية</title>
        <circle className="analytics-donut-track" cx="90" cy="90" r="65" />
        {groups.map((group, i) => {
          const share = (group.total / people.length) * 100,
            start = offset;
          offset += share;
          const category =
            group.label === 'ذكر' ? 'male' : group.label === 'أنثى' ? 'female' : 'unknown';
          return (
            <circle
              key={group.label}
              className={`analytics-donut-segment ${category}`}
              cx="90"
              cy="90"
              r="65"
              pathLength="100"
              strokeDasharray={`${share} ${100 - share}`}
              strokeDashoffset={-start}
              transform="rotate(-90 90 90)"
            >
              <title>{`${group.label}: ${number(group.total)} · ${percentage(share)}`}</title>
            </circle>
          );
        })}
        <text x="90" y="95" textAnchor="middle">
          {number(people.length)}
        </text>
      </svg>
      <ul className="analytics-legend-list">
        {groups.map((group) => (
          <li key={group.label}>
            <span
              className={`analytics-legend-dot ${group.label === 'ذكر' ? 'male' : group.label === 'أنثى' ? 'female' : 'unknown'}`}
            />
            {group.label}
            <strong>
              <bdi>{number(group.total)}</bdi> · {percentage((group.total / people.length) * 100)}
            </strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StageCompletion({ people }: { people: AnalyticsParticipant[] }) {
  return (
    <>
      <div className="analytics-chart-legend">
        {states.map((state) => (
          <span key={state.key}>
            <i className={`analytics-legend-dot ${state.key}`} />
            {state.label}
          </span>
        ))}
      </div>
      {stages.map((stage) => {
        const rows = people.filter((p) => p.stage === stage);
        const counts = states.map((state) => ({
          ...state,
          count: rows.filter((p) => participationStatus(p) === state.key).length,
        }));
        return (
          <div className="analytics-stage-row" key={stage}>
            <div>
              <span>{stage}</span>
              <span>
                <bdi>{number(rows.length)}</bdi> مسجل ·{' '}
                {rows.length ? percentage((counts[0].count / rows.length) * 100) : '—'} إكمال
              </span>
            </div>
            <div
              className="analytics-stacked-track"
              aria-label={counts.map((state) => `${state.label}: ${state.count}`).join('، ')}
            >
              {counts.map((state) => (
                <span
                  key={state.key}
                  className={state.key}
                  style={{ width: `${rows.length ? (state.count / rows.length) * 100 : 0}%` }}
                  title={`${state.label}: ${number(state.count)}`}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function RegistrationTrend({ people }: { people: AnalyticsParticipant[] }) {
  const { ref, width } = useChartWidth();
  const points = registrationTimeline(people);
  const height = 228,
    left = 48,
    top = 28,
    bottom = 58,
    plotWidth = width - left - 15,
    plotHeight = height - top - bottom;
  const first = points[0]?.day,
    last = points.at(-1)?.day;
  const start = first ? Date.parse(first) : 0,
    span = last ? Date.parse(last) - start : 0;
  const ceiling = Math.max(1, points.at(-1)?.cumulative ?? 0);
  const plotted = points.map((point) => ({
    ...point,
    x: left + (span ? ((Date.parse(point.day) - start) / span) * plotWidth : plotWidth / 2),
    y: top + (1 - point.cumulative / ceiling) * plotHeight,
  }));
  const dateLabel = (day: string) =>
    new Intl.DateTimeFormat('ar-SA', {
      day: 'numeric',
      month: 'short',
      calendar: 'gregory',
      timeZone: 'Asia/Riyadh',
    }).format(new Date(day));
  return (
    <div ref={ref} className="analytics-plot">
      {!points.length ? (
        <p className="empty-inline">لا توجد تسجيلات مطابقة.</p>
      ) : (
        <>
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="التسجيل التراكمي للمجموعة المختارة"
          >
            <title>تراكم التسجيل حسب تاريخ التسجيل بتوقيت المملكة</title>
            {[0, ceiling].map((value) => (
              <g key={value}>
                <line
                  className="analytics-gridline"
                  x1={left}
                  x2={width - 15}
                  y1={top + plotHeight * (1 - value / ceiling)}
                  y2={top + plotHeight * (1 - value / ceiling)}
                />
                <text
                  x={left - 8}
                  y={top + plotHeight * (1 - value / ceiling) + 4}
                  textAnchor="end"
                >
                  {number(value)}
                </text>
              </g>
            ))}
            <path
              className="analytics-trend-line"
              d={plotted.map((point, i) => `${i ? 'L' : 'M'}${point.x},${point.y}`).join(' ')}
            />
            {plotted.map((point) => (
              <g key={point.day}>
                <circle className="analytics-primary-mark" cx={point.x} cy={point.y} r="3" />
                <circle fill="transparent" cx={point.x} cy={point.y} r="16">
                  <title>{`${dateLabel(point.day)} · ${number(point.count)} تسجيل جديد · ${number(point.cumulative)} تراكميًا`}</title>
                </circle>
              </g>
            ))}
            <text x={left} y={top + plotHeight + 24} textAnchor="start">
              {dateLabel(first!)}
            </text>
            {last !== first && (
              <text x={width - 15} y={top + plotHeight + 24} textAnchor="end">
                {dateLabel(last!)}
              </text>
            )}
            <text x={left} y={14} textAnchor="start">
              المسجلون تراكميًا
            </text>
            <text x={left + plotWidth / 2} y={height - 6} textAnchor="middle">
              تاريخ التسجيل · بتوقيت المملكة
            </text>
          </svg>
          <details className="analytics-chart-data">
            <summary>بيانات التسجيل اليومية</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>اليوم</th>
                    <th>التسجيلات</th>
                    <th>التراكمي</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.day}>
                      <td>{dateLabel(point.day)}</td>
                      <td>{point.count}</td>
                      <td>{point.cumulative}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function CountBars({
  rows,
  unit,
}: {
  rows: { label: string; count: number; secondary?: string }[];
  unit: string;
}) {
  const maximum = Math.max(1, ...rows.map((row) => row.count));
  return !rows.length ? (
    <p className="empty-inline">لا توجد بيانات مطابقة.</p>
  ) : (
    <div className="analytics-count-bars">
      {rows.map((row) => (
        <div className="analytics-count-row" key={row.label + (row.secondary ?? '')}>
          <div>
            <span>
              {row.label}
              {row.secondary && <small>{row.secondary}</small>}
            </span>
            <bdi>
              {number(row.count)} {unit}
            </bdi>
          </div>
          <div className="chart-track" aria-label={`${row.label}: ${row.count} ${unit}`}>
            <span style={{ width: `${(row.count / maximum) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminAnalyticsCharts({
  people,
  city,
  onCityChange,
  stage,
  onStageChange,
  poster,
}: {
  people: AnalyticsParticipant[];
  city: string;
  onCityChange: (value: string) => void;
  stage: string;
  onStageChange: (value: string) => void;
  poster?: PosterHook;
}) {
  const schools = institutionParticipation(people);
  const timed = people.filter((p) => completionMinutes(p) !== null).length;
  const attempts = people.filter((p) => p.attempt_id).length;
  return (
    <>
      <div className="analytics-visual-grid">
        <ChartPanel
          title="المشاركة حسب المدينة"
          subtitle="عدد المسجلين · ترتيب تنازلي"
          poster={poster}
          chart="cities"
        >
          <CountBars
            rows={groupParticipants(people, 'locality').map((group) => ({
              label: group.label,
              count: group.total,
            }))}
            unit="مسجل"
          />
        </ChartPanel>
        <ChartPanel
          title="الإكمال حسب المرحلة"
          subtitle="نسبة من مسجّلي كل مرحلة"
          poster={poster}
          chart="stages"
        >
          <StageCompletion people={people} />
        </ChartPanel>
        <ChartPanel
          title="توزيع الذكور والإناث"
          subtitle="حصة من المجموعة المختارة"
          poster={poster}
          chart="gender"
        >
          <GenderDonut people={people} />
        </ChartPanel>
        <ChartPanel
          title="توزيع الدرجات"
          subtitle={`${number(people.filter((p) => scorePercentage(p) !== null).length)} مشاركة مكتملة`}
          poster={poster}
          chart="scores"
        >
          <Histogram
            buckets={scoreDistribution(people)}
            title="توزيع نسب الدرجات"
            unit="الدرجة من 100٪"
            empty="تظهر الدرجات بعد إرسال أول مشاركة مطابقة."
          />
        </ChartPanel>
        <ChartPanel
          title="تراكم التسجيل مع الوقت"
          subtitle="حسب تاريخ التسجيل · المجموعة المختارة"
          poster={poster}
          chart="trend"
        >
          <RegistrationTrend people={people} />
        </ChartPanel>
        <ChartPanel
          title="توزيع وقت الإكمال"
          subtitle={`${number(timed)} مشاركة ذات توقيت صالح`}
          poster={poster}
          chart="duration"
        >
          <Histogram
            buckets={durationDistribution(people)}
            title="توزيع مدة الإكمال بالدقائق"
            unit="مدة الإكمال بالدقائق"
            empty="لا توجد مشاركات مكتملة لها وقت بدء وإرسال صالحان."
          />
          <p className="fine-print">
            المدة من بدء المحاولة إلى الإرسال، وتشمل التوقف. لا تُستخدم لحسم التعادل.
          </p>
        </ChartPanel>
      </div>
      <ChartPanel
        title="الخريطة الحرارية للمشاركة"
        subtitle="عدد المسجلين حسب المدينة / المحافظة"
        className="analytics-map-panel"
        poster={poster}
        chart="map"
      >
        <CityParticipationMap people={people} selectedCity={city} onSelect={onCityChange} />
      </ChartPanel>
      <div className="analytics-visual-grid">
        <ChartPanel
          title="مشاركة المدارس والجامعات"
          subtitle={`${number(schools.length)} جهة تعليمية مسجلة`}
          poster={poster}
          chart="schools"
        >
          <label className="analytics-school-filter">
            مرحلة الجهات التعليمية
            <select
              aria-label="مرحلة الجهات التعليمية"
              value={stage}
              onChange={(event) => onStageChange(event.target.value)}
            >
              <option value="">الكل</option>
              {stages.map((stage) => (
                <option key={stage}>{stage}</option>
              ))}
            </select>
          </label>
          <CountBars
            rows={schools.slice(0, 10).map((school) => ({
              label: school.label,
              count: school.total,
              secondary: `${school.city} · ${school.completed} مكتمل`,
            }))}
            unit="مسجل"
          />
          <p className="fine-print">
            أعلى 10 جهات ضمن المرشحات. {number(people.filter((p) => !p.institution?.trim()).length)}{' '}
            سجلًا بلا اسم جهة تعليمية. تُجمع الأسماء المتطابقة داخل المدينة نفسها.
          </p>
          <details className="analytics-chart-data">
            <summary>عرض جميع الجهات التعليمية</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>الجهة</th>
                    <th>المدينة</th>
                    <th>المسجلون</th>
                    <th>المكتملون</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.map((school) => (
                    <tr key={school.label + school.city}>
                      <td>{school.label}</td>
                      <td>{school.city}</td>
                      <td>{school.total}</td>
                      <td>{school.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </ChartPanel>
        <ChartPanel title="ملاحظات التصفح" subtitle={`${number(attempts)} محاولة بدأت · للجنة فقط`}>
          <CountBars rows={readingObservations(people)} unit="محاولة" />
          <p className="fine-print">
            قد تظهر المحاولة في أكثر من فئة. هذه ملاحظات للمراجعة وليست حكمًا على المشارك. تجارب
            الإدارة لا تدخل في هذه الأرقام.
          </p>
        </ChartPanel>
      </div>
    </>
  );
}
