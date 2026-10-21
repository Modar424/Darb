import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { isTheme, THEME_COOKIE } from '@/lib/theme';
import { getT } from '@/i18n/server';
import { dirOf } from '@/i18n/config';
import { Providers } from './providers';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
    title: { default: t('meta.title'), template: `%s | ${t('app.name')}` },
    description: t('meta.description'),
    openGraph: { title: t('meta.title'), description: t('meta.description'), type: 'website' },
  };
}
export const viewport: Viewport = { themeColor: '#0f2a43', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, t } = await getT();
  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value;
  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      data-theme={isTheme(themeCookie) ? themeCookie : undefined}
    >
      <body>
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-saffron-500 px-4 py-2 font-semibold text-ink-950 focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
        >
          {t('common.skipToContent')}
        </a>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
