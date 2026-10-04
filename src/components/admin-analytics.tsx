'use client';
import { useState } from 'react';
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

export function AdminAnalytics({ people }: { people: AnalyticsParticipant[] }) {
  const [filters, setFilters] = useState<AnalyticsFilters>(emptyFilters);
  const [dimension, setDimension] = useState<Dimension>('institution');
  const [compare, setCompare] = useState<Dimension>('gender');
  const update = (key: keyof AnalyticsFilters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const rows = filterParticipants(people, filters);
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
  const bands = [
    { min: 0, max: 50, label: 'أقل من 50٪' },
    { min: 50, max: 70, label: '50 إلى أقل من 70٪' },
    { min: 70, max: 90, label: '70 إلى أقل من 90٪' },
    { min: 90, max: 101, label: '90 إلى 100٪' },
  ];
  function Distribution({ field, title }: { field: Dimension; title: string }) {
    return (
      <section className="panel analytics-distribution">
        <div className="panel-heading">
          <h2>{title}</h2>
          <span>{rows.length} مشاركًا</span>
        </div>
        {groupParticipants(rows, field).map((group) => (
          <div className="analytics-bar-row" key={group.label}>
            <div>
              <span>{group.label}</span>
              <strong>
                {group.total}{' '}
                <small>({percent(rows.length ? (group.total / rows.length) * 100 : 0)})</small>
              </strong>
            </div>
            <div className="chart-track">
              <span style={{ width: `${rows.length ? (group.total / rows.length) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
        {!rows.length && <p className="empty-inline">لا توجد بيانات مطابقة.</p>}
      </section>
    );
  }
  return (
    <>
      <section className="panel analytics-filter-panel" aria-label="مرشحات التحليلات">
        <div className="panel-heading">
          <h2>حدد مجموعة المشاركين</h2>
          <button className="text-link" onClick={() => setFilters(emptyFilters)}>
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
                    people.map((p) =>
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
          الميلادية بتوقيت المملكة. مرشحات الدرجة تشمل المشاركات المكتملة فقط.
        </p>
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
          <span>مشاركون مطابقون</span>
        </div>
        <div>
          <strong>{percent(stats.total ? (stats.completed / stats.total) * 100 : null)}</strong>
          <span>نسبة الإكمال · {stats.completed} مشاركة</span>
        </div>
        <div>
          <strong>{percent(stats.average)}</strong>
          <span>متوسط درجات المكتملين</span>
        </div>
        <div>
          <strong>{stats.institutions}</strong>
          <span>مدارس وجامعات مسجلة</span>
        </div>
        <a href={exportUrl} className="button primary">
          <Icon name="download" size={18} /> تصدير المجموعة CSV
        </a>
      </div>
      <div className="dashboard-grid">
        <Distribution field="gender" title="توزيع الذكور والإناث" />
        <section className="panel analytics-scores">
          <div className="panel-heading">
            <h2>توزيع نسب الدرجات</h2>
            <span>{stats.completed} مشاركة مكتملة</span>
          </div>
          {bands.map(({ min, max, label }) => {
            const count = rows.filter((p) => {
              const value = scorePercentage(p);
              return value !== null && value >= min && value < max;
            }).length;
            return (
              <div className="analytics-bar-row" key={min}>
                <div>
                  <span>{label}</span>
                  <strong>
                    {count}{' '}
                    <small>
                      ({percent(stats.completed ? (count / stats.completed) * 100 : 0)})
                    </small>
                  </strong>
                </div>
                <div className="chart-track">
                  <span
                    style={{ width: `${stats.completed ? (count / stats.completed) * 100 : 0}%` }}
                  />
                </div>
              </div>
            );
          })}
          <p className="fine-print">
            النسبة = الدرجة ÷ عدد أسئلة محاولة المشارك. المشاركات غير المكتملة لا تدخل في متوسط
            الدرجات.
          </p>
        </section>
      </div>
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
