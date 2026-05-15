'use client';

/**
 * 8. map — react-leaflet + OpenStreetMap.
 *
 * NOT Mapbox — no token cost in TZ + works without auth.
 *
 * Dependencies:
 *   - react-leaflet ^4.2.1
 *   - leaflet ^1.9.4
 *
 * TODO: offline tile cache via localStorage / IndexedDB. The TZ field
 * staff hit dead zones; warm-loading tiles when a property is opened
 * lets inspections continue offline. Not in this slice.
 *
 * Loading strategy: dynamic + ssr:false. Leaflet hard-depends on
 * `window`; SSR rendering would crash.
 */

import dynamic from 'next/dynamic';

import type { AgUiUiPartByKind } from './types';
import { Frame, GenUiError } from './Frame';
import { MapPartSchema } from './schemas';

export type MapViewProps = AgUiUiPartByKind<'map'>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MapInner = dynamic<any>(
  // Next.js webpack resolves the .tsx at build time; the explicit
  // extension keeps NodeNext module-resolution happy in `tsc --noEmit`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  () => import('./MapInner.js').then((m: any) => m.MapInner),
  {
    ssr: false,
    loading: () => <span className="text-xs text-muted-foreground">loading map…</span>,
  },
);

export function MapView(props: MapViewProps): JSX.Element {
  const parsed = MapPartSchema.safeParse(props);
  if (!parsed.success) {
    return (
      <GenUiError
        kind="map"
        message={parsed.error.issues.map((i) => i.message).join('; ')}
      />
    );
  }
  return (
    <Frame kind="map" {...(props.title ? { title: props.title } : {})}>
      <div className="w-full" style={{ height: 320 }}>
        <MapInner center={props.center} zoom={props.zoom} markers={props.markers} />
      </div>
    </Frame>
  );
}
