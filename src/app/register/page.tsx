import { Header, Footer } from '@/components/ui';
import { Registration } from '@/components/registration';
export const metadata = { title: 'ابدأ رحلتك' };
export default function Register() {
  return (
    <>
      <Header />
      <main id="main" className="container inner-page">
        <Registration />
      </main>
      <Footer />
    </>
  );
}
