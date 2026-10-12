'use client';
import { useEffect, useState } from 'react';
import { stageNames, type Stage } from '@/lib/competition-domain';
import { competitionStateLabels, riyadhDateTime } from '@/lib/format';
import { api, ErrorMessage, Icon, Loading } from './ui';

type Campaign = {
  id: string;
  title: string;
  state: keyof typeof competitionStateLabels;
  opensAt: string | null;
  closesAt: string | null;
  closedAt: string | null;
  current: boolean;
  attempts: number;
  submitted: number;
  winnersPublished: boolean;
};
type Details = {
  competition: { id: string; title: string; state: Campaign['state'] };
  stages: { stage: Stage; started: number; submitted: number; average: number | null }[];
  results: {
    stage: Stage;
    page: number;
    pageSize: number;
    total: number;
    rows: {
      participantNumber: string;
      name: string;
      institution: string | null;
      locality: string;
      score: number;
      maxScore: number;
      percentage: number;
      rank: number;
    }[];
  };
  awards: {
    stage: Stage | null;
    place: number;
    label: string | null;
    participantNumber: string | null;
    name: string | null;
    reason: string | null;
  }[];
  publication: { publishedAt: string; showNames: boolean } | null;
};

// Every campaign stays readable after a new one is created: scores, ranking, winners, CSV.
export function AdminCampaigns() {
  const [list, setList] = useState<Campaign[] | null>(null);
  const [selected, setSelected] = useState('');
  const [stage, setStage] = useState<Stage>('middle');
  const [page, setPage] = useState(1);
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<Campaign[]>('admin/campaigns')
      .then((rows) => {
        setList(rows);
        setSelected((current) => current || rows.find((r) => !r.current)?.id || rows[0]?.id || '');
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    api<Details>(`admin/campaign?id=${encodeURIComponent(selected)}&stage=${stage}&page=${page}`)
      .then((d) => alive && (setDetails(d), setError('')))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [selected, stage, page]);
  if (!list) return error ? <ErrorMessage message={error} /> : <Loading />;
  const pages = details
    ? Math.max(1, Math.ceil(details.results.total / details.results.pageSize))
    : 1;
  return (
    <section className="admin-panel campaigns-admin">
      <ErrorMessage message={error} />
      <ul className="campaign-list">
        {list.map((c) => (
          <li key={c.id} className={c.id === selected ? 'on' : ''}>
            <div>
              <strong>{c.title}</strong>
              <span className="muted">
                {competitionStateLabels[c.state]}
                {c.current && ' · الحالية'}
                {c.winnersPublished && ' · الفائزون معلنون'}
              </span>
              <small>
                {c.submitted} مكتملة من {c.attempts} مشاركة
                {c.closesAt && ` · تغلق ${riyadhDateTime(c.closesAt)}`}
              </small>
            </div>
            <button
              type="button"
              className="button outline"
              aria-pressed={c.id === selected}
              onClick={() => {
                setSelected(c.id);
                setPage(1);
                setDetails(null);
              }}
            >
              عرض النتائج
            </button>
          </li>
        ))}
        {!list.length && <li className="muted">لا توجد مسابقات.</li>}
      </ul>
      {details && (
        <section className="launch-card campaign-details">
          <header>
            <h3>{details.competition.title}</h3>
            <a
              className="text-link"
              href={`/api/export?${new URLSearchParams({ competitionId: details.competition.id })}`}
            >
              <Icon name="download" size={17} /> تصدير CSV
            </a>
          </header>
          <div className="stage-summary">
            {details.stages.map((s) => (
              <button
                type="button"
                key={s.stage}
                className={s.stage === stage ? 'on' : ''}
                aria-pressed={s.stage === stage}
                onClick={() => {
                  setStage(s.stage);
                  setPage(1);
                }}
              >
                <b>{stageNames[s.stage]}</b>
                <span>
                  {s.submitted} مكتملة / {s.started}
                </span>
                <small>
                  {s.average === null ? '—' : `متوسط ${Math.round(s.average * 10) / 10}%`}
                </small>
              </button>
            ))}
          </div>
          {details.awards.length > 0 && (
            <div className="campaign-awards">
              <h4>
                الفائزون المعتمدون
                {details.publication && ' (معلنون)'}
              </h4>
              <ul>
                {details.awards.map((a, i) => (
                  <li key={i}>
                    {a.stage ? `${stageNames[a.stage]} · المركز ${a.place}` : 'جائزة الإعلام'}:{' '}
                    {a.name ?? a.label}
                    {a.participantNumber && (
                      <>
                        {' '}
                        · <bdi dir="ltr">{a.participantNumber}</bdi>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>الترتيب</th>
                  <th>المشارك</th>
                  <th>رقم المشارك</th>
                  <th>الدرجة</th>
                  <th>النسبة</th>
                </tr>
              </thead>
              <tbody>
                {details.results.rows.map((r) => (
                  <tr key={r.participantNumber}>
                    <td>{r.rank}</td>
                    <td>
                      <strong>{r.name}</strong>
                      <small>
                        {r.institution || '—'} · {r.locality}
                      </small>
                    </td>
                    <td>
                      <bdi dir="ltr">{r.participantNumber}</bdi>
                    </td>
                    <td>
                      <bdi dir="ltr">
                        {r.score} / {r.maxScore}
                      </bdi>
                    </td>
                    <td>{r.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!details.results.rows.length && (
              <div className="empty-inline">لا توجد مشاركات مكتملة في هذه المرحلة.</div>
            )}
          </div>
          {pages > 1 && (
            <nav className="leaderboard-pager" aria-label="صفحات النتائج">
              <button
                type="button"
                className="button outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                السابق
              </button>
              <span>
                صفحة <bdi dir="ltr">{page}</bdi> من <bdi dir="ltr">{pages}</bdi>
              </span>
              <button
                type="button"
                className="button outline"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                التالي
              </button>
            </nav>
          )}
        </section>
      )}
      {!details && selected && !error && <Loading />}
    </section>
  );
}
