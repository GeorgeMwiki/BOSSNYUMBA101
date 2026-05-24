/**
 * Spatial-engine shim — internal re-export of the non-React surface
 * of `@bossnyumba/spatial-engine` (types, geometry helpers, snap).
 *
 * Why this exists:
 *   The spatial-engine package's `exports.".".types` points TypeScript
 *   at `./src/index.ts`, which transitively re-exports the React
 *   `<ParcelMap/>` shell + an `<ElementInspector/>` component that is
 *   not yet shipped. That makes `tsc --noEmit` blow up in every Node
 *   consumer (including parcel-service) even though we only need the
 *   pure-logic surface.
 *
 *   This shim deep-imports the three pure-logic modules from
 *   spatial-engine via the dedicated subpath exports
 *   (`./types`, `./geometry`, `./snap`) so:
 *     - TypeScript only sees the pure-logic source files (no JSX).
 *     - Vitest / Node resolve the same subpaths at runtime via
 *       `dist/` artefacts (built by `pnpm --filter @bossnyumba/spatial-engine build`).
 *
 *   The dedicated subpath exports are an additive change to
 *   spatial-engine's `package.json`; no source files were modified.
 *
 *   Once spatial-engine fixes its JSX pipeline and ships the missing
 *   ElementInspector, the shim can be deleted and imports collapsed
 *   to `@bossnyumba/spatial-engine`.
 *
 * Spec: `.audit/litfin-sota-2026-05-23/17-spatial-parcel-engine.md`
 * Part H — "packages/spatial-engine = pure logic; services/parcel-service
 * = I/O".
 */
export type {
  Lon,
  Lat,
  Position,
  GeoJsonPoint,
  GeoJsonLineString,
  GeoJsonPolygon,
  GeoJsonMultiPolygon,
  GeoJsonGeometry,
  AuthoritativeSource,
  OccupancyStatus,
  ElementStatus,
  ElementCondition,
  RoomType,
  MapLayerKind,
  Provenance,
  Parcel,
  Building,
  Floor,
  Unit,
  Room,
  Element,
  ElementPhoto,
  MapLayer,
  ReferenceBuilding,
  SnapResult,
  BoundingBox,
  GeocodeQuery,
  GeocodeResult,
} from '@bossnyumba/spatial-engine/types';

export {
  areaSqm,
  centroid,
  boundingBox,
  haversineDistanceM,
  haversineRaw,
} from '@bossnyumba/spatial-engine/geometry';

export {
  DEFAULT_SNAP_RADIUS_M,
  snapToNearestBuilding,
  refBuilding,
} from '@bossnyumba/spatial-engine/snap';
