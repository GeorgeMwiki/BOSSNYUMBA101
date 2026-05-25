'use client';

import { useEffect, useState } from 'react';
import { marketplaceClient } from '@/lib/marketplace/api-client';
import type {
  ListingsFilters,
  MarketplaceListing,
} from '@/lib/marketplace/types';
import { ListingCard } from '@/components/marketplace/ListingCard';

/**
 * Full marketplace search. Filters across all orgs by city, type,
 * bedrooms, and price range. Pagination is page-size 24.
 */
const PAGE_SIZE = 24;

export default function ListingsBrowsePage(): JSX.Element {
  const [filters, setFilters] = useState<ListingsFilters>({ page: 1, pageSize: PAGE_SIZE });
  const [items, setItems] = useState<ReadonlyArray<MarketplaceListing>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    marketplaceClient
      .searchListings(filters)
      .then((page) => {
        if (!alive) return;
        setItems(page.items);
        setTotal(page.total);
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [filters]);

  function update<K extends keyof ListingsFilters>(key: K, value: ListingsFilters[K]): void {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = filters.page ?? 1;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">Listings</h1>
        <p className="text-sm text-ink-muted">
          {total} listing{total === 1 ? '' : 's'} across every organisation.
        </p>
      </header>

      <section className="grid gap-3 rounded-chat border border-ink-muted/10 bg-surface p-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          City
          <input
            type="text"
            value={filters.city ?? ''}
            onChange={(e) => update('city', e.target.value || undefined)}
            placeholder="Any city"
            className="rounded-chat border border-ink-muted/20 bg-surface px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Type
          <input
            type="text"
            value={filters.type ?? ''}
            onChange={(e) => update('type', e.target.value || undefined)}
            placeholder="apartment, plot…"
            className="rounded-chat border border-ink-muted/20 bg-surface px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Bedrooms
          <input
            type="number"
            min={0}
            value={filters.bedrooms ?? ''}
            onChange={(e) =>
              update('bedrooms', e.target.value === '' ? undefined : Number(e.target.value))
            }
            className="rounded-chat border border-ink-muted/20 bg-surface px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Min price
          <input
            type="number"
            min={0}
            value={filters.minPrice ?? ''}
            onChange={(e) =>
              update('minPrice', e.target.value === '' ? undefined : Number(e.target.value))
            }
            className="rounded-chat border border-ink-muted/20 bg-surface px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Max price
          <input
            type="number"
            min={0}
            value={filters.maxPrice ?? ''}
            onChange={(e) =>
              update('maxPrice', e.target.value === '' ? undefined : Number(e.target.value))
            }
            className="rounded-chat border border-ink-muted/20 bg-surface px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
          />
        </label>
      </section>

      {error ? (
        <p className="rounded-chat border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading listings…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No listings match these filters. Try widening the price range.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((l) => (
            <ListingCard key={l.listingId} listing={l} />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="mt-4 flex items-center justify-center gap-2"
        >
          <button
            type="button"
            onClick={() => setFilters((p) => ({ ...p, page: Math.max(1, currentPage - 1) }))}
            disabled={currentPage <= 1}
            className="rounded-chat border border-ink-muted/20 bg-surface px-3 py-1.5 text-sm disabled:opacity-50"
          >
            ← Prev
          </button>
          <span className="text-sm text-ink-muted">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setFilters((p) => ({ ...p, page: Math.min(totalPages, currentPage + 1) }))
            }
            disabled={currentPage >= totalPages}
            className="rounded-chat border border-ink-muted/20 bg-surface px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Next →
          </button>
        </nav>
      ) : null}
    </div>
  );
}
