'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="empty-state">
      <h1>تعذّر تحميل هذه المساحة.</h1>
      <p>حاول مرة أخرى. الإجابات التي تأكد حفظها تبقى محفوظة.</p>
      <button className="button primary" onClick={reset}>
        إعادة المحاولة
      </button>
    </main>
  );
}
