/**
 * Tiny map preview — non-interactive static rendering.
 *
 * We do NOT load a heavy map library on the discovery surface. Instead
 * the pin shows lat/long + a `View on Maps` link that deep-links into
 * whichever map app the user prefers. Once @bossnyumba/spatial-engine
 * publishes a `react` entry-point we can swap this for a real tile
 * preview.
 */
export function MapPin({
  latitude,
  longitude,
  label,
}: {
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly label?: string;
}): JSX.Element | null {
  if (latitude === null || longitude === null) return null;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  return (
    <div className="rounded-chat border border-ink-muted/10 bg-surface p-4">
      <p className="text-sm font-medium text-ink">Location</p>
      <p className="mt-1 text-xs text-ink-muted">
        {label ?? 'Approximate'} · {latitude.toFixed(4)}, {longitude.toFixed(4)}
      </p>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-sm text-brand hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        Open in Maps →
      </a>
    </div>
  );
}
