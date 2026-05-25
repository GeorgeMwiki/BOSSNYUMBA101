/**
 * /jarvis — Property Concierge for the BossNyumba estate-manager app.
 *
 * Estate managers get their own first-person AI counterpart sitting on
 * top of the central-intelligence brain kernel. This page is the
 * manager's daily chat surface — sends thoughts to the manager Jarvis
 * surface and renders the typed decision (citations, confidence,
 * persona greeting).
 */

import { useTranslations } from 'next-intl';
import { JarvisConsole } from './JarvisConsole';

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
