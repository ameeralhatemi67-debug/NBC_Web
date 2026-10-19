'use client';
import { useMemo, useState } from 'react';
import {
  emptyFilters,
  filterParticipants,
  groupParticipants,
  participationStatus,
  registrationYear,
  scorePercentage,
  summarize,
  type AnalyticsFilters,
  type AnalyticsParticipant,
} from '@/lib/analytics';
import { Icon } from './ui';
import { AdminAnalyticsCharts } from './admin-analytics-charts';
import { AdminAnalyticsInsights } from './admin-analytics-insights';
import { stages } from '@/lib/content';
import { registrationDay } from '@/lib/analytics';
import type { ChartKind, PosterRequest } from '@/lib/media/charts';

const percent = (n: number | null) =>
  n === null ? '—' : `${n.toLocaleString('ar-SA', { maximumFractionDigits: 1 })}٪`;
const statuses: Record<string, string> = {
  completed: 'مكتملة',
  started: 'قيد المشاركة',
  new: 'لم تبدأ',
};
const dimensions = {
  gender: 'الجنس',
  institution: 'المدرسة / الجامعة',
  stage: 'المرحلة',
  locality: 'المدينة / المحافظة',
  region: 'المنطقة',
  year: 'سنة التسجيل',
};
type Dimension = keyof typeof dimensions;

export function AdminAnalytics({
  people,
  exportEnabled = true,
  onMakePoster,
}: {
  people: AnalyticsParticipant[];
  exportEnabled?: boolean;
  onMakePoster?: (request: PosterRequest) => void;
}) {
  const [filters, setFilters] = useState<AnalyticsFilters>(emptyFilters);
  const [dimension, setDimension] = useState<Dimension>('institution');
  const [compare, setCompare] = useState<Dimension>('gender');
  const [period, setPeriod] = useState('');
  function changePeriod(value: string) {
    setPeriod(value);
    const today = registrationDay(new Date().toISOString());
    const first = value
      ? new Date(Date.parse(today) - (Number(value) - 1) * 86400000).toISOString()
      : '';
    setFilters((f) => ({
      ...f,
      fromDate: first ? registrationDay(first) : '',
      toDate: value ? today : '',
    }));
  }
  const update = (key: keyof AnalyticsFilters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const rows = useMemo(() => filterParticipants(people, filters), [people, filters]);
  const stats = summarize(rows);
  const groups = groupParticipants(rows, dimension);
  const columns = groupParticipants(rows, compare);
  const crossCounts = new Map<string, number>();
  for (const p of rows) {
    const label = (field: Dimension) =>
      field === 'year' ? registrationYear(p.created_at) : p[field]?.trim() || 'غير مسجل';
    const key = JSON.stringify([label(dimension), label(compare)]);
    crossCounts.set(key, (crossCounts.get(key) || 0) + 1);
  }
  const exportUrl = `/api/export?${new URLSearchParams(filters)}`;
  // The current filters, in words, travel with a chart that becomes a poster.
  const scope = [
    filters.stage,
    filters.region,
    filters.locality,
    filters.gender,
    filters.institution,
    filters.status && statuses[filters.status],
    filters.year,
    (filters.fromDate || filters.toDate) && `${filters.fromDate || '…'} – ${filters.toDate || '…'}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const poster = onMakePoster
    ? {
        enabled: exportEnabled,
        make: (chart: ChartKind) => onMakePoster({ chart, people: rows, scope, at: Date.now() }),
      }
    : undefined;
  return (
    <>
      <section className="panel analytics-filter-panel" aria-label="مرشحات التحليلات">
        <div className="panel-heading">
          <h2>حدد مجموعة المشاركين</h2>
          <button
            className="text-link"
            onClick={() => {
              setFilters(emptyFilters);
              setPeriod('');
            }}
          >
            مسح المرشحات
          </button>
        </div>
        <div className="analytics-filters">
          {(Object.entries(dimensions) as [Dimension, string][]).map(([key, label]) => (
            <label key={key}>
              {label}
              <select
                aria-label={label}
                value={filters[key]}
                onChange={(e) => update(key, e.target.value)}
              >
                <option value="">الكل</option>
                {[
                  ...new Set(
                    key === 'gender'
                      ? ['ذكر', 'أنثى', ...(people.some((p) => !p.gender) ? ['غير مسجل'] : [])]
                      : key === 'stage'
                        ? stages
                        : people.map((p) =>
                            key === 'year' ? registrationYear(p.created_at) : p[key] || 'غير مسجل',
                          ),
                  ),
                ]
                  .sort((a, b) => a.localeCompare(b, 'ar'))
                  .map((value) => (
                    <option key={value}>{value}</option>
                  ))}
              </select>
            </label>
          ))}
          <label>
            حالة المشاركة
            <select
              aria-label="حالة المشاركة"
              value={filters.status}
              onChange={(e) => update('status', e.target.value)}
            >
              <option value="">الكل</option>
              {Object.entries(statuses).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            فترة التسجيل
            <select
              aria-label="فترة التسجيل"
              value={period}
              onChange={(e) => changePeriod(e.target.value)}
            >
              <option value="">الفترة كاملة</option>
              <option value="7">آخر 7 أيام</option>
              <option value="14">آخر 14 يومًا</option>
              <option value="30">آخر 30 يومًا</option>
              <option value="custom" disabled>
                فترة محددة
              </option>
            </select>
          </label>
          <label>
            التسجيل من
            <input
              aria-label="التسجيل من"
              type="date"
              value={filters.fromDate}
              onChange={(e) => {
                update('fromDate', e.target.value);
                setPeriod('custom');
              }}
            />
          </label>
          <label>
            التسجيل إلى
            <input
              aria-label="التسجيل إلى"
              type="date"
              value={filters.toDate}
              onChange={(e) => {
                update('toDate', e.target.value);
                setPeriod('custom');
              }}
            />
          </label>
          <label>
            الدرجة من ٪
            <input
              aria-label="الدرجة من ٪"
              type="number"
              min="0"
              max="100"
              value={filters.minScore}
              onChange={(e) => update('minScore', e.target.value)}
            />
          </label>
          <label>
            الدرجة إلى ٪
            <input
              aria-label="الدرجة إلى ٪"
              type="number"
              min="0"
              max="100"
              value={filters.maxScore}
              onChange={(e) => update('maxScore', e.target.value)}
            />
          </label>
          <label>
            البحث
            <input
              aria-label="البحث"
              value={filters.search}
              onChange={(e) => update('search', e.target.value)}
              placeholder="اسم المشارك أو المؤسسة أو المدينة"
            />
          </label>
        </div>
        <p className="fine-print">
          تعمل المرشحات معًا على جميع الأرقام والرسوم والمقارنات والتصدير. سنة التسجيل هي السنة
          الميلادية بتوقيت المملكة. مرشحات الدرجة تشمل المشاركات المكتملة فقط. نسبة الإكمال محسوبة
          داخل المجموعة المختارة، ومتوسط الوقت من البدء إلى الإرسال ويشمل التوقف.
        </p>
        {filters.fromDate && filters.toDate && filters.fromDate > filters.toDate && (
          <p role="alert" className="error-message">
            تاريخ البداية بعد تاريخ النهاية. صحح الفترة.
          </p>
        )}
        {filters.minScore &&
          filters.maxScore &&
          Number(filters.minScore) > Number(filters.maxScore) && (
            <p role="alert" className="error-message">
              الحد الأدنى للدرجة أعلى من الحد الأقصى.
            </p>
          )}
      </section>
      <div className="report-summary analytics-summary" aria-live="polite">
        <div>
          <strong>{stats.total}</strong>
          <span>المشاركون المسجلون</span>
        </div>
        <div>
          <strong>{stats.completed}</strong>
          <span>
            أكملوا المسابقة · {percent(stats.total ? (stats.completed / stats.total) * 100 : null)}
          </span>
        </div>
        <div>
          <strong>{percent(stats.average)}</strong>
          <span>متوسط درجات المكتملين</span>
        </div>
        <div>
          <strong>
            {stats.averageMinutes === null
              ? '—'
              : `${stats.averageMinutes.toLocaleString('ar-SA', { maximumFractionDigits: 1 })} دقيقة`}
          </strong>
          <span>متوسط وقت الإكمال · {stats.timedCompletions} مشاركة ذات توقيت صالح</span>
        </div>
        <div>
          <strong>{stats.institutions}</strong>
          <span>مدارس وجامعات مسجلة</span>
        </div>
        {exportEnabled ? (
          <a href={exportUrl} className="button primary">
            <Icon name="download" size={18} /> تصدير المجموعة CSV
          </a>
        ) : (
          <span className="fine-print">التصدير متاح للبيانات الفعلية فقط.</span>
        )}
      </div>
      <AdminAnalyticsInsights
        people={rows}
        stage={filters.stage}
        live={exportEnabled}
        poster={poster}
      />
      <AdminAnalyticsCharts
        people={rows}
        city={filters.locality}
        onCityChange={(value) => update('locality', value)}
        stage={filters.stage}
        onStageChange={(value) => update('stage', value)}
        poster={poster}
      />
      <section className="panel analytics-table">
        <div className="analytics-table-heading">
          <h2>مقارنة مجموعات المشاركين</h2>
          <label>
            التجميع حسب
            <select
              aria-label="التجميع حسب"
              value={dimension}
              onChange={(e) => setDimension(e.target.value as Dimension)}
            >
              {Object.entries(dimensions).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{dimensions[dimension]}</th>
                <th>المسجلون</th>
                <th>المكتملون</th>
                <th>نسبة الإكمال</th>
                <th>متوسط الدرجة ٪</th>
                <th>حصة المشاركين</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.label}>
                  <td>{g.label}</td>
                  <td>{g.total}</td>
                  <td>{g.completed}</td>
                  <td>{percent((g.completed / g.total) * 100)}</td>
                  <td>{percent(g.average)}</td>
                  <td>{percent((g.total / stats.total) * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!groups.length && (
            <p className="empty-inline">لا توجد نتائج. غيّر المرشحات أو امسحها.</p>
          )}
        </div>
      </section>
      <section className="panel analytics-table">
        <div className="analytics-table-heading">
          <h2>
            تقاطع {dimensions[dimension]} مع {dimensions[compare]}
          </h2>
          <label>
            المقارنة مع
            <select
              aria-label="المقارنة مع"
              value={compare}
              onChange={(e) => setCompare(e.target.value as Dimension)}
            >
              {Object.entries(dimensions).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{dimensions[dimension]}</th>
                {columns.map((c) => (
                  <th key={c.label}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.label}>
                  <td>{g.label}</td>
                  {columns.map((c) => (
                    <td key={c.label}>
                      {crossCounts.get(JSON.stringify([g.label, c.label])) || 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fine-print">
          عدد المسجلين عند تقاطع البعدين، ضمن المرشحات الحالية. تظهر الحقول المفقودة باسم «غير
          مسجل».
        </p>
      </section>
      <section className="panel analytics-table">
        <div className="panel-heading">
          <h2>تفاصيل المجموعة</h2>
          <span>{rows.length} سجلًا</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>المشارك</th>
                <th>المدرسة / الجامعة</th>
                <th>الجنس</th>
                <th>المدينة</th>
                <th>الحالة</th>
                <th>الدرجة</th>
                <th>النسبة</th>
                <th>سنة التسجيل</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.name}
                    <small>{p.stage}</small>
                  </td>
                  <td>{p.institution || 'غير مسجل'}</td>
                  <td>{p.gender || 'غير مسجل'}</td>
                  <td>{p.locality}</td>
                  <td>{statuses[participationStatus(p)]}</td>
                  <td>
                    <bdi>{p.score === null ? '—' : `${p.score} / ${p.max_score}`}</bdi>
                  </td>
                  <td>{percent(scorePercentage(p))}</td>
                  <td>{registrationYear(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="empty-inline">لا توجد نتائج مطابقة.</p>}
        </div>
      </section>
    </>
  );
}
