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
      <main id="main" className="container inner-page book-library">
        <div className="book-page-grid">
          <aside className="official-book-aside">
            {bundled ? (
              <Image
                src="/images/competition/book-cover.png"
                alt="غلاف كتاب الانتماء واللحمة الوطنية"
                width={921}
                height={1300}
                sizes="(max-width: 640px) 160px, 280px"
                priority
              />
            ) : (
              <div className="book-edition-placeholder">
                <Icon name="book" size={64} />
                <strong>{book.title}</strong>
              </div>
            )}
            <p className="book-file-details">
              <span>{arabic.format(book?.pageCount ?? 66)} صفحة</span>
              <span>PDF</span>
              <span>{arabic.format(megabytes)} ميغابايت تقريبًا</span>
            </p>
          </aside>
          <section className="book-overview" aria-labelledby="book-title">
            <DemoNote compact />
            <h1 id="book-title">كتاب المسابقة</h1>
            <p className="book-subtitle">{bundled ? 'الانتماء واللحمة الوطنية' : book.title}</p>
            {bundled && <p className="muted">لعبدالرحمن بن عبدالله بن محمد السند</p>}
            <p className="book-reading-note">
              ابدأ القراءة، وعد إلى ما تحتاجه من الصفحات أثناء الإجابة عن أسئلة المسابقة.
            </p>
            <div className="book-access-actions">
              <a className="button primary" href="#book-reader">
                <Icon name="book" /> اقرأ الكتاب هنا
              </a>
              {bundled ? (
                <>
                  <a
                    className="button outline"
                    href="/documents/national-belonging.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="pages" /> افتح الملف
                  </a>
                  <a
                    className="text-link"
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
            {content.bookTopics.length > 0 && (
              <div className="book-reading-topics">
                <h2>محاور القراءة</h2>
                <p className="muted">تدور أسئلة المسابقة حول هذه المحاور في الكتاب:</p>
                <ul className="book-topics">
                  {content.bookTopics.map((topic) => (
                    <li key={topic}>{topic}</li>
                  ))}
                </ul>
              </div>
            )}
            <Link className="text-link book-participate-link" href="/participate">
              إلى مساحة المشاركة <Icon />
            </Link>
          </section>
        </div>
        <section id="book-reader" className="book-reading-desk" aria-labelledby="reader-heading">
          <div className="book-reader-heading">
            <h2 id="reader-heading">صفحات الكتاب</h2>
            <p>تصفّح الصفحات، أو انتقل إلى الصفحة التي تريدها.</p>
          </div>
          <BookReader book={book ?? undefined} />
        </section>
      </main>
      <Footer />
    </>
  );
}
