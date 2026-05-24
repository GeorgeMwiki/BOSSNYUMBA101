import Link from 'next/link';
import type { MarketplaceListing } from '@/lib/marketplace/types';
import { formatPriceRange } from '@/lib/marketplace/api-client';

/**
 * Listing card — used in the discovery grid and on org pages.
 *
 * Layout: thumbnail (16:10) on top, content stack below. The whole
 * card is a single Link; secondary actions (Save, Compare, Share)
 * live on the detail page to keep the discovery surface scannable.
 */
export function ListingCard({
  listing,
}: {
  readonly listing: MarketplaceListing;
}): JSX.Element {
  const price = formatPriceRange(listing.priceMin, listing.priceMax, listing.currency);
  return (
    <Link
      href={`/marketplace/listings/${listing.listingId}`}
      className="group flex flex-col overflow-hidden rounded-chat border border-ink-muted/10 bg-surface transition hover:border-brand hover:shadow-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-raised">
        {listing.thumbnailUrl ? (
          // Next/Image would force domain whitelisting at config time —
          // we keep a plain <img> here so the marketplace works with any
          // partner CDN out of the box. Switch to <Image> once a
          // shortlist of CDNs is approved.
          <img
            src={listing.thumbnailUrl}
            alt={listing.propertyName}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-muted">
            No photo
          </div>
        )}
        {listing.negotiable ? (
          <span className="absolute right-2 top-2 rounded-chip bg-brand-dark/85 px-2 py-0.5 text-xs font-medium text-white">
            Negotiable
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-ink group-hover:text-brand">
            {listing.propertyName}
          </h3>
          <span className="text-sm font-semibold text-brand-dark">{price}</span>
        </div>
        <p className="text-xs text-ink-muted">
          {listing.orgName} · {listing.city}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <span>{listing.bedrooms} bed</span>
          <span aria-hidden>·</span>
          <span>{listing.bathrooms} bath</span>
          {listing.squareMeters !== null ? (
            <>
              <span aria-hidden>·</span>
              <span>{listing.squareMeters} m²</span>
            </>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
