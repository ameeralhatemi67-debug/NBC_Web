import Link from 'next/link';
import { CompetitionPrizes } from '@/components/competition-prizes';
import { CompetitionHero } from '@/components/competition-hero';
import { Header, Footer, Icon, Reveal, OrganizationsBar } from '@/components/ui';
import { faqs } from '@/lib/content';
import { connection } from 'next/server';
import { readPrizes } from '@/lib/service';
export default async function Home() {
  await connection();
  const prizes = await readPrizes();
  return (
    <>
      <Header />
      <main id="main">
        <CompetitionHero />
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
            <span className="eyebrow">01 / عن المسابقة</span>
            <span className="decorative-star">✳</span>
          </Reveal>
          <Reveal className="about-copy">
            <h2>
              حين تصبح المعرفة
              <br />
              <em>صلةً بيننا.</em>
            </h2>
            <div>
              <p>
                مسابقة معرفية تنطلق من كتاب «الانتماء واللحمة الوطنية» لعبدالرحمن بن عبدالله السند،
                لتعزيز قيم الانتماء الوطني والولاء للوطن وقيادته، وترسيخ التماسك المجتمعي والوعي
                الفكري.
              </p>
              <p className="muted">
                تجمع بين القراءة والتحليل والتنافس العادل، وتدعو الشباب إلى فهم دورهم في حماية
                المكتسبات الوطنية وتعزيز الهوية الوطنية في ضوء رؤية المملكة 2030.
              </p>
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
                <span className="eyebrow">02 / رحلة المشاركة</span>
                <h2>
                  ثلاث خطوات.
                  <br className="mobile-only" /> وأثرٌ يبقى.
                </h2>
              </div>
              <p>من أول صفحة، إلى مشاركة تفتخر بها.</p>
            </Reveal>
            <div className="journey-grid">
              {[
                {
                  n: '١',
                  icon: 'user',
                  title: 'سجّل حضورك',
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
            <span className="eyebrow">03 / لمن هذه الرحلة؟</span>
            <h2>
              لكل مرحلة،
              <br />
              <em>مساحة للمعرفة.</em>
            </h2>
            <p className="muted">
              لطلاب وطالبات المدارس الحكومية والأهلية والعالمية،
              <br /> والجامعات والكليات المعتمدة، وفق شروط الجهة المنظمة.
            </p>
          </Reveal>
          <div className="audience-list">
            {['المرحلة المتوسطة', 'المرحلة الثانوية', 'المرحلة الجامعية'].map((stage, i) => (
              <Reveal key={stage} delay={i * 0.06}>
                <div className="audience-row">
                  <span className="small-index">0{i + 1}</span>
                  <h3>{stage}</h3>
                  <Icon name={i === 2 ? 'grad' : 'book'} size={28} />
                </div>
              </Reveal>
            ))}
          </div>
        </section>
        <section className="book-invitation container">
          <Reveal className="book-invitation-inner">
            <div>
              <span className="eyebrow light">صفحة جديدة تبدأ بك</span>
              <h2>
                خذ وقتك في القراءة.
                <br />
                المعرفة تستحق.
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
        <section id="faq" className="section container faq-section">
          <Reveal>
            <span className="eyebrow">04 / قبل أن تبدأ</span>
            <h2>
              كل ما تحتاج
              <br />
              <em>إلى معرفته.</em>
            </h2>
            <p className="muted">إجابات واضحة، لبداية مطمئنة.</p>
          </Reveal>
          <div className="faq-list">
            {faqs.map((f, i) => (
              <details key={f.q}>
                <summary>
                  <span className="small-index">0{i + 1}</span>
                  {f.q}
                  <span className="faq-plus">+</span>
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="closing-section">
          <Reveal>
            <span className="eyebrow">رحلتك تبدأ بخطوة</span>
            <h2>اقرأ. شارك. اترك أثرًا.</h2>
            <Link href="/register" className="button primary">
              ابدأ المشاركة <Icon />
            </Link>
            <p className="closing-note">
              عرض تجريبي · المواعيد النهائية بانتظار اعتماد الجهة المنظمة
            </p>
          </Reveal>
        </section>
      </main>
      <Footer showOrganizations={false} />
    </>
  );
}
