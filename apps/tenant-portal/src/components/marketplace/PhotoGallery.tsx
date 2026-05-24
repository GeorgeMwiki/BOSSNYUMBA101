'use client';

import { useState } from 'react';
import type { ListingMedia } from '@/lib/marketplace/types';

/**
 * Minimal photo gallery — hero image with a strip of thumbnails.
 *
 * Keyboard a11y: left/right arrow keys move the hero; thumbnails are
 * <button> so they pick up focus rings from tailwind utilities.
 */
export function PhotoGallery({
  media,
  fallbackAlt,
}: {
  readonly media: ReadonlyArray<ListingMedia>;
  readonly fallbackAlt: string;
}): JSX.Element {
  const photos = media.filter((m) => m.type === 'photo' || m.type === 'street_view');
  const [activeIndex, setActiveIndex] = useState(0);
  if (photos.length === 0) {
    return (
      <div className="flex aspect-[16/10] w-full items-center justify-center rounded-chat bg-surface-raised text-ink-muted">
        No photos available
      </div>
    );
  }
  const hero = photos[activeIndex] ?? photos[0];
  return (
    <div
      className="flex flex-col gap-2"
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setActiveIndex((i) => (i - 1 + photos.length) % photos.length);
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % photos.length);
        }
      }}
      tabIndex={0}
    >
      <img
        src={hero.url}
        alt={hero.caption ?? fallbackAlt}
        className="aspect-[16/10] w-full rounded-chat object-cover"
      />
      {photos.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={p.url}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === activeIndex}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-chat border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                i === activeIndex
                  ? 'border-brand'
                  : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <img
                src={p.url}
                alt={p.caption ?? `${fallbackAlt} thumbnail ${i + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
