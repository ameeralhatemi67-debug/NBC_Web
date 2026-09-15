import Link from 'next/link';
import Image from 'next/image';
import { Header, Footer, Icon, Reveal, DemoNote } from '@/components/ui';
import { faqs } from '@/lib/content';
export default function Home() {
  return (
    <>
      <Header />
      <main id="main">
        <section className="hero">
          <div className="hero-art">
            <Image
              src="/images/heritage-book.png"
              alt="كتاب مفتوح في فناء معماري بألوان الحجر والرمل"
              fill
              priority
              sizes="(max-width: 760px) 100vw, 65vw"
            />
          </div>
          <div className="container hero-container">
            <Reveal className="hero-copy">
              <div className="eyebrow">
                <span /> معرفة تُلهمنا. وانتماء يجمعنا.
              </div>
              <h1>
                نقرأ لننتمي.
                <br />
                <span>وننتمي لنصنع الأثر.</span>
              </h1>
              <p className="hero-title">مسابقة الانتماء واللحمة الوطنية</p>
              <p className="hero-description">
                رحلة في المعرفة، نكتشف فيها معنى الانتماء،
                <br className="desktop-only" /> ونشارك في بناء مجتمع أكثر وعيًا وترابطًا.
              </p>
              <div className="button-row">
                <Link className="button primary" href="/register">
                  ابدأ رحلتك <Icon />
                </Link>
                <Link className="button outline" href="/book">
                  <Icon name="book" /> اكتشف الكتاب
                </Link>
              </div>
              <div className="hero-caption">
                <span className="tiny-line" /> لطلاب وطالبات المتوسطة والثانوية والجامعة
              </div>
            </Reveal>
          </div>
          <div className="hero-bottom container">
            <DemoNote compact />
            <a href="#about" className="scroll-hint">
              تعرّف على المسابقة <span>↓</span>
            </a>
            <span className="edition-label">القراءة بداية الأثر</span>
          </div>
        </section>
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
                الانتماء أكثر من كلمة. هو وعي نكتسبه، وقيم نعيشها، وأثر نتركه في محيطنا. تتيح
                المسابقة فرصة للقراءة والتأمل والمشاركة انطلاقًا من كتاب «الانتماء واللحمة الوطنية».
              </p>
              <p className="muted">
                تجربة عربية ميسّرة، تضع المعرفة في متناولك، وتمنحك مساحة للإجابة والرجوع إلى الكتاب
                قبل إرسال مشاركتك.
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
              عرض تجريبي · المواعيد والكتاب الرسمي بانتظار اعتماد الجهة المنظمة
            </p>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
