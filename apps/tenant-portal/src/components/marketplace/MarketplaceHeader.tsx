'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { marketplaceClient } from '@/lib/marketplace/api-client';
import type { OrgMembership } from '@/lib/marketplace/types';

/**
 * Sticky header for every page under `/marketplace/*`.
 *
 * Houses the navigation back to "Ask" + the multi-org switcher dropdown.
 * The switcher is rendered as a native <select> for keyboard/a11y
 * baseline; a polished combobox can replace it once the dropdown
 * primitives package lands.
 */
export function MarketplaceHeader({
  activeOrgId,
  onChangeOrg,
}: {
  readonly activeOrgId?: string;
  readonly onChangeOrg?: (orgId: string) => void;
}): JSX.Element {
  const [memberships, setMemberships] = useState<ReadonlyArray<OrgMembership>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    marketplaceClient
      .listMyOrgs()
      .then((list) => {
        if (!alive) return;
        setMemberships(list);
      })
      .catch(() => {
        if (!alive) return;
        // Not signed in or no memberships — render the static header.
        setMemberships([]);
      })
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-10 border-b border-ink-muted/10 bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/marketplace"
          className="flex items-center gap-2 text-base font-semibold text-ink hover:text-brand"
        >
          <span>BossNyumba</span>
          <span className="rounded-chip bg-brand-light px-2 py-0.5 text-xs font-medium text-brand-dark">
            Marketplace
          </span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/marketplace/listings"
            className="hidden text-sm text-ink-muted hover:text-brand sm:inline"
          >
            Listings
          </Link>
          <Link
            href="/marketplace/orgs"
            className="hidden text-sm text-ink-muted hover:text-brand sm:inline"
          >
            Orgs
          </Link>
          <Link
            href="/marketplace/tenders"
            className="hidden text-sm text-ink-muted hover:text-brand sm:inline"
          >
            Tenders
          </Link>
          {loaded && memberships.length > 0 ? (
            <label className="flex items-center gap-1 text-xs text-ink-muted">
              <span className="sr-only sm:not-sr-only">My orgs</span>
              <select
                value={activeOrgId ?? ''}
                onChange={(e) => onChangeOrg?.(e.target.value)}
                className="rounded-chat border border-ink-muted/20 bg-surface px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none"
              >
                <option value="">All orgs</option>
                {memberships.map((m) => (
                  <option key={m.orgId} value={m.orgId}>
                    {m.orgName}
                    {m.activeLeaseCount > 0 ? ` · ${m.activeLeaseCount} lease` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Link
            href="/marketplace/join"
            className="rounded-chat bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Join with code
          </Link>
        </nav>
      </div>
    </header>
  );
}
