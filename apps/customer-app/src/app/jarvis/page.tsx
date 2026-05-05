/**
 * /jarvis — Resident Concierge for the BossNyumba customer app.
 *
 * Tenants get their own first-person AI counterpart sitting on top of
 * the central-intelligence brain kernel. This page is the resident's
 * daily chat surface — sends thoughts to the customer Jarvis surface
 * and renders the typed decision (citations, confidence, persona
 * greeting).
 */

import { JarvisConsole } from './JarvisConsole';

export const metadata = {
  title: 'Resident Concierge · BossNyumba Customer App',
};

export default function JarvisPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-surface px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">Resident Concierge</h1>
        <p className="text-sm text-muted-foreground">
          Your personal AI counterpart for your home, lease, and payments.
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
