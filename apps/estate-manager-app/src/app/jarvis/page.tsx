/**
 * /jarvis — Property Concierge for the BossNyumba estate-manager app.
 *
 * Estate managers get their own first-person AI counterpart sitting on
 * top of the central-intelligence brain kernel. This page is the
 * manager's daily chat surface — sends thoughts to the manager Jarvis
 * surface and renders the typed decision (citations, confidence,
 * persona greeting).
 *
 * Performance: `JarvisConsole` (414 LOC + chat-ui + GenUI deps) is
 * deferred via `next/dynamic` so the page header paints immediately.
 */

import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';

const JarvisConsole = dynamic(
  () => import('./JarvisConsole.js').then((m) => ({ default: m.JarvisConsole })),
  {
    loading: () => <JarvisConsoleSkeleton />,
  },
);

function JarvisConsoleSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading Property Concierge"
      className="flex h-[60vh] w-full flex-col gap-3 rounded-lg border border-border bg-surface p-6"
    >
      <div className="h-6 w-2/3 animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
      <div className="mt-auto h-12 w-full animate-pulse rounded bg-gray-200" />
    </div>
  );
}

export const metadata = {
  title: 'Property Concierge · BossNyumba Estate Manager',
};

export default function JarvisPage() {
  const t = useTranslations('p89.jarvis');
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-surface px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">{t('propertyConcierge')}</h1>
        <p className="text-sm text-muted-foreground">
          Your personal AI counterpart for properties, tenants, and operations.
        </p>
      </header>
      <main className="flex flex-1 justify-center px-6 py-6">
        <div className="w-full max-w-3xl">
          <JarvisConsole />
        </div>
      </main>
    </div>
  );
}
