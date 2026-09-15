'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { motion, MotionConfig } from 'motion/react';
export function Icon({ name = 'arrow', size = 22 }: { name?: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    arrow: (
      <>
        <path d="M19 12H5m6-6-6 6 6 6" />
      </>
    ),
    book: (
      <>
        <path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
        <path d="m8 12 3 3 5-5" />
      </>
    ),
    grad: (
      <>
        <path d="m2 9 10-5 10 5-10 5L2 9Zm4 2v6c4 3 8 3 12 0v-6M22 9v8" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" />
      </>
    ),
    chart: (
      <>
        <path d="M4 3v18h17M8 16v-5m5 5V7m5 9V4" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    heart: <path d="M20 5c-3-3-7-1-8 2-1-3-5-5-8-2-4 4 1 10 8 15 7-5 12-11 8-15Z" />,
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="8" cy="7" r="3" />
        <circle cx="16" cy="17" r="3" />
      </>
    ),
    bell: (
      <>
        <path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 4h4" />
      </>
    ),
    dot: <circle cx="12" cy="12" r="3" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.arrow}
    </svg>
  );
}
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="الانتماء واللحمة الوطنية — الرئيسية">
      <svg width="39" height="49" viewBox="0 0 39 49" fill="none" aria-hidden="true">
        <path
          d="M4 44V21C4 10 11 4 19.5 4S35 10 35 21v23M11 44V23c0-7 3-11 8.5-11S28 16 28 23v21M4 44h31M19.5 24v20"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path d="m14 29 5.5-3 5.5 3" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      <span>
        الانتماء<span className="brand-small">واللحمة الوطنية</span>
      </span>
    </Link>
  );
}
export function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <a className="skip-link" href="#main">
        انتقل إلى المحتوى
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <nav className={open ? 'main-nav is-open' : 'main-nav'} aria-label="التنقل الرئيسي">
            <Link href="/#about" onClick={() => setOpen(false)}>
              عن المسابقة
            </Link>
            <Link
              href="/book"
              onClick={() => setOpen(false)}
              aria-current={path === '/book' ? 'page' : undefined}
            >
              كتاب المسابقة
            </Link>
            <Link href="/#journey" onClick={() => setOpen(false)}>
              رحلة المشاركة
            </Link>
            <Link href="/#faq" onClick={() => setOpen(false)}>
              الأسئلة الشائعة
            </Link>
          </nav>
          <div className="header-actions">
            <Link href="/register?mode=login" className="login-link" aria-label="تسجيل الدخول">
              <Icon name="user" size={18} />
              <span>تسجيل الدخول</span>
            </Link>
            <button
              className="icon-button mobile-menu"
              onClick={() => setOpen(!open)}
              aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
              aria-expanded={open}
            >
              <Icon name={open ? 'close' : 'menu'} />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <Brand />
        <p>معرفة تُلهمنا، وانتماء يجمعنا.</p>
        <div>
          <Link href="/admin">مساحة اللجنة</Link>
          <span className="footer-note">تصوّر تجريبي · ليس الموقع الرسمي</span>
        </div>
      </div>
    </footer>
  );
}
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </MotionConfig>
  );
}
export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.5, delay }}
    >
      {children}
    </motion.div>
  );
}
export function DemoNote({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'demo-note compact' : 'demo-note'}>
      <span className="status-dot" />
      {compact ? 'نسخة تجريبية' : 'نسخة تجريبية للاستعراض · المحتوى والبيانات افتراضية'}
    </div>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <div className="error-message" role="alert">
      {message}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" /> جارٍ تحميل المساحة…
    </div>
  );
}
export async function api<T = Record<string, unknown>>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(
      `/api/${path}`,
      body !== undefined
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        : { cache: 'no-store' },
    );
  } catch {
    throw new Error('تعذّر الاتصال. تحقق من الاتصال ثم أعد المحاولة.');
  }
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error('الخدمة غير متاحة مؤقتًا. أعد المحاولة بعد قليل.');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'تعذّر الاتصال. حاول مرة أخرى.');
  return data;
}
