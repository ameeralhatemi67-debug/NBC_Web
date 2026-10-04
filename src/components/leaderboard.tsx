'use client';
import { useEffect, useState } from 'react';
import { api } from './ui';
import { stageNames, type Stage, type LeaderboardEntry } from '@/lib/competition-domain';
export function Leaderboard({
  competitionId,
  stage,
  testRunId,
}: {
  competitionId: string;
  stage: Stage;
  testRunId?: string;
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  useEffect(() => {
    let alive = true;
    setEntries(null);
    api<{ entries: LeaderboardEntry[] }>(
      testRunId
        ? `admin/test-run/leaderboard?id=${testRunId}`
        : `leaderboard?competitionId=${competitionId}&stage=${stage}`,
    )
      .then((r) => {
        if (alive) setEntries(r.entries);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [competitionId, stage, testRunId]);
  return (
    <section className="leaderboard">
      <h2>ترتيب {stageNames[stage]}</h2>
      {entries ? (
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
                  <td>{row.rank}</td>
                  <td>
                    <bdi>{row.participantNumber}</bdi>
                  </td>
                  <td>{row.percentage}%</td>
                  <td>
                    {row.score} / {row.maxScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>قائمة الترتيب غير منشورة. تُعلنها اللجنة وفق سياسة المسابقة.</p>
      )}
    </section>
  );
}
