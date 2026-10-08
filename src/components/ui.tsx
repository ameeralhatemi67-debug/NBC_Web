'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import { motion, MotionConfig } from 'motion/react';
export function Icon({
  name = 'arrow',
  size = 22,
  className,
}: {
  name?: string;
  size?: number;
  className?: string;
}) {
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
    moon: <path d="M20 15a8 8 0 0 1-11-11 9 9 0 1 0 11 11Z" />,
    pages: (
      <>
        <rect x="8" y="7" width="12" height="14" rx="2" />
        <path d="M15 3H6a2 2 0 0 0-2 2v12" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    'cloud-check': (
      <>
        <path d="M6 17a5 5 0 1 1 1-10 6 6 0 0 1 11 2 4 4 0 0 1 0 8" />
        <path d="m9 16 3 3 5-5" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" />
      </>
    ),
    'wifi-off': (
      <>
        <path d="m3 3 18 18M2 8a17 17 0 0 1 3-2m4-1a17 17 0 0 1 13 3M5 12a11 11 0 0 1 4-2m5 0a11 11 0 0 1 5 2M8 16a6 6 0 0 1 8 0M12 20h.01" />
      </>
    ),
    copy: (
      <>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
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
    trophy: (
      <>
        <path d="M7 3h10v7a5 5 0 0 1-10 0V3ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 15v5m-5 1h10" />
      </>
    ),
    dot: <circle cx="12" cy="12" r="3" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5m0-8h.01" />
      </>
    ),
    warn: (
      <>
        <path d="M12 4 2.5 20h19L12 4Z" />
        <path d="M12 10v4m0 3h.01" />
      </>
    ),
    play: <path d="M8 5v14l11-7L8 5Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="m20 20-4.5-4.5" />
      </>
    ),
  };
  return (
    <svg
      className={className}
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
export function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <>
      <svg
        className="brand-mark"
        width={size}
        height={size}
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <path fill="var(--brand-gold, #b49250)" d="M13 20h18l37 43 19-3v17l-26 6-36-44-12 2Z" />
        <path fill="var(--brand-green, #18543f)" d="M87 20H69L32 63l-19-3v17l26 6 36-44 12 2Z" />
        <path
          d="M13 87c14 0 23 2 37 9 14-7 23-9 37-9"
          fill="none"
          stroke="var(--brand-green, #18543f)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path fill="var(--brand-green, #18543f)" d="m41 28 9-11 9 11-9 11Z" />
      </svg>
      <Image
        className="official-brand-mark"
        src="/images/organizations/general-presidency.png"
        alt=""
        loading="eager"
        width={size}
        height={size}
      />
    </>
  );
}
export function DesignToggle() {
  const [announcement, setAnnouncement] = useState('');
  return (
    <>
      <button
        type="button"
        className="design-toggle"
        aria-label="تغيير التصميم"
        title="تغيير التصميم: الأصلي، الرسمي، المزيج"
        onClick={() => {
          const designs = ['original', 'official', 'hybrid'];
          const index =
            (designs.indexOf(document.documentElement.dataset.design || 'original') + 1) %
            designs.length;
          const next = designs[index];
          document.documentElement.dataset.design = next;
          try {
            localStorage.setItem('nbc-design', next);
          } catch {
            /* The switch also works when storage is unavailable. */
          }
          setAnnouncement(['التصميم الأصلي', 'التصميم الرسمي', 'التصميم المزيج'][index]);
        }}
      >
        <Image src="/images/identity/vision2030.png" alt="" width={90} height={55} />
      </button>
      <span className="sr-only" role="status">
        {announcement}
      </span>
    </>
  );
}
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="مسابقة الانتماء واللحمة الوطنية، الرئيسية">
      <BrandMark />
      <span>
        مسابقة الانتماء<span className="brand-small">واللحمة الوطنية</span>
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
            <a href="/#about" onClick={() => setOpen(false)}>
              عن المسابقة
            </a>
            <Link
              href="/book"
              onClick={() => setOpen(false)}
              aria-current={path === '/book' ? 'page' : undefined}
            >
              كتاب المسابقة
            </Link>
            <a href="/#organizations" onClick={() => setOpen(false)}>
              الجهات المشاركة
            </a>
            <a href="/#prizes" onClick={() => setOpen(false)}>
              الجوائز
            </a>
          </nav>
          <div className="header-actions">
            <Link href="/book" className="header-book-link" aria-label="كتاب المسابقة">
              <Icon name="book" size={18} />
              <span>الكتاب</span>
            </Link>
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
            <DesignToggle />
          </div>
        </div>
      </header>
    </>
  );
}
export function OrganizationsBar({
  compact = false,
  prominent = false,
}: {
  compact?: boolean;
  prominent?: boolean;
}) {
  return (
    <section
      id={prominent ? 'organizations' : undefined}
      className={`organizations-bar${compact ? ' compact' : ''}${prominent ? ' prominent' : ''}`}
      aria-label="الجهات المشاركة"
    >
      <div className={compact ? 'organizations-container' : 'container organizations-container'}>
        <div className="organizations-heading">
          <h2 className="organizations-title">الجهات المشاركة</h2>
        </div>
        <div className="organizations-grid">
          <div className="org-logo-item org-logo-hedayah">
            <span className="org-role">الجهة المساندة</span>
            <Image
              src="/images/organizations/hedayah.png"
              alt="شعار جمعية هداية للدعوة والإرشاد وتوعية الجاليات بالمنطقة الشرقية"
              width={755}
              height={915}
              className="org-logo-img"
            />
          </div>
          <div className="org-logo-item org-logo-presidency">
            <span className="org-role">الجهة المنفذة</span>
            <Image
              src="/images/organizations/general-presidency.png"
              alt="شعار الرئاسة العامة لهيئة الأمر بالمعروف والنهي عن المنكر"
              width={760}
              height={760}
              className="org-logo-img"
            />
          </div>
          <div className="org-logo-item org-logo-saad">
            <span className="org-role">الجهة الراعية</span>
            <Image
              src="/images/organizations/saad-bin-soliab-foundation.svg"
              alt="شعار مؤسسة سعد بن صليب العتيبي الأهلية"
              width={495}
              height={207}
              unoptimized
              className="org-logo-img"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
export function Footer({ showOrganizations = true }: { showOrganizations?: boolean }) {
  return (
    <>
      {showOrganizations && <OrganizationsBar />}
      <footer className="site-footer">
        <div className="container footer-inner">
          <Brand />
          <p>معرفة تُلهمنا، وانتماء يجمعنا.</p>
          <div>
            <Link href="/terms">شروط المشاركة</Link>
            <Link href="/admin">مساحة اللجنة</Link>
            <span className="footer-note">تصوّر تجريبي · ليس الموقع الرسمي</span>
          </div>
        </div>
      </footer>
    </>
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
export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public retryAfter?: number,
    public status?: number,
  ) {
    super(message);
  }
}
export async function api<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(
      `/api/${path}`,
      body !== undefined
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal,
          }
        : { cache: 'no-store', signal },
    );
  } catch {
    throw new Error('تعذّر الاتصال. تحقق من الاتصال ثم أعد المحاولة.');
  }
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error('الخدمة غير متاحة مؤقتًا. أعد المحاولة بعد قليل.');
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.error ?? 'تعذّر الاتصال. حاول مرة أخرى.',
      data.code,
      data.retryAfter,
      response.status,
    );
  return data;
}
