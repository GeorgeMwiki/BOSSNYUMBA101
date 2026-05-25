'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { marketplaceClient } from '@/lib/marketplace/api-client';
import type { MarketplaceListingDetail } from '@/lib/marketplace/types';

// `ListingDetail` pulls in PhotoGallery + MapPin + PriceNegotiator +
// ApplicationDraftAssistant (~400 LOC combined). Deferring it lets the
// page chrome paint while the listing is still being fetched.
const ListingDetail = dynamic(
  () =>
    import('@/components/marketplace/ListingDetail').then((m) => ({
      default: m.ListingDetail,
    })),
  { ssr: false, loading: () => <ListingDetailSkeleton /> },
);

function ListingDetailSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading listing"
      className="mx-auto flex max-w-5xl flex-col gap-4 p-4 lg:flex-row"
    >
      <div className="flex-1 space-y-3">
        <div className="aspect-[4/3] w-full animate-pulse rounded-chat bg-ink-muted/15" />
        <div className="h-7 w-2/3 animate-pulse rounded bg-ink-muted/15" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-ink-muted/15" />
        <div className="h-20 w-full animate-pulse rounded bg-ink-muted/10" />
      </div>
      <div className="w-full space-y-3 lg:w-[360px]">
        <div className="h-32 w-full animate-pulse rounded-chat bg-ink-muted/15" />
        <div className="h-48 w-full animate-pulse rounded-chat bg-ink-muted/10" />
      </div>
    </div>
  );
}

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
