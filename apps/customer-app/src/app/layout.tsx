import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import { ClientProviders } from '@/components/ClientProviders';
import { AppShell } from '@/components/layout/AppShell';
import { SpotlightMount } from '@/components/SpotlightMount';
import { MwikilaWidgetMount } from '@/components/MwikilaWidgetMount';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BossNyumba',
  description: 'Pay rent, submit maintenance requests, and stay in sync with your home — all on BossNyumba.',
  applicationName: 'BossNyumba',
  manifest: '/manifest.json',
  metadataBase: (() => {
    // NEXT_PUBLIC_APP_URL is baked into the bundle at build time. We
    // REFUSE TO BUILD a production bundle without it — silent absolute-URL
    // breakage in OG tags / metadata is a P0 brand bug (CRITICAL in
    // `.audit/production-readiness-gaps.md`). Outside production we fall
    // back to the dev port so local builds still work.
    const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (url) return new URL(url);
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'customer-app: NEXT_PUBLIC_APP_URL is required in production — ' +
          'set it on the deploy target so OG / metadata URLs are absolute.'
      );
    }
    return new URL('http://localhost:3002');
  })(),
  openGraph: {
    title: 'BossNyumba — Tenant app',
    description: 'Pay rent, submit maintenance requests, and stay in sync with your home.',
    siteName: 'BossNyumba',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BossNyumba',
  },
};

export const viewport: Viewport = {
  themeColor: '#17100A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className="dark">
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ClientProviders>
            <MwikilaWidgetMount>
              <AppShell>{children}</AppShell>
              <SpotlightMount />
            </MwikilaWidgetMount>
          </ClientProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
