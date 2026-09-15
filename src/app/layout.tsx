import type { Metadata } from 'next';
import '@fontsource/noto-sans-arabic/400.css';
import '@fontsource/noto-sans-arabic/500.css';
import '@fontsource/noto-sans-arabic/600.css';
import '@fontsource/noto-naskh-arabic/400.css';
import '@fontsource/noto-naskh-arabic/600.css';
import './globals.css';
import { Providers } from '@/components/ui';
export const metadata: Metadata = {
  title: {
    default: 'الانتماء واللحمة الوطنية | معرفة تجمعنا',
    template: '%s | الانتماء واللحمة الوطنية',
  },
  description:
    'تصوّر تجريبي لمنصة مسابقة الانتماء واللحمة الوطنية. رحلة قراءة ومشاركة بتجربة عربية معاصرة.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
