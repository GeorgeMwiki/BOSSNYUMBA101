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
 * adaptive renderer + GenUI primitives) which is heavy. We defer the
 * client bundle with `next/dynamic` so the page header + persona shell
 * paint immediately and the chat console hydrates after first paint.
 * `ssr: false` because the console relies on `window` for Web Speech
 * voice I/O and browser-only SSE streaming.
 */

import { getTranslations } from 'next-intl/server';
import dynamic from 'next/dynamic';

const JarvisConsole = dynamic(
  () => import('./JarvisConsole.js').then((m) => ({ default: m.JarvisConsole })),
  {
    ssr: false,
    loading: () => <JarvisConsoleSkeleton />,
  },
);

function JarvisConsoleSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading Resident Concierge"
      className="flex h-[60vh] w-full flex-col gap-3 rounded-lg border border-border bg-surface p-6"
    >
      <div className="h-6 w-2/3 animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
      <div className="mt-auto h-12 w-full animate-pulse rounded bg-gray-200" />
    </div>
  );
}

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
          <JarvisConsole />
        </div>
      </main>
    </div>
  );
}
