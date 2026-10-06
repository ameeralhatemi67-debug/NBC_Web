import type { Metadata } from 'next';
import '@fontsource/noto-sans-arabic/400.css';
import '@fontsource/noto-sans-arabic/500.css';
import '@fontsource/noto-sans-arabic/600.css';
import '@fontsource/noto-naskh-arabic/400.css';
import '@fontsource/noto-naskh-arabic/600.css';
import './globals.css';
import './designs.css';
import './exam-ux.css';
import './reader-ux.css';
import { Providers } from '@/components/ui';
export const metadata: Metadata = {
  title: {
    default: 'مسابقة الانتماء واللحمة الوطنية | معرفة تجمعنا',
    template: '%s | الانتماء واللحمة الوطنية',
  },
  description:
    'منصة مسابقة الانتماء واللحمة الوطنية. اقرأ الكتاب وشارك في 20 سؤالًا لمرحلتك التعليمية.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-design="original" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{const d=localStorage.getItem('nbc-design');if(d==='official'||d==='hybrid')document.documentElement.dataset.design=d}catch{}`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
