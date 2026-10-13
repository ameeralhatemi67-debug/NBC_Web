import { stageNames } from '@/lib/competition-domain';
import { arDigits, arMoney, riyadhDateTime } from '@/lib/format';
import type { WinnersAnnouncement } from '@/lib/winners';
import { Icon } from './ui';

// Server-rendered from the committee's frozen snapshot. Names appear only if the committee chose so.
export function WinnersList({ announcement }: { announcement: WinnersAnnouncement }) {
  return (
    <div className="winners-public">
      <p className="muted">
        {announcement.title} · أُعلن في {riyadhDateTime(announcement.publishedAt)}
      </p>
      <div className="winners-grid">
        {announcement.stages.map(({ stage, awards }) => (
          <section key={stage} className="winners-stage-card" aria-labelledby={`winners-${stage}`}>
            <h2 id={`winners-${stage}`}>
              <Icon name={stage === 'university' ? 'grad' : 'book'} size={22} /> {stageNames[stage]}
            </h2>
            {awards.length ? (
              <ol>
                {awards.map((award) => (
                  <li key={award.place}>
                    <span className="winner-place">{arDigits(award.place)}</span>
                    <div>
                      <strong>
                        {award.name ?? (
                          <>
                            مشارك رقم <bdi dir="ltr">{arDigits(award.participantNumber)}</bdi>
                          </>
                        )}
                      </strong>
                      {award.institution && <small>{award.institution}</small>}
                      {award.name && (
                        <small>
                          رقم المشارك <bdi dir="ltr">{arDigits(award.participantNumber)}</bdi>
                        </small>
                      )}
                    </div>
                    <span className="winner-prize">
                      <bdi>{arMoney(award.amount)}</bdi> ريال
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">لا توجد مشاركات مكتملة في هذه المرحلة.</p>
            )}
          </section>
        ))}
      </div>
      {announcement.media && (
        <section className="winners-stage-card winners-media">
          <h2>
            <Icon name="sun" size={22} /> جائزة التفاعل والتميز الإعلامي
          </h2>
          <p>
            <strong>{announcement.media.label}</strong>
            <span className="winner-prize">
              <bdi>{arMoney(announcement.media.amount)}</bdi> ريال
            </span>
          </p>
        </section>
      )}
    </div>
  );
}
