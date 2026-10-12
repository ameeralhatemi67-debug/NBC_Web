import Link from 'next/link';
import { Header, Footer } from '@/components/ui';
import { privacyReviewSections, privacyRights } from '@/lib/privacy-review';
export const metadata = { title: 'سياسة الخصوصية وحماية البيانات الشخصية — للمراجعة' };
export default function Privacy() {
  return (
    <>
      <Header />
      <main id="main" className="container inner-page terms-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">قبل التسجيل</span>
            <h1>سياسة الخصوصية وحماية البيانات الشخصية</h1>
            <p>مسودة للمراجعة والاعتماد من اللجنة.</p>
          </div>
        </div>
        <p className="notice">
          بانتظار اعتماد المسوغ النظامي، وضوابط مشاركة القاصرين، ومدة الاحتفاظ، ومقدمي الخدمة ومواقع
          المعالجة، ووسيلة التواصل لطلبات أصحاب البيانات. تُستكمل هذه التفاصيل قبل الإطلاق الرسمي.
        </p>
        {privacyReviewSections.map((section) => (
          <section className="admin-panel" key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.text}</p>
          </section>
        ))}
        <section className="admin-panel">
          <h2>حقوق صاحب البيانات الشخصية</h2>
          <ul>
            {privacyRights.map((right) => (
              <li key={right}>{right}</li>
            ))}
          </ul>
          <p>
            الجهة: فرع الرئاسة العامة لهيئة الأمر بالمعروف والنهي عن المنكر بالمنطقة الشرقية. وسيلة
            التواصل الخاصة بحماية البيانات بانتظار اعتماد اللجنة.
          </p>
        </section>
        <section className="admin-panel">
          <h2>الإقرار بالاطلاع</h2>
          <p>
            الإقرار بالاطلاع على الشروط والسياسة لا يُعد موافقة عامة على أي استخدام للبيانات. تُراجع
            الحاجة إلى موافقات مستقلة، بما فيها ما يتعلق بالقاصرين، قبل الإطلاق.
          </p>
        </section>
        <div className="button-row">
          <Link href="/terms" className="button outline">
            شروط وضوابط المشاركة
          </Link>
          <Link href="/register" className="button primary">
            الانتقال إلى التسجيل
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
