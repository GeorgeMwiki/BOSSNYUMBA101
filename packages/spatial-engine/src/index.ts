/**
 * @bossnyumba/spatial-engine — public entrypoint.
 *
 * Muzima spatial parcel engine. See
 * `.audit/litfin-sota-2026-05-23/17-spatial-parcel-engine.md` for the
 * full spec, and the per-module file headers for the rationale.
 *
 * The React components live under `./components/*` and re-export
 * here for ergonomics. They are *client-only* — MapLibre touches the
 * DOM and MUST NOT be rendered on the server. Next.js consumers should
 * import from `@bossnyumba/spatial-engine/react` inside a `'use client'`
 * file or with `dynamic(() => import(...), { ssr: false })`.
 */

export * from './types.js';
export * from './color-coding.js';
export * from './geometry.js';
export * from './snap-to-building.js';

// React shell — re-export so callers can `import { ParcelMap } from
// '@bossnyumba/spatial-engine'`.
export { ParcelMap } from './components/ParcelMap.js';
export type { ParcelMapProps, ParcelClickEvent } from './components/ParcelMap.js';

export { ElementInspector } from './components/ElementInspector.js';
export type { ElementInspectorProps } from './components/ElementInspector.js';
