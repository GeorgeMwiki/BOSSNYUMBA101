'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { marketplaceClient } from '@/lib/marketplace/api-client';
import type {
  MarketplaceListing,
  OrgSummary,
} from '@/lib/marketplace/types';
import { OrgCard } from '@/components/marketplace/OrgCard';
import { ListingCard } from '@/components/marketplace/ListingCard';

/**
 * Discovery landing — org chips (entry points), featured listings,
 * recent searches. Mobile-first stack; desktop renders a wider grid.
 */
export default function MarketplaceLandingPage(): JSX.Element {
  const [orgs, setOrgs] = useState<ReadonlyArray<OrgSummary>>([]);
  const [featured, setFeatured] = useState<ReadonlyArray<MarketplaceListing>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      marketplaceClient.listOrgs(),
      marketplaceClient.searchListings({ pageSize: 6, page: 1 }),
    ])
      .then(([orgList, listingsPage]) => {
        if (!alive) return;
        setOrgs(orgList);
        setFeatured(listingsPage.items);
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 p-4">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-ink">Find a place. Across every org.</h1>
        <p className="text-sm text-ink-muted">
          One profile. Many organisations. Browse plots, units, and tenders —
          and bring your tenancies along when you move.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            href="/marketplace/listings"
            className="rounded-chat bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Browse listings
          </Link>
          <Link
            href="/marketplace/orgs"
            className="rounded-chat border border-brand bg-brand-light px-4 py-2 text-sm font-medium text-brand-dark hover:bg-brand hover:text-white"
          >
            Browse organisations
          </Link>
          <Link
            href="/marketplace/join"
            className="rounded-chat border border-ink-muted/20 bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-brand hover:text-brand"
          >
            Join with a code
          </Link>
        </div>
      </section>

      {error ? (
        <div className="rounded-chat border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <header className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-ink">Organisations</h2>
          <Link href="/marketplace/orgs" className="text-sm text-brand hover:text-brand-dark">
            View all →
          </Link>
        </header>
        {loading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : orgs.length === 0 ? (
          <p className="text-sm text-ink-muted">No organisations yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {orgs.slice(0, 6).map((o) => (
              <OrgCard key={o.orgId} org={o} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <header className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-ink">Featured listings</h2>
          <Link
            href="/marketplace/listings"
            className="text-sm text-brand hover:text-brand-dark"
          >
            Browse all →
          </Link>
        </header>
        {loading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : featured.length === 0 ? (
          <p className="text-sm text-ink-muted">No listings yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((l) => (
              <ListingCard key={l.listingId} listing={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
