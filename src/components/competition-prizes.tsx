import { defaultPrizes, prizeTotal, type PrizeSettings } from '@/lib/prizes';
import Link from 'next/link';
import { arDigits, arMoney } from '@/lib/format';
import { Icon, Reveal } from './ui';

const rankNames = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'];
export function CompetitionPrizes({
  settings = defaultPrizes,
  preview = false,
}: {
  settings?: PrizeSettings;
  preview?: boolean;
}) {
  const { stages: prizeStages, mediaPrize, layout } = settings;
  const totalPrizes = prizeTotal(settings);
  return (
    <section
      id={preview ? undefined : 'prizes'}
      className={`section competition-prizes prize-layout-${layout}`}
      aria-labelledby={preview ? 'preview-prizes-title' : 'prizes-title'}
    >
      <div className="container">
        <Reveal className="prizes-heading">
          <div>
            <span className="eyebrow">تقدير للمعرفة والمشاركة</span>
            <h2 id={preview ? 'preview-prizes-title' : 'prizes-title'}>
              لمعرفتكم قيمة،
              <br />
              <em>ولتميّزكم تقدير.</em>
            </h2>
            <p>ستة مراكز للفائزين في كل مرحلة تعليمية، وجوائز تحتفي بأثر المشاركة.</p>
          </div>
          <div className="prizes-total">
            <span>إجمالي الجوائز المالية</span>
            <strong>
              <bdi>{arMoney(totalPrizes)}</bdi>
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
                    إجمالي الجوائز المالية (
                    <bdi>{arMoney(stage.awards.reduce((sum, award) => sum + award, 0))}</bdi>) ريال
                  </p>
                </div>
              </div>
              <div className="first-prize">
                <div className="prize-medal" aria-hidden="true">
                  <Icon name="trophy" size={31} />
                </div>
                <span>المركز {rankNames[0]}</span>
                <p>
                  <strong>
                    <bdi>{arMoney(stage.awards[0])}</bdi>
                  </strong>{' '}
                  <span>ريال سعودي</span>
                </p>
              </div>
              <div className="prize-runners-up">
                {stage.awards.slice(1, 3).map((amount, rank) => (
                  <div key={rank}>
                    <span className="prize-position">
                      <span aria-hidden="true">{arDigits(rank + 2)}</span> المركز{' '}
                      {rankNames[rank + 1]}
                    </span>
                    <p>
                      <strong>
                        <bdi>{arMoney(amount)}</bdi>
                      </strong>
                      <span>ريال</span>
                    </p>
                  </div>
                ))}
              </div>
              <div className="prize-finalists">
                {stage.awards.slice(3).every((amount) => amount === stage.awards[3]) ? (
                  <div className="remaining-prizes">
                    <span>
                      المراكز من {rankNames[3]} إلى {rankNames[5]}
                    </span>
                    <strong>
                      <bdi>{arMoney(stage.awards[3])}</bdi> ريال <small>لكل مركز</small>
                    </strong>
                  </div>
                ) : (
                  stage.awards.slice(3).map((amount, i) => (
                    <div className="remaining-prizes" key={i}>
                      <span>المركز {rankNames[i + 3]}</span>
                      <strong>
                        <bdi>{arMoney(amount)}</bdi> ريال
                      </strong>
                    </div>
                  ))
                )}
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="recognition-heading">
          <span className="eyebrow">تقديرًا للتميز والمشاركة الفاعلة</span>
          <h3>الجوائز التشجيعية الإضافية</h3>
        </Reveal>
        <div className="recognition-grid">
          <Reveal className="recognition-card">
            <Icon name="book" size={29} />
            <div>
              <h4>المدرسة المتميزة في المشاركة</h4>
              <p>
                تُكرَّم المدرسة الأكثر تميزًا في المشاركة بالمسابقة، وفق المعايير المعتمدة من اللجنة
                المنظمة، بدرع تذكاري وشهادة شكر وتقدير، يُسلَّمان لممثل المدرسة خلال الحفل الختامي
                للمسابقة.
              </p>
            </div>
          </Reveal>
          <Reveal className="recognition-card">
            <Icon name="grad" size={29} />
            <div>
              <h4>الجامعة أو الكلية المتميزة في المشاركة</h4>
              <p>
                تُكرَّم الجامعة أو الكلية الأكثر تميزًا في المشاركة بمسابقة «الانتماء واللحمة
                الوطنية»، وفق المعايير المعتمدة من اللجنة المنظمة، بدرع تذكاري وشهادة شكر وتقدير،
                يُسلَّمان لممثل الجهة التعليمية خلال الحفل الختامي للمسابقة.
              </p>
            </div>
          </Reveal>
          <Reveal className="recognition-card media-award">
            <Icon name="sun" size={29} />
            <div>
              <h4>التميز في التغطية الإعلامية وصناعة المحتوى</h4>
              <p>
                تُمنح الجائزة لأفضل مشاركة إعلامية متميزة في تغطية مسابقة «الانتماء واللحمة الوطنية»
                والتعريف بأهدافها وفعالياتها، من خلال محتوى إعلامي أصيل يتسم بالجودة والإبداع
                والمصداقية، وفق الشروط والمعايير المعتمدة من اللجنة المنظمة.
              </p>
              <p>
                <strong>الجائزة:</strong> مبلغ مالي قدره (<bdi>{arMoney(mediaPrize)}</bdi>) ريال،
                ودرع تذكاري وشهادة شكر وتقدير، تُسلَّم للفائز خلال الحفل الختامي للمسابقة.
              </p>
            </div>
          </Reveal>
        </div>
        <p className="prizes-footnote">
          الإجمالي يشمل جوائز المراحل التعليمية وجائزة التميز في التغطية الإعلامية وصناعة المحتوى.
          تُراجع النتائج قبل إعلانها، وآلية الترجيح عند التعادل من اختصاص اللجنة المنظمة.{' '}
          <Link href="/terms">للاطلاع على شروط المشاركة ومعايير التقييم.</Link>
        </p>
      </div>
    </section>
  );
}
