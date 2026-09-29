import { Header, Footer } from '@/components/ui';
import { Registration } from '@/components/registration';
export const metadata = { title: 'التسجيل وتسجيل الدخول' };
export default function Register() {
  return (
    <>
      <Header />
      <main id="main" className="auth-page">
        <Registration />
      </main>
      <Footer />
    </>
  );
}
