import { Header, Footer } from '@/components/ui';
import { Participation } from '@/components/participation';
export const metadata = { title: 'مساحة المشاركة' };
export default function Participate() {
  return (
    <>
      <Header />
      <main id="main" className="container inner-page">
        <Participation />
      </main>
      <Footer />
    </>
  );
}
