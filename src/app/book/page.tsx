import Link from 'next/link';
import { Header, Footer, DemoNote, Icon } from '@/components/ui';
import { BookReader } from '@/components/book-reader';
export const metadata = { title: 'مساحة القراءة' };
export default function Book() {
  return (
    <>
      <Header />
      <main id="main" className="container inner-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">المعرفة بداية الأثر</span>
            <h1>صفحات تجمعنا.</h1>
            <p>اقرأ على مهل، واحتفظ بمساحتك للتأمل.</p>
          </div>
          <DemoNote compact />
        </div>
        <div className="book-page-grid">
          <aside>
            <div className="book-cover">
              <span>نصوص تجريبية</span>
              <Icon name="book" size={62} />
              <h2>
                الانتماء
                <br />
                في حياتنا اليومية
              </h2>
              <span>مادة أصلية لاختبار التجربة</span>
            </div>
            <p className="muted">
              سيُضاف كتاب المسابقة الرسمي بعد استلام النسخة المعتمدة وحقوق استخدامها.
            </p>
            <Link className="text-link" href="/participate">
              إلى مساحة المشاركة <Icon />
            </Link>
          </aside>
          <BookReader />
        </div>
      </main>
      <Footer />
    </>
  );
}
