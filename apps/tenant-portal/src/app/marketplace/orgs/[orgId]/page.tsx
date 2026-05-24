'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { marketplaceClient } from '@/lib/marketplace/api-client';
import type {
  MarketplaceListing,
  OrgProfile,
  TenderSummary,
} from '@/lib/marketplace/types';
import { ListingCard } from '@/components/marketplace/ListingCard';

/**
 * Org public profile page: header, listings under this org, tenders,
 * and a "Join with code" CTA.
 */
export default function OrgProfilePage(): JSX.Element {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId;
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [listings, setListings] = useState<ReadonlyArray<MarketplaceListing>>([]);
  const [tenders, setTenders] = useState<ReadonlyArray<TenderSummary>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let alive = true;
    Promise.all([
      marketplaceClient.getOrg(orgId),
      marketplaceClient.searchListings({ orgId, pageSize: 30, page: 1 }),
      marketplaceClient.listTenders(orgId),
    ])
      .then(([p, ls, ts]) => {
        if (!alive) return;
        setProfile(p);
        setListings(ls.items);
        setTenders(ts);
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [orgId]);

  if (loading) {
    return <p className="p-4 text-sm text-ink-muted">Loading organisation…</p>;
  }
  if (error || !profile) {
    return (
      <p className="p-4 text-sm text-red-700">
        {error ?? 'Organisation not found.'}
      </p>
    );
  }
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-ink">{profile.name}</h1>
        {profile.city ? (
          <p className="text-sm text-ink-muted">
            {profile.city}
            {profile.country ? ` · ${profile.country}` : ''}
          </p>
        ) : null}
        {profile.description ? (
          <p className="text-sm leading-relaxed text-ink">{profile.description}</p>
        ) : null}
        <dl className="grid grid-cols-2 gap-3 rounded-chat border border-ink-muted/10 bg-surface p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-ink-muted">Coverage</dt>
            <dd className="font-medium text-ink">{profile.coverageArea ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Contact</dt>
            <dd className="font-medium text-ink">{profile.primaryEmail}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Phone</dt>
            <dd className="font-medium text-ink">{profile.primaryPhone ?? '—'}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/marketplace/join"
            className="rounded-chat bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Join with code
          </Link>
          {profile.joinCodePromptHint ? (
            <span className="self-center text-xs text-ink-muted">
              {profile.joinCodePromptHint}
            </span>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">Listings</h2>
        {listings.length === 0 ? (
          <p className="text-sm text-ink-muted">No public listings right now.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ListingCard key={l.listingId} listing={l} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-ink">Tenders</h2>
        {tenders.length === 0 ? (
          <p className="text-sm text-ink-muted">No public tenders right now.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tenders.map((t) => (
              <li
                key={t.tenderId}
                className="flex flex-col gap-1 rounded-chat border border-ink-muted/10 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-ink">{t.scope}</p>
                  <p className="text-xs text-ink-muted">
                    Budget {t.budgetMin.toLocaleString()} –{' '}
                    {t.budgetMax.toLocaleString()} {t.currency} · closes{' '}
                    {new Date(t.closesAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-chip bg-surface-raised px-2 py-0.5 text-xs text-ink-muted">
                  {t.visibility}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
