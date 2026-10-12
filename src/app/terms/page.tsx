import Link from 'next/link';
import { Header, Footer, Icon } from '@/components/ui';
import { isLocalMode } from '@/lib/runtime';
import { readSiteContent, readPublicStatus } from '@/lib/service';
import { meetingQuestionCounts, stageKeys, questionCount } from '@/lib/competition-domain';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'شروط وضوابط المشاركة' };
export default async function Terms() {
  const { rules } = await readSiteContent();
  const status = await readPublicStatus();
  const counts = stageKeys.map((stage) =>
    questionCount(status ?? { questionCounts: meetingQuestionCounts }, stage),
  );
  return (
    <>
      <Header />
      <main id="main" className="container inner-page terms-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">قبل أن تشارك · ١٤٤٨هـ / ٢٠٢٦م</span>
            <h1>شروط وضوابط المشاركة.</h1>
            <p>ضوابط المشاركة وآلية الإجابة وإرسال المشاركة، للمراجعة والاعتماد.</p>
          </div>
        </div>
        {isLocalMode() && (
          <p className="terms-demo-note">
            هذه منصة تجريبية. أسئلة العرض وبياناته افتراضية، ومواعيد الإطلاق بانتظار الاعتماد.
          </p>
        )}
        <ol className="competition-rules">
          {rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
        <section className="admin-panel">
          <h2>آلية الإجابة وإرسال المشاركة</h2>
          <p>
            يتكون نموذج المرحلة المتوسطة من {counts[0]} سؤالًا، والثانوية من {counts[1]} سؤالًا،
            والجامعية من {counts[2]} سؤالًا.{' '}
            {status?.answerMode === 'per_question'
              ? 'تطبق هذه الحملة السابقة تثبيت كل إجابة، ولا يمكن تغيير الإجابة بعد تثبيتها.'
              : 'يمكنك الرجوع إلى الأسئلة وتعديل جميع الإجابات حتى الإرسال النهائي، وتُعتمد إجاباتك بعد الإرسال النهائي ولا يمكن تغييرها.'}
          </p>
          <p>
            لا تُعرض الإجابات الصحيحة للمشاركين أثناء المسابقة أو بعد إتمام المشاركة؛ حفاظًا على
            نزاهة المنافسة وعدالة الفرص بين المشاركين.
          </p>
        </section>
        <div className="button-row">
          <Link href="/register" className="button primary">
            الانتقال إلى التسجيل <Icon />
          </Link>
          <Link href="/privacy" className="button outline">
            سياسة الخصوصية
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
