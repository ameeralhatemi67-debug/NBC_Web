import { mediaPrize, prizeStages, totalPrizes } from '@/lib/content';
import { Icon, Reveal } from './ui';

const money = new Intl.NumberFormat('en-US');
export function CompetitionPrizes() {
  return (
    <section id="prizes" className="section competition-prizes" aria-labelledby="prizes-title">
      <div className="container">
        <Reveal className="prizes-heading">
          <div>
            <span className="eyebrow">تقدير للمعرفة والمشاركة</span>
            <h2 id="prizes-title">
              لمعرفتكم قيمة.
              <br />
              <em>ولتميّزكم تقدير.</em>
            </h2>
            <p>6 مراكز في كل مرحلة تعليمية، وجوائز تحتفي بأثر المشاركة.</p>
          </div>
          <div className="prizes-total">
            <span>إجمالي الجوائز المالية</span>
            <strong>
              <bdi>{money.format(totalPrizes)}</bdi>
            </strong>
            <span>ريال سعودي</span>
            <Icon name="trophy" size={88} />
          </div>
        </Reveal>
        <div className="prize-stage-grid">
          {prizeStages.map((stage, index) => (
            <Reveal key={stage.name} className="prize-stage-card" delay={index * 0.07}>
              <div className="prize-stage-heading">
                <span className="stage-icon">
                  <Icon name={index === 2 ? 'grad' : 'book'} size={24} />
                </span>
                <div>
                  <h3>{stage.name}</h3>
                  <p>
                    مجموع الجوائز{' '}
                    <bdi>{money.format(stage.awards.reduce((sum, award) => sum + award, 0))}</bdi>{' '}
                    ريال
                  </p>
                </div>
              </div>
              <div className="first-prize">
                <div className="prize-medal" aria-hidden="true">
                  <Icon name="trophy" size={31} />
                </div>
                <span>المركز 1</span>
                <p>
                  <strong>
                    <bdi>{money.format(stage.awards[0])}</bdi>
                  </strong>{' '}
                  <span>ريال سعودي</span>
                </p>
              </div>
              <div className="prize-runners-up">
                {stage.awards.slice(1, 3).map((amount, rank) => (
                  <div key={rank}>
                    <span className="prize-position">
                      <span aria-hidden="true">{rank + 2}</span> المركز {rank + 2}
                    </span>
                    <p>
                      <strong>
                        <bdi>{money.format(amount)}</bdi>
                      </strong>
                      <span>ريال</span>
                    </p>
                  </div>
                ))}
              </div>
              <div className="remaining-prizes">
                <span>
                  المراكز <bdi>4 – 6</bdi>
                </span>
                <strong>
                  <bdi>{money.format(stage.awards[3])}</bdi> ريال <small>لكل مركز</small>
                </strong>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="recognition-heading">
          <span className="eyebrow">للمؤسسات وصنّاع الأثر</span>
          <h3>جوائز تشجيعية إضافية</h3>
        </Reveal>
        <div className="recognition-grid">
          <Reveal className="recognition-card">
            <Icon name="book" size={29} />
            <div>
              <h4>أفضل مدرسة مشاركة</h4>
              <p>درع أو شهادة شكر وتقدير</p>
            </div>
          </Reveal>
          <Reveal className="recognition-card">
            <Icon name="grad" size={29} />
            <div>
              <h4>أفضل جامعة أو كلية مشاركة</h4>
              <p>درع أو شهادة شكر وتقدير</p>
            </div>
          </Reveal>
          <Reveal className="recognition-card media-award">
            <Icon name="sun" size={29} />
            <div>
              <h4>التفاعل والتميز الإعلامي</h4>
              <p>
                <strong>
                  <bdi>{money.format(mediaPrize)}</bdi> ريال
                </strong>{' '}
                + درع أو شهادة شكر وتقدير
              </p>
            </div>
          </Reveal>
        </div>
        <p className="prizes-footnote">
          الإجمالي يشمل جوائز المراحل التعليمية وجائزة التفاعل والتميز الإعلامي. تُراجع النتائج قبل
          إعلانها، وآلية الترجيح عند التعادل من اختصاص اللجنة المنظمة.
        </p>
      </div>
    </section>
  );
}
