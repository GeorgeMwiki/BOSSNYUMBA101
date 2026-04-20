import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import { AppShell } from '@/providers/AppShell';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
// Wave-21 Agent R: DeferredMounts is a 'use client' boundary that lazy-loads
// the Mwikila chat widget + Spotlight command palette via `next/dynamic`
// with `ssr: false`. Keeps chat-ui and spotlight's module graph out of every
// route's cold-compile (this layout is the ancestor of every route).
import { DeferredMounts } from '@/components/DeferredMounts';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BOSSNYUMBA Manager',
  description: 'Estate manager field operations app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BN Manager',
  },
};

export const viewport: Viewport = {
  themeColor: '#0ea5e9',
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
    <html lang={locale}>
      <body className={`${inter.className} pb-20`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppShell>
            <DeferredMounts bottomNavigation={<BottomNavigation />}>
              {children}
            </DeferredMounts>
          </AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
