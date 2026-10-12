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
            تُطبق قاعدة المشاركة الواحدة لكل مسابقة، ويجوز المشاركة في مسابقة سنوية جديدة. يتكون
            نموذج المرحلة المتوسطة من {counts[0]} سؤالًا، والثانوية من {counts[1]} سؤالًا، والجامعية
            من {counts[2]} سؤالًا.
            {status?.answerMode === 'per_question'
              ? 'تطبق هذه الحملة السابقة تثبيت كل إجابة؛ تظهر التوضيحات بعد تثبيتها ولا يمكن تغييرها.'
              : 'يمكنك الرجوع إلى الأسئلة وتعديل جميع الإجابات حتى إرسال المشاركة نهائيًا. لا يمكن تغيير الإجابات بعد استلام المشاركة نهائيًا من الخادم.'}
          </p>
          <p>
            {status?.answerMode === 'per_question'
              ? 'تظهر التوضيحات بعد تثبيت الإجابة وفق قواعد هذه الحملة السابقة.'
              : 'تُعرض الإجابات الصحيحة والتوضيحات بعد الإرسال النهائي المؤكد من الخادم فقط.'}{' '}
            تتحكم سياسة المسابقة في إتاحة النتيجة الشخصية ونشر ترتيب المرحلة.
          </p>
        </section>
        <section className="admin-panel">
          <h2>البيانات والتحقق</h2>
          <p>
            تجمع البيانات اللازمة للتحقق من أهلية المشاركة وإدارة المسابقة ومراجعة النتائج والتواصل
            مع الفائزين في حدود الأغراض المعتمدة.
          </p>
          <p>
            يؤكد رمز التحقق الوصول إلى الجوال فقط، ولا يثبت ملكية الهوية الوطنية أو الإقامة. تُعتمد
            آلية التحقق من الهوية والأهلية لدى الجهات المختصة قبل الإطلاق الرسمي.
          </p>
          <p>
            يقتصر جمع البيانات على الحد الأدنى اللازم، وتُحدد المشاركة مع مقدمي الخدمة ومدة الاحتفاظ
            وآلية الإتلاف وحقوق المشارك في سياسة الخصوصية بعد اعتماد التفاصيل.
          </p>
          <p>
            الإقرار بالاطلاع لا يُعد موافقة عامة على استخدام البيانات.{' '}
            <Link href="/privacy">اقرأ سياسة الخصوصية وحماية البيانات الشخصية</Link> قبل التسجيل.
            تفاصيل التواصل ومعالجة بيانات القاصرين بانتظار مراجعة اللجنة.
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
