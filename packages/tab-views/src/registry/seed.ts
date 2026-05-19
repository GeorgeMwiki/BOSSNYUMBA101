/**
 * Seeded views — at least one default view per J1 entity_type.
 *
 * The 14 default J1 entity types (from `packages/entity-store/src/registry`):
 *
 *   employee · customer-owner · property · lease · tenant-person · vendor ·
 *   lead · deal · ticket · kra-filing · campaign · process-step ·
 *   recommendation · internal-staff
 *
 * For each type we register at least one TabView. Six of the views
 * are the "headline" sample implementations under `src/views/`; the
 * remaining eight are minimal placeholder tables that prove the
 * registry contract works for every default type.
 *
 * Placeholder views render an empty `markdown-card` if no data is
 * supplied. They exist so the MD can answer "show me the customers
 * tab" against a fresh tenant without throwing — and so portals
 * adopting K-G have a baseline to override.
 */

import type { TabView } from '../types/tab-view.js';
import { TabViewRegistry } from './tab-view-registry.js';
import { EmployeeTableView } from '../views/employee-table-view.js';
import { PropertyKpiGridView } from '../views/property-kpi-grid-view.js';
import { LeaseTimelineView } from '../views/lease-timeline-view.js';
import { ArrearsTableView } from '../views/arrears-table-view.js';
import { KraFilingProfileCardView } from '../views/kra-filing-profile-card-view.js';
import { RecommendationListView } from '../views/recommendation-list-view.js';
import { buildPlaceholderView } from './placeholder-view.js';

/**
 * The 14 default J1 entity-type keys plus `arrears` — which is a
 * computed sub-view of `lease` + `ticket` but materialises as its
 * own tab when there's data.
 *
 * Why include arrears separately?
 *   The owner asks "who are my top arrears tenants?" with no notion
 *   of "lease". The MD should reach a tab named "arrears" — not
 *   "leases filtered by amount_due > 0". The view authors decided
 *   to expose this as a distinct top-level view.
 */
export const SEEDED_ENTITY_TYPES = [
  'employee',
  'customer-owner',
  'property',
  'lease',
  'tenant-person',
  'vendor',
  'lead',
  'deal',
  'ticket',
  'kra-filing',
  'campaign',
  'process-step',
  'recommendation',
  'internal-staff',
  'arrears',
] as const;

export type SeededEntityType = (typeof SEEDED_ENTITY_TYPES)[number];

/**
 * The headline sample views — each demonstrates a different
 * `view_kind` so the renderer test suite can pin every kind end
 * to end.
 */
export const HEADLINE_VIEWS: readonly TabView<unknown, unknown>[] = Object.freeze([
  EmployeeTableView as unknown as TabView<unknown, unknown>,
  PropertyKpiGridView as unknown as TabView<unknown, unknown>,
  LeaseTimelineView as unknown as TabView<unknown, unknown>,
  ArrearsTableView as unknown as TabView<unknown, unknown>,
  KraFilingProfileCardView as unknown as TabView<unknown, unknown>,
  RecommendationListView as unknown as TabView<unknown, unknown>,
]);

/**
 * Build the seed registry — 6 headline views + 9 placeholder views
 * covering the remaining seeded entity types so every default
 * entity_type has at least one registered view.
 *
 * Entity types already covered by headline views:
 *   employee, property, lease, arrears (custom), kra-filing,
 *   recommendation
 *
 * Placeholder views fill in for:
 *   customer-owner, tenant-person, vendor, lead, deal, ticket,
 *   campaign, process-step, internal-staff
 */
export function createSeedTabViewRegistry(): TabViewRegistry {
  const covered = new Set(HEADLINE_VIEWS.map((v) => v.entity_type));
  const placeholders: TabView<unknown, unknown>[] = SEEDED_ENTITY_TYPES.filter(
    (t) => !covered.has(t),
  ).map((t) => buildPlaceholderView(t) as unknown as TabView<unknown, unknown>);
  return new TabViewRegistry().registerAll([...HEADLINE_VIEWS, ...placeholders]);
}
