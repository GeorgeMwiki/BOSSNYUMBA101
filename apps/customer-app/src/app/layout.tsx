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
  title: 'BOSSNYUMBA',
  description: 'Your property management companion. Pay rent, submit maintenance requests, and manage your tenancy.',
  manifest: '/manifest.json',
  metadataBase: (() => {
    // NEXT_PUBLIC_APP_URL is baked into the bundle at build time. When
    // absent we fall back to a sensible default rather than hard-failing
    // the build — production deployments supply the real value via their
    // CI/CD pipeline. A missing value in a real prod deploy is a config
    // bug that surfaces as wrong absolute URLs in OG tags, not a hard
    // crash. Warn once at module load so it shows up in build logs.
    const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (url) return new URL(url);
    if (process.env.NODE_ENV === 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        'customer-app: NEXT_PUBLIC_APP_URL not set — falling back to ' +
          'https://app.bossnyumba.com. Set this env var in your deploy target.'
      );
      return new URL('https://app.bossnyumba.com');
    }
    return new URL('http://localhost:3002');
  })(),
  openGraph: {
    title: 'BOSSNYUMBA - Tenant App',
    description: 'Your property management companion. Pay rent, submit maintenance requests, and manage your tenancy.',
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
    title: 'BOSSNYUMBA',
  },
};

export const viewport: Viewport = {
  themeColor: '#121212',
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
