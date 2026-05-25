import Link from 'next/link';
import type { OrgSummary } from '@/lib/marketplace/types';

/**
 * Card surface for a single org in the org browser.
 *
 * Mobile-first; renders as a stacked card on narrow viewports and a
 * compact row on wider ones. The whole card is one tap-target — the
 * shadcn-style outline ring on hover signals interactivity without
 * needing a separate "view" button.
 */
export function OrgCard({ org }: { readonly org: OrgSummary }): JSX.Element {
  return (
    <Link
      href={`/marketplace/orgs/${org.orgId}`}
      className="group flex flex-col gap-2 rounded-chat border border-ink-muted/10 bg-surface p-4 transition hover:border-brand hover:shadow-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink group-hover:text-brand">
            {org.name}
          </h3>
          {org.city ? (
            <p className="text-xs text-ink-muted">
              {org.city}
              {org.country ? ` · ${org.country}` : ''}
            </p>
          ) : null}
        </div>
        <span className="rounded-chip bg-brand-light px-2 py-0.5 text-xs font-medium text-brand-dark">
          {org.listingCount} listing{org.listingCount === 1 ? '' : 's'}
        </span>
      </div>
      {org.description ? (
        <p className="line-clamp-2 text-sm text-ink-muted">{org.description}</p>
      ) : null}
      <div className="mt-1 flex items-center gap-3 text-xs text-ink-muted">
        <span>{org.tenderCount} tender{org.tenderCount === 1 ? '' : 's'}</span>
        <span aria-hidden>·</span>
        <span className="text-brand">View →</span>
      </div>
    </Link>
  );
}
