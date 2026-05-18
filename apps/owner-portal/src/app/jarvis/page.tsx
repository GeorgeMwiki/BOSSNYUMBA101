/**
 * /jarvis — full-screen owner Jarvis route.
 *
 * Reuses the same `OwnerJarvisShell` as the home dashboard but in a
 * full-bleed layout so the owner gets the maximum vertical area for
 * the transcript. The home dashboard intentionally constrains the
 * shell to a fixed min-height; this route lets it stretch.
 *
 * The owner-portal already ships a vision-rich `pages/Jarvis.tsx`
 * with voice + image attachments — this route is the chat-first
 * surface that the home page links to as "Open full Jarvis". Both
 * routes coexist; this one mounts under `/app/jarvis` (legacy Vite
 * app-router mirror) and the canonical `/jarvis` continues to be
 * served by `pages/Jarvis.tsx` for backwards compatibility.
 */

import { OwnerJarvisShell } from '../../components/OwnerJarvisShell';

export default function OwnerJarvisPage(): JSX.Element {
  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <header>
          <h1 className="text-2xl font-bold text-foreground">
            Mr. Mwikila — Portfolio Concierge
          </h1>
          <p className="text-sm text-muted-foreground">
            Full-screen chat. Owner-tier brain tools, citations, and per-turn
            feedback are wired through the shell.
          </p>
        </header>
        <OwnerJarvisShell title="Conversation" />
      </div>
    </main>
  );
}
