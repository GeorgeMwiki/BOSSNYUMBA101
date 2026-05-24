import type { MarketplaceListingDetail } from '@/lib/marketplace/types';
import { formatPriceRange } from '@/lib/marketplace/api-client';
import { PhotoGallery } from './PhotoGallery';
import { MapPin } from './MapPin';
import { PriceNegotiator } from './PriceNegotiator';
import { ApplicationDraftAssistant } from './ApplicationDraftAssistant';

/**
 * Listing detail page composition. Renders a two-column layout on wide
 * viewports (gallery+meta on the left, actions on the right) and
 * stacks on narrow ones.
 */
export function ListingDetail({
  listing,
}: {
  readonly listing: MarketplaceListingDetail;
}): JSX.Element {
  const price = formatPriceRange(
    listing.priceRange.min,
    listing.priceRange.max,
    listing.priceRange.currency,
  );
  return (
    <article className="mx-auto flex max-w-5xl flex-col gap-6 p-4 lg:flex-row">
      <section className="flex-1 flex-col gap-4">
        <PhotoGallery media={listing.media} fallbackAlt={listing.propertyName} />
        <header className="mt-4">
          <h1 className="text-2xl font-semibold text-ink">{listing.propertyName}</h1>
          <p className="text-sm text-ink-muted">
            {listing.unitName} · {listing.orgName} · {listing.city},{' '}
            {listing.country}
          </p>
        </header>
        <p className="text-lg font-semibold text-brand-dark">{price}</p>
        {listing.description ? (
          <p className="text-sm leading-relaxed text-ink">{listing.description}</p>
        ) : null}
        <dl className="grid grid-cols-2 gap-3 rounded-chat border border-ink-muted/10 bg-surface p-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-ink-muted">Bedrooms</dt>
            <dd className="font-medium text-ink">{listing.bedrooms}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Bathrooms</dt>
            <dd className="font-medium text-ink">{listing.bathrooms}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Size</dt>
            <dd className="font-medium text-ink">
              {listing.squareMeters !== null ? `${listing.squareMeters} m²` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Furnishing</dt>
            <dd className="font-medium text-ink">{listing.furnishing ?? '—'}</dd>
          </div>
        </dl>
        {listing.amenities.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {listing.amenities.map((a) => (
              <li
                key={a}
                className="rounded-chip bg-surface-raised px-3 py-1 text-xs text-ink"
              >
                {a.replace(/_/g, ' ')}
              </li>
            ))}
          </ul>
        ) : null}
        <MapPin
          latitude={listing.latitude}
          longitude={listing.longitude}
          label={listing.propertyName}
        />
      </section>
      <aside className="flex w-full flex-col gap-4 lg:w-[360px]">
        <PriceNegotiator listing={listing} />
        <ApplicationDraftAssistant listing={listing} />
        {listing.virtualTourUrl ? (
          <a
            href={listing.virtualTourUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-chat border border-brand bg-brand-light px-3 py-2 text-center text-sm font-medium text-brand-dark hover:bg-brand hover:text-white"
          >
            Take the virtual tour →
          </a>
        ) : null}
      </aside>
    </article>
  );
}
