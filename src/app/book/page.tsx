import Image from 'next/image';
import Link from 'next/link';
import { Header, Footer, DemoNote, Icon } from '@/components/ui';
import { BookReader } from '@/components/book-reader';
export const metadata = { title: 'كتاب المسابقة' };
export default function Book() {
  return (
    <>
      <Header />
      <main id="main" className="container inner-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">المعرفة بداية الأثر</span>
            <h1>كتاب المسابقة.</h1>
            <p>الانتماء واللحمة الوطنية، لعبدالرحمن بن عبدالله السند</p>
          </div>
          <DemoNote compact />
        </div>
        <div className="book-access-actions">
          <a
            className="button primary"
            href="/documents/national-belonging.pdf"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="book" /> افتح الكتاب في نافذة جديدة
          </a>
          <a
            className="button outline"
            href="/documents/national-belonging.pdf"
            download="الانتماء واللحمة الوطنية.pdf"
          >
            <Icon name="download" /> حمّل الكتاب
          </a>
        </div>
        <div className="book-page-grid">
          <aside className="official-book-aside">
            <Image
              src="/images/competition/book-cover.png"
              alt="غلاف كتاب الانتماء واللحمة الوطنية"
              width={921}
              height={1300}
              sizes="(max-width: 760px) 220px, 280px"
            />
            <p className="muted">٦٦ صفحة · PDF · ٨ ميغابايت تقريبًا</p>
            <p>يمكنك الرجوع إلى الكتاب أثناء الإجابة، وتثبيت إجاباتك بعد القراءة.</p>
            <Link className="text-link" href="/participate">
              إلى مساحة المشاركة <Icon />
            </Link>
          </aside>
          <section className="official-book-reader" aria-label="قراءة كتاب المسابقة">
            <span className="eyebrow">اقرأ، ثم شارك بمعرفتك</span>
            <h2>محاور القراءة.</h2>
            <p>وفق التعريف بالمسابقة، تدور الأسئلة حول هذه المحاور في الكتاب:</p>
            <ul className="book-topics">
              <li>مفهوم الانتماء الوطني ومرتكزاته الشرعية.</li>
              <li>اللحمة الوطنية وأثرها في مواجهة التحديات الفكرية.</li>
              <li>دور الشباب في حماية المكتسبات الوطنية.</li>
              <li>رؤية المملكة 2030 وتعزيز الهوية الوطنية.</li>
              <li>صور واقعية للتماسك المجتمعي في المملكة.</li>
            </ul>
            <details className="inline-pdf">
              <summary>عرض صفحات الكتاب هنا</summary>
              <p className="fine-print">
                إذا لم يظهر الكتاب في متصفحك، استخدم زر الفتح أو التحميل أعلاه.
              </p>
              <object
                data="/documents/national-belonging.pdf"
                type="application/pdf"
                className="official-book-pdf"
                aria-label="ملف كتاب الانتماء واللحمة الوطنية"
              >
                <p>
                  لا يدعم متصفحك عرض الكتاب هنا.{' '}
                  <a
                    href="/documents/national-belonging.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    افتح ملف الكتاب
                  </a>{' '}
                  أو حمّله باستخدام الزر أعلاه.
                </p>
              </object>
            </details>
          </section>
        </div>
        <BookReader />
      </main>
      <Footer />
    </>
  );
}
