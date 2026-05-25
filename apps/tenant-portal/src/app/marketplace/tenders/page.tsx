'use client';

import { useEffect, useState } from 'react';
import { marketplaceClient } from '@/lib/marketplace/api-client';
import type { TenderSummary } from '@/lib/marketplace/types';

/**
 * Public tenders. Visible to ANY signed-in user; the act of bidding
 * lives in the legacy `/v1/tenders/:id/bids` router (org-side wave).
 */
export default function TendersPage(): JSX.Element {
  const [tenders, setTenders] = useState<ReadonlyArray<TenderSummary>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    marketplaceClient
      .listTenders()
      .then((t) => alive && setTenders(t))
      .catch((err) => alive && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">Tenders</h1>
        <p className="text-sm text-ink-muted">
          Maintenance work packages published by orgs. If you're also a vendor
          on BossNyumba, this is your bid pipeline.
        </p>
      </header>
      {error ? (
        <p className="rounded-chat border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : loading ? (
        <p className="text-sm text-ink-muted">Loading tenders…</p>
      ) : tenders.length === 0 ? (
        <p className="text-sm text-ink-muted">No public tenders right now.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tenders.map((t) => (
            <li
              key={t.tenderId}
              className="flex flex-col gap-2 rounded-chat border border-ink-muted/10 bg-surface p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex-1">
                <p className="font-medium text-ink">{t.scope}</p>
                <p className="text-xs text-ink-muted">{t.orgName}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  Budget {t.budgetMin.toLocaleString()} –{' '}
                  {t.budgetMax.toLocaleString()} {t.currency}
                </p>
              </div>
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <span className="rounded-chip bg-surface-raised px-2 py-0.5 text-xs text-ink-muted">
                  {t.visibility}
                </span>
                <p className="text-xs text-ink-muted">
                  Closes {new Date(t.closesAt).toLocaleDateString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
