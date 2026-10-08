import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { ThemeProvider, themeInitScript } from '@/components/ThemeProvider';
import { ToastProvider } from '@/components/Toast';
import { WakeApi } from '@/components/WakeApi';
import { AuthProvider } from '@/hooks/useAuth';
import { LocaleProvider } from '@/utils/locale';
import { landingDict } from '@/utils/i18n';
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

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = landingDict[await getLocale()];
  return {
    title: 'EventWall',
    description: 'Let your guests create one shared live photo wall — directly from their phones.',
    // Link previews in messengers; the image comes from app/opengraph-image.tsx.
    // Pages must not set their own `openGraph`, or they drop that image.
    openGraph: { title: meta.title, description: meta.description, siteName: 'EventWall', type: 'website' },
    twitter: { card: 'summary_large_image' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // enables env(safe-area-inset-*) on notched phones
  themeColor: '#FAFAF9', // switched to the dark color by ThemeProvider when the site is in dark mode
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <WakeApi />
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
