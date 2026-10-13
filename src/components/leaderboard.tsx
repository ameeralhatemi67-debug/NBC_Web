'use client';
import { useEffect, useState } from 'react';
import { api, ApiError, ErrorMessage } from './ui';
import { arDigits, NumPair } from '@/lib/format';
import { stageNames, type Stage, type LeaderboardEntry } from '@/lib/competition-domain';

type Board = {
  entries: LeaderboardEntry[];
  total?: number;
  page?: number;
  pageSize?: number;
  mine?: LeaderboardEntry | null;
};
export function Leaderboard({
  competitionId,
  stage,
  testRunId,
  participantNumber,
}: {
  competitionId: string;
  stage: Stage;
  testRunId?: string;
  participantNumber?: string;
}) {
  const [board, setBoard] = useState<Board | null>(null);
  const [page, setPage] = useState(1);
  // 'hidden' is the committee's choice; 'failed' is a real error and offers a retry.
  const [problem, setProblem] = useState<'' | 'hidden' | 'failed'>('');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setBoard(null);
    setProblem('');
    const me = participantNumber ? `&me=${encodeURIComponent(participantNumber)}` : '';
    api<Board>(
      testRunId
        ? `admin/test-run/leaderboard?id=${encodeURIComponent(testRunId)}`
        : `leaderboard?competitionId=${encodeURIComponent(competitionId)}&stage=${stage}&page=${page}${me}`,
    )
      .then((result) => alive && setBoard(result))
      .catch((error) => {
        if (!alive) return;
        if (error instanceof ApiError && error.status === 403) setProblem('hidden');
        else {
          setProblem('failed');
          setMessage((error as Error).message);
        }
      });
    return () => {
      alive = false;
    };
  }, [competitionId, stage, testRunId, page, attempt, participantNumber]);
  const entries = board?.entries;
  const mine =
    board?.mine ??
    entries?.find((row) => participantNumber && row.participantNumber === participantNumber);
  const pageSize = board?.pageSize ?? 0;
  const pages = board?.total && pageSize ? Math.ceil(board.total / pageSize) : 1;
  return (
    <section className="leaderboard">
      <h2>ترتيب {stageNames[stage]}</h2>
      {mine && (
        <p className="result-current-rank">
          ترتيبك الحالي <bdi dir="ltr">{arDigits(mine.rank)}</bdi>
        </p>
      )}
      {entries ? (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>الترتيب</th>
                  <th>رقم المشارك</th>
                  <th>النسبة</th>
                  <th>الدرجة</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr key={row.participantNumber}>
                    <td>{arDigits(row.rank)}</td>
                    <td>
                      <bdi>{arDigits(row.participantNumber)}</bdi>
                    </td>
                    <td>{arDigits(row.percentage)}٪</td>
                    <td>
                      <NumPair a={row.score} b={row.maxScore} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!entries.length && <div className="empty-inline">لا توجد نتائج مكتملة بعد.</div>}
          </div>
          {pages > 1 && (
            <nav className="leaderboard-pager" aria-label="صفحات الترتيب">
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
        </>
      ) : problem === 'failed' ? (
        <div role="alert">
          <ErrorMessage message={message || 'تعذّر تحميل قائمة الترتيب.'} />
          <button type="button" className="button outline" onClick={() => setAttempt(attempt + 1)}>
            أعد المحاولة
          </button>
        </div>
      ) : problem === 'hidden' ? (
        <p>قائمة الترتيب غير منشورة. تُعلنها اللجنة وفق سياسة المسابقة.</p>
      ) : (
        <p role="status">جارٍ تحميل الترتيب…</p>
      )}
    </section>
  );
}
