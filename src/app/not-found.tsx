import Link from 'next/link';
import { Header, Footer } from '@/components/ui';
export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="empty-state">
        <span className="eyebrow">٤٠٤</span>
        <h1>هذه الصفحة خارج المسار.</h1>
        <p>لنعد إلى بداية الرحلة.</p>
        <Link href="/" className="button primary">
          العودة إلى الرئيسية
        </Link>
      </main>
      <Footer />
    </>
  );
}
