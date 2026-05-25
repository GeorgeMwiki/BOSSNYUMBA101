'use client';

import { useEffect, useMemo, useState } from 'react';
import { marketplaceClient } from '@/lib/marketplace/api-client';
import type { OrgSummary } from '@/lib/marketplace/types';
import { OrgCard } from '@/components/marketplace/OrgCard';

/**
 * Browse all orgs with a simple text filter.
 *
 * Server-side org search isn't a thing yet — the list is small enough
 * that client-side filtering covers the early discovery surface.
 */
export default function OrgsBrowsePage(): JSX.Element {
  const [orgs, setOrgs] = useState<ReadonlyArray<OrgSummary>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    marketplaceClient
      .listOrgs()
      .then((list) => alive && setOrgs(list))
      .catch((err) => alive && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return orgs;
    return orgs.filter((o) => {
      return (
        o.name.toLowerCase().includes(q) ||
        (o.city ?? '').toLowerCase().includes(q) ||
        (o.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [orgs, query]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 p-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-ink">Organisations</h1>
        <p className="text-sm text-ink-muted">
          Property managers, owner co-ops and rental businesses on BossNyumba.
          Tap one to see their listings.
        </p>
      </header>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by name, city, or description"
        className="rounded-chat border border-ink-muted/20 bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
      />
      {error ? (
        <p className="rounded-chat border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : loading ? (
        <p className="text-sm text-ink-muted">Loading organisations…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-ink-muted">No matches.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((o) => (
            <OrgCard key={o.orgId} org={o} />
          ))}
        </div>
      )}
    </div>
  );
}
