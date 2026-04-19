import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import { ClientProviders } from '@/components/ClientProviders';
import { AppShell } from '@/components/layout/AppShell';
import { SpotlightMount } from '@/components/SpotlightMount';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BOSSNYUMBA',
  description: 'Your property management companion. Pay rent, submit maintenance requests, and manage your tenancy.',
  manifest: '/manifest.json',
  metadataBase: (() => {
    const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (url) return new URL(url);
    if (process.env.NODE_ENV === 'production') {
      throw new Error('customer-app: NEXT_PUBLIC_APP_URL is required in production builds.');
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
            <AppShell>{children}</AppShell>
            <SpotlightMount />
          </ClientProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
