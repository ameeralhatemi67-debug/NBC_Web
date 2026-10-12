import Link from 'next/link';
import { connection } from 'next/server';
import { Header, Footer, Icon } from '@/components/ui';
import { WinnersList } from '@/components/winners-announcement';
import { readWinners } from '@/lib/service';
export const metadata = { title: 'الفائزون' };
export default async function Winners() {
  await connection();
  const announcement = await readWinners().catch(() => null);
  return (
    <>
      <Header />
      <main id="main" className="container inner-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">النتائج النهائية</span>
            <h1>الفائزون في المسابقة.</h1>
            <p>اعتمدت اللجنة المنظمة هذه النتائج بعد المراجعة والتدقيق.</p>
          </div>
        </div>
        {announcement ? (
          <WinnersList announcement={announcement} />
        ) : (
          <section className="empty-state">
            <p role="status">لم يُعلن الفائزون بعد. تُنشر النتائج النهائية هنا بقرار اللجنة.</p>
            <Link href="/" className="button outline">
              العودة إلى الرئيسية <Icon />
            </Link>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
