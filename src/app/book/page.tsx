import Image from 'next/image';
import Link from 'next/link';
import { connection } from 'next/server';
import { Header, Footer, DemoNote, Icon } from '@/components/ui';
import { BookReader } from '@/components/book-reader';
import { BookOpenButton } from '@/components/book-open-button';
import { readCurrentBook, readSiteContent } from '@/lib/service';
export const metadata = { title: 'كتاب المسابقة' };
// The bundled book keeps its static file and cover artwork; later books come from storage.
const bundledSha = 'ec07ef57e563ada8bba244317aeeef0e34c8caa0ea7e10bee228232615db79fd';
const bundledBytes = 8_365_094;
const arabic = new Intl.NumberFormat('ar-SA');
export default async function Book() {
  await connection();
  const [book, content] = await Promise.all([readCurrentBook(), readSiteContent()]);
  const bundled = !book || book.sha256 === bundledSha;
  const megabytes = Math.max(1, Math.round((book?.sizeBytes ?? bundledBytes) / 1_000_000));
  return (
    <>
      <Header />
      <main id="main" className="container inner-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">المعرفة بداية الأثر</span>
            <h1>كتاب المسابقة.</h1>
            <p>{bundled ? 'الانتماء واللحمة الوطنية، لعبدالرحمن بن عبدالله السند' : book.title}</p>
          </div>
          <DemoNote compact />
        </div>
        <div className="book-access-actions">
          {bundled ? (
            <>
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
            </>
          ) : (
            <BookOpenButton book={book} />
          )}
        </div>
        <div className="book-page-grid">
          <aside className="official-book-aside">
            {bundled && (
              <Image
                src="/images/competition/book-cover.png"
                alt="غلاف كتاب الانتماء واللحمة الوطنية"
                width={921}
                height={1300}
                sizes="(max-width: 760px) 220px, 280px"
              />
            )}
            <p className="muted">
              {arabic.format(book?.pageCount ?? 66)} صفحة · PDF · {arabic.format(megabytes)}{' '}
              ميغابايت تقريبًا
            </p>
            <p>
              يمكنك الرجوع إلى الكتاب أثناء الإجابة وتعديل اختياراتك حتى إرسال المشاركة نهائيًا.
            </p>
            <Link className="text-link" href="/participate">
              إلى مساحة المشاركة <Icon />
            </Link>
          </aside>
          <section className="official-book-reader" aria-label="قراءة كتاب المسابقة">
            <span className="eyebrow">اقرأ، ثم شارك بمعرفتك</span>
            <h2>محاور القراءة.</h2>
            {content.bookTopics.length > 0 && (
              <>
                <p>وفق التعريف بالمسابقة، تدور الأسئلة حول هذه المحاور في الكتاب:</p>
                <ul className="book-topics">
                  {content.bookTopics.map((topic) => (
                    <li key={topic}>{topic}</li>
                  ))}
                </ul>
              </>
            )}
            {bundled && (
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
            )}
          </section>
        </div>
        <BookReader book={book ?? undefined} />
      </main>
      <Footer />
    </>
  );
}
