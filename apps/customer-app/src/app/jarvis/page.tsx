/**
 * /jarvis — Resident Concierge for the BossNyumba customer app.
 *
 * Tenants get their own first-person AI counterpart sitting on top of
 * the central-intelligence brain kernel. This page is the resident's
 * daily chat surface — sends thoughts to the customer Jarvis surface
 * and renders the typed decision (citations, confidence, persona
 * greeting).
 *
 * Performance: `JarvisConsole` pulls in `@bossnyumba/chat-ui` (voice +
 * adaptive renderer + GenUI primitives) which is heavy. The client-only
 * deferral (`next/dynamic` with `ssr: false`) lives in the
 * `JarvisConsoleLoader` Client Component because this page is a server
 * component (it awaits `getTranslations` + exports `metadata`), and the
 * App Router forbids `ssr: false` in server components.
 */

import { getTranslations } from 'next-intl/server';

import { JarvisConsoleLoader } from './JarvisConsoleLoader.js';

export const metadata = {
  title: 'Resident Concierge · BossNyumba Customer App',
};

export default async function JarvisPage() {
  const t = await getTranslations('residentConcierge');
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-surface px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>
      <main className="flex flex-1 justify-center px-6 py-6">
        <div className="w-full max-w-3xl">
          <JarvisConsoleLoader />
        </div>
      </main>
    </div>
  );
}
