import { Header, Icon } from '@/components/ui';

export default function BookLoading() {
  return (
    <>
      <Header />
      <main id="main" className="container inner-page book-loading" aria-busy="true">
        <Icon name="book" size={48} />
        <h1>كتاب المسابقة</h1>
        <p role="status">جارٍ تجهيز الكتاب للقراءة…</p>
      </main>
    </>
  );
}
