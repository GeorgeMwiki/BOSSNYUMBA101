'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { marketplaceClient } from '@/lib/marketplace/api-client';
import type { OrgMembership } from '@/lib/marketplace/types';
import { TenancyWidget } from '@/components/marketplace/TenancyWidget';

/**
 * My active tenancies across orgs.
 *
 * Multi-org tenancy is the core of the universal-app vision: ONE
 * profile, MANY orgs. This page lists one row per (org × role) so a
 * user with a tenancy at Asha and a vendor membership at Kilimani sees
 * both side-by-side.
 *
 * The per-org rent/maintenance/lease summary will plug in via the
 * `services/api-gateway/src/routes/marketplace/me-orgs` extension once
 * the data services attach those signals (the route already exposes
 * `activeLeaseCount`).
 */
export default function TenanciesPage(): JSX.Element {
  const [memberships, setMemberships] = useState<ReadonlyArray<OrgMembership>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    marketplaceClient
      .listMyOrgs()
      .then((m) => alive && setMemberships(m))
      .catch((err) => alive && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">My tenancies</h1>
        <p className="text-sm text-ink-muted">
          One row per organisation. Use the header switcher to manage a
          specific org's tenancy, or join a new one with a code.
        </p>
      </header>
      {error ? (
        <p className="rounded-chat border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : loading ? (
        <p className="text-sm text-ink-muted">Loading tenancies…</p>
      ) : memberships.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-chat border border-ink-muted/10 bg-surface p-4">
          <p className="text-sm text-ink-muted">
            You haven't joined any organisations yet.
          </p>
          <Link
            href="/marketplace/join"
            className="rounded-chat bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Join with a code
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {memberships.map((m) => (
            <TenancyWidget key={`${m.orgId}_${m.role}`} membership={m} />
          ))}
        </div>
      )}
    </div>
  );
}
