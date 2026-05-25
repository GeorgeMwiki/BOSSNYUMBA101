'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { marketplaceClient } from '@/lib/marketplace/api-client';
import type { MarketplaceListingDetail } from '@/lib/marketplace/types';
import { ListingDetail } from '@/components/marketplace/ListingDetail';

export default function ListingDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [listing, setListing] = useState<MarketplaceListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    marketplaceClient
      .getListing(id)
      .then((l) => alive && setListing(l))
      .catch((err) => alive && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return <p className="p-4 text-sm text-ink-muted">Loading listing…</p>;
  }
  if (error || !listing) {
    return (
      <p className="p-4 text-sm text-red-700">
        {error ?? 'Listing not found.'}
      </p>
    );
  }
  return <ListingDetail listing={listing} />;
}
