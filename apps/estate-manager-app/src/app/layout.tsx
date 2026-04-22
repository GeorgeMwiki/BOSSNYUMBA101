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
  title: 'BossNyumba — Manager',
  description: 'The head of estates. Morning briefings, autonomy controls, and estate operations — amplified.',
  applicationName: 'BossNyumba Manager',
  manifest: '/manifest.json',
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
  colorScheme: 'dark',
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
      <body className={`${inter.className} pb-20 bg-background text-foreground antialiased`}>
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
