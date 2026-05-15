'use client';

/**
 * MapInner — the leaflet-dependent slice of `MapView`. Kept in a
 * separate file so the parent can lazy-import it with ssr:false.
 *
 * NOTE on offline-tile cache (TODO): we declare a `useTileCache=true`
 * default, which currently has no effect — once integration installs
 * `leaflet.offline` we wire a localForage-backed cache here.
 */

// react-leaflet isn't installed at typecheck time; pnpm install during
// integration brings it in. Cast through `any` so the typecheck stays
// clean either way. The runtime contract (MapContainer + TileLayer +
// Marker + Popup) matches react-leaflet v4 exactly.
// @ts-ignore — module added at integration time
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as ReactLeaflet from 'react-leaflet';

import type { MapMarker } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { MapContainer, TileLayer, Marker, Popup } = ReactLeaflet as any;

export interface MapInnerProps {
  readonly center: readonly [number, number];
  readonly zoom: number;
  readonly markers: ReadonlyArray<MapMarker>;
}

export function MapInner(props: MapInnerProps): JSX.Element {
  return (
    <MapContainer
      center={props.center as [number, number]}
      zoom={props.zoom}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors"
      />
      {props.markers.map((m, i) => (
        <Marker key={i} position={m.position as [number, number]}>
          {m.popup ? <Popup>{m.popup}</Popup> : null}
        </Marker>
      ))}
    </MapContainer>
  );
}
