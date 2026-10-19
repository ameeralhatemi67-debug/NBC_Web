import type { Metadata } from 'next';
import '@fontsource/noto-sans-arabic/400.css';
import '@fontsource/noto-sans-arabic/500.css';
import '@fontsource/noto-sans-arabic/600.css';
import '@fontsource/noto-naskh-arabic/400.css';
import '@fontsource/noto-naskh-arabic/600.css';
import './numbers.css';
import './globals.css';
import './simulation.css';
import './designs.css';
import './exam-ux.css';
import './reader-ux.css';
import './result-intro-ux.css';
import './admin-ux.css';
import './winners-ux.css';
import './prize-draw.css';
import './analytics-insights.css';
import './meeting-ux.css';
import './media.css';
import './refinements.css';
import { Providers } from '@/components/ui';
export const metadata: Metadata = {
  title: {
    default: 'مسابقة الانتماء واللحمة الوطنية | معرفة تجمعنا',
    template: '%s | الانتماء واللحمة الوطنية',
  },
  description:
    'منصة مسابقة الانتماء واللحمة الوطنية. اقرأ الكتاب وشارك في 20 أو 25 أو 30 سؤالًا وفق مرحلتك التعليمية.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-design="original" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const d=localStorage.getItem('nbc-design');if(d==='official'||d==='hybrid')document.documentElement.dataset.design=d}catch{}try{const r=(new URLSearchParams(location.search).get('ref')||'').trim().toLowerCase();if(/^[a-z0-9][a-z0-9_-]{0,39}$/.test(r))localStorage.setItem('nbc-source',JSON.stringify({code:r,at:Date.now()}))}catch{}`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
