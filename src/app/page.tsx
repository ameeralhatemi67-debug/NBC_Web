import Link from 'next/link';
import { arDigits } from '@/lib/format';
import { CompetitionPrizes } from '@/components/competition-prizes';
import { CompetitionHero } from '@/components/competition-hero';
import { Header, Footer, Icon, Reveal, OrganizationsBar } from '@/components/ui';
import { connection } from 'next/server';
import { readPrizes, readSiteContent, readWinners, readPublicStatus } from '@/lib/service';
import { CompetitionStatus, statusSentence } from '@/components/competition-status';
import { isLocalMode } from '@/lib/runtime';
import { defaultPrizes } from '@/lib/prizes';
import { stageKeys, questionCount, meetingQuestionCounts } from '@/lib/competition-domain';
export default async function Home() {
  await connection();
  // Public information must remain readable while the production database is being configured.
  // Without saved committee settings, show the approved default allocation (52,000 SAR).
  const prizes = await readPrizes()
    .then((saved) => saved ?? defaultPrizes)
    .catch(() => defaultPrizes);
  const winners = await readWinners().catch(() => null);
  const [content, status] = await Promise.all([readSiteContent(), readPublicStatus()]);
  const registrationOpen = status?.registration.open ?? true;
  return (
    <>
      <Header />
      <main id="main">
        <CompetitionHero intro={content.heroIntro} registrationOpen={registrationOpen} />
        {status && <CompetitionStatus status={status} />}
        {winners && (
          <section className="winners-banner container" aria-labelledby="winners-banner-title">
            <div>
              <span className="eyebrow">النتائج النهائية</span>
              <h2 id="winners-banner-title">أُعلن الفائزون في المسابقة</h2>
              <p>تهانينا للفائزين في المراحل الثلاث، وشكرًا لكل من شارك وقرأ وأسهم.</p>
            </div>
            <Link href="/winners" className="button primary">
              اطّلع على الفائزين <Icon />
            </Link>
          </section>
        )}
        <OrganizationsBar prominent />
        <CompetitionPrizes settings={prizes} />
        <section className="principle-strip">
          <div className="container principles">
            <span>
              <Icon name="book" /> الكتاب رفيقك أثناء المشاركة
            </span>
            <span>
              <Icon name="clock" /> اقرأ وأجب على مهل
            </span>
            <span>
              <Icon name="shield" /> فرص متكافئة للجميع
            </span>
          </div>
        </section>
        <section id="about" className="section about-section container">
          <Reveal className="section-label">
            <span className="eyebrow">٠١ / عن المسابقة</span>
            <span className="decorative-star">✳</span>
          </Reveal>
          <Reveal className="about-copy">
            <h2>
              حين تصبح المعرفة
              <br />
              <em>صلةً بيننا.</em>
            </h2>
            <div>
              <p>{arDigits(content.aboutIntro)}</p>
              {content.aboutDetails && <p className="muted">{arDigits(content.aboutDetails)}</p>}
              <Link href="/book" className="text-link">
                ابدأ من الكتاب <Icon size={19} />
              </Link>
            </div>
          </Reveal>
        </section>
        <section id="journey" className="section journey-section">
          <div className="container">
            <Reveal className="section-heading">
              <div>
                <span className="eyebrow">٠٢ / رحلة المشاركة</span>
                <h2>
                  ثلاث خطوات،
                  <br className="mobile-only" /> وأثرٌ يبقى.
                </h2>
              </div>
              <p>من أول صفحة إلى مشاركة تفخر بها.</p>
            </Reveal>
            <div className="journey-grid">
              {[
                {
                  n: '١',
                  icon: 'user',
                  title: 'سجّل مشاركتك',
                  text: 'أنشئ حسابك وحدد مرحلتك التعليمية، لتبدأ رحلتك في المسابقة.',
                },
                {
                  n: '٢',
                  icon: 'book',
                  title: 'اقرأ واكتشف',
                  text: 'تصفّح الكتاب على مهل. يمكنك العودة إليه في أي وقت أثناء الإجابة.',
                },
                {
                  n: '٣',
                  icon: 'sun',
                  title: 'شارك بمعرفتك',
                  text: 'أجب، وراجع اختياراتك، ثم أرسل مشاركتك عندما تكون مستعدًا.',
                },
              ].map((step, i) => (
                <Reveal key={step.n} className="journey-step" delay={i * 0.08}>
                  <div className="step-top">
                    <span className="step-number">{step.n}</span>
                    <span className="arch-icon">
                      <Icon name={step.icon} size={30} />
                    </span>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
        <section className="section container audience-section">
          <Reveal>
            <span className="eyebrow">٠٣ / لمن هذه الرحلة؟</span>
            <h2>
              لكل مرحلة
              <br />
              <em>مساحة للمعرفة.</em>
            </h2>
            <p className="muted">
              لطلاب وطالبات المدارس والجامعات والكليات المعتمدة،
              <br /> الحكومية والأهلية والعالمية بالمنطقة الشرقية، وفق شروط الجهة المنظمة.
            </p>
          </Reveal>
          <div className="audience-list">
            {['المرحلة المتوسطة', 'المرحلة الثانوية', 'المرحلة الجامعية'].map((stage, i) => (
              <Reveal key={stage} delay={i * 0.06}>
                <div className="audience-row">
                  <span className="small-index">{arDigits(`0${i + 1}`)}</span>
                  <h3>{stage}</h3>
                  <span>
                    {arDigits(
                      questionCount(
                        status ?? { questionCounts: meetingQuestionCounts },
                        stageKeys[i],
                      ),
                    )}{' '}
                    سؤالًا
                  </span>
                  <Icon name={i === 2 ? 'grad' : 'book'} size={28} />
                </div>
              </Reveal>
            ))}
          </div>
        </section>
        <section className="book-invitation container">
          <Reveal className="book-invitation-inner">
            <div>
              <span className="eyebrow light">رحلتك المعرفية تبدأ من هنا</span>
              <h2>
                تمهّل في القراءة؛
                <br />
                فالمعرفة تستحق التأمل.
              </h2>
              <p>
                كتاب مفتوح، وأسئلة تدعوك للفهم. لا مؤقت للإجابة،
                <br /> ويمكنك مراجعة اختياراتك قبل الإرسال.
              </p>
              <Link href="/book" className="button cream">
                افتح مساحة القراءة <Icon name="book" />
              </Link>
            </div>
            <div className="arch-decoration" aria-hidden="true">
              <div />
              <Icon name="book" size={90} />
            </div>
          </Reveal>
        </section>
        {content.faqs.length > 0 && (
          <section id="faq" className="section container faq-section">
            <Reveal>
              <span className="eyebrow">٠٤ / قبل أن تبدأ</span>
              <h2>
                كل ما تحتاج
                <br />
                <em>إلى معرفته.</em>
              </h2>
              <p className="muted">إجابات واضحة لبداية مطمئنة.</p>
            </Reveal>
            <div className="faq-list">
              {content.faqs.map((f, i) => (
                <details key={f.q}>
                  <summary>
                    <span className="small-index">{arDigits(`0${i + 1}`)}</span>
                    {arDigits(f.q)}
                    <span className="faq-plus">+</span>
                  </summary>
                  <p>{arDigits(f.a)}</p>
                </details>
              ))}
            </div>
          </section>
        )}
        <section className="closing-section">
          <Reveal>
            <span className="eyebrow">رحلتك تبدأ بخطوة</span>
            <h2>اقرأ، وشارك، واترك أثرًا.</h2>
            <Link
              href={registrationOpen ? '/register' : winners ? '/winners' : '/register?mode=login'}
              className="button primary"
            >
              {registrationOpen
                ? 'ابدأ المشاركة'
                : winners
                  ? 'اطّلع على الفائزين'
                  : 'ادخل إلى مساحتك'}{' '}
              <Icon />
            </Link>
            <p className="closing-note">
              {isLocalMode()
                ? 'عرض محلي بمحتوى اصطناعي للاختبار'
                : status
                  ? statusSentence(status, null)
                  : 'تُتاح المشاركة خلال فترة المسابقة التي تعتمدها الجهة المنظمة'}
            </p>
          </Reveal>
        </section>
      </main>
      <Footer showOrganizations={false} />
    </>
  );
}
