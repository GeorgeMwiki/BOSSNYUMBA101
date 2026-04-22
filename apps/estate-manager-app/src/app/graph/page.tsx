/**
 * Relationship Explorer — a first-class UI for the Head of Estates' tenant-
 * scoped property graph.
 *
 * The page itself is a server component. It renders the shell (frame, H1,
 * search bar, empty state) and defers all interactivity — force-directed
 * layout, fetching, focus handling, keyboard nav — to the client-only
 * <GraphExplorer /> sub-component.
 *
 * Data contract: the page calls these authenticated routes on the
 * api-gateway (shipped in a parallel task):
 *   - GET  /api/v1/graph/node/:label/:id
 *   - GET  /api/v1/graph/neighbourhood?label=&id=&depth=&edgeTypes=
 *   - POST /api/v1/graph/query
 *
 * There is NO mock data. When the API returns:
 *   - 401 → redirect to /login (auth expired)
 *   - 403 → "You need property-manager or higher" card
 *   - 404 → "Node not found in your portfolio" empty state
 *   - 503 → "Graph service isn't wired on this environment — ask ops"
 *
 * Auth is enforced by the app's existing session middleware; this page is
 * only reachable by a signed-in manager.
 */

import type { Metadata } from 'next';
import { GraphExplorer } from './GraphExplorer';

export const metadata: Metadata = {
  title: 'Relationship explorer · BossNyumba',
  description:
    'Visual + searchable explorer of the Head of Estates\' tenant-scoped graph — properties, units, tenants, vendors, incidents, payments, policies, cases, documents.',
};

// Avoid ISR/SSG — this page is personalised and must re-render per visit.
export const dynamic = 'force-dynamic';

export default function GraphPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10">
        <header className="max-w-3xl">
          <p className="font-mono text-[0.68rem] uppercase tracking-widest text-signal-500">
            Knowledge graph
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
            Relationship explorer
          </h1>
          <p className="mt-3 text-base leading-relaxed text-neutral-500 sm:text-lg">
            Search any unit, tenant, vendor, or incident to see its
            neighbourhood — the vendors who serviced it, the leases that
            touched it, the cases it spawned.
          </p>
        </header>

        <div className="mt-8">
          <GraphExplorer />
        </div>
      </div>
    </div>
  );
}
