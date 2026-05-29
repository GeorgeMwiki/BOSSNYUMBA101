/**
 * Persona-adaptive surface helpers.
 *
 * The owner / manager / tenant don't see the same surface. This module
 * provides a pure-function `orderTabsForPersona(role, baseTabs)` that
 * takes the scale-default tab ladder and reorders it so the persona-
 * relevant tabs bubble to the front.
 *
 * Combine with the dynamic-sections adaptive-layout engine
 * (`decideLayout`) to compose persona ordering with intent / recency /
 * frustration / mastery weighting.
 *
 * Real-estate persona-relevance map (high level):
 *   - owner    → finance, treasury, rent, forecast, group-kpi, ...
 *   - manager  → maintenance, manager-dispatch, vendors, inspections, ...
 *   - tenant   → rent, leases, maintenance, tenants (self-service), ...
 */

import type { OwnerOSTabType } from './types.js';

export const SURFACE_PERSONAS = ['owner', 'manager', 'tenant'] as const;

export type SurfacePersona = (typeof SURFACE_PERSONAS)[number];

/**
 * Tab-type weight per persona. Higher weight = higher position. Unlisted
 * tabs default to 0 and retain base-order.
 */
const PERSONA_WEIGHTS: Readonly<
  Record<SurfacePersona, Readonly<Record<OwnerOSTabType, number>>>
> = {
  owner: Object.freeze({
    chat: 100,
    reminders: 95,
    rent: 90,
    treasury: 88,
    finance: 86,
    insights: 85,
    forecast: 82,
    'group-kpi': 80,
    'currency-consolidation': 78,
    'cross-border-settlement': 76,
    properties: 70,
    leases: 68,
  }) as Readonly<Record<OwnerOSTabType, number>>,

  manager: Object.freeze({
    chat: 100,
    'manager-dispatch': 95,
    maintenance: 92,
    inspections: 90,
    vendors: 88,
    'tenant-roster': 86,
    workforce: 85,
    'multi-property-map': 80,
    'compliance-calendar': 78,
    safety: 75,
    'safety-board': 73,
    properties: 70,
  }) as Readonly<Record<OwnerOSTabType, number>>,

  tenant: Object.freeze({
    chat: 100,
    rent: 95,
    leases: 92,
    maintenance: 90,
    docs: 80,
    reminders: 78,
    tenants: 75,
  }) as Readonly<Record<OwnerOSTabType, number>>,
};

/**
 * Reorder a base tab ladder so persona-relevant tabs bubble up. The
 * function is PURE — it returns a fresh array; the input is untouched.
 *
 * Algorithm:
 *   1. Build a score map: persona-weight (or 0) for every base tab.
 *   2. Sort descending by score with a stable base-index tiebreak so
 *      tabs that share the same weight keep their original order.
 *
 * Returns a frozen readonly array — callers must not mutate.
 */
export function orderTabsForPersona(
  persona: SurfacePersona,
  baseTabs: readonly OwnerOSTabType[],
): ReadonlyArray<OwnerOSTabType> {
  const weights = PERSONA_WEIGHTS[persona];
  const indexed = baseTabs.map((tab, idx) => ({
    tab,
    score: weights[tab] ?? 0,
    idx,
  }));
  indexed.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.idx - b.idx;
  });
  return Object.freeze(indexed.map((row) => row.tab));
}

/**
 * Convenience guard so route handlers and ui code can narrow a free-form
 * role string to a SurfacePersona.
 */
export function coerceSurfacePersona(
  raw: string | null | undefined,
): SurfacePersona {
  if (raw && (SURFACE_PERSONAS as readonly string[]).includes(raw)) {
    return raw as SurfacePersona;
  }
  return 'owner';
}
