import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { ThemeProvider, themeInitScript } from '@/components/ThemeProvider';
import { ToastProvider } from '@/components/Toast';
import { AuthProvider } from '@/hooks/useAuth';
import { LocaleProvider } from '@/utils/locale';
import { getLocale } from '@/utils/locale.server';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '600', '700'],
});

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'EventWall',
  description: 'Let your guests create one shared live photo wall — directly from their phones.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // enables env(safe-area-inset-*) on notched phones
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAF9' },
    { media: '(prefers-color-scheme: dark)', color: '#0F0F10' },
  ],
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <LocaleProvider initial={locale}>
            <ToastProvider>
              <AuthProvider>
                <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>{children}</div>
              </AuthProvider>
            </ToastProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
