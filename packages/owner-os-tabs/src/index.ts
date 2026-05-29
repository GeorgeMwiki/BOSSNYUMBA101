/**
 * `@bossnyumba/owner-os-tabs` — public surface (real-estate edition,
 * ported from Borjie's @borjie/owner-os-tabs).
 *
 * Contract package that lets ANY domain (Rent / Leases / Tenants /
 * Maintenance / HR / Ops / Finance / Risk / Compliance / Marketing /
 * Insurance / Procurement / Audit / Legal / Treasury / Marketplace /
 * Licences / anything) register itself as a spawnable tab in the
 * owner cockpit.
 *
 * Zero React deps — the consuming app maps `rendererId` to a component.
 *
 * Modules:
 *   - types            schemas + descriptor contract
 *   - scale-defaults   tier ladder T1..T5 with real-estate defaults
 */

export {
  OWNER_OS_TAB_TYPES,
  ownerOsTabTypeSchema,
  ownerOsTabContextSchema,
  ownerOsSpawnIntentSchema,
  ownerOsSpawnBatchSchema,
  ownerOsPersistedTabSchema,
  ownerOsTabsStateSchema,
  type OwnerOSBriefSlice,
  type OwnerOSIntentMatchers,
  type OwnerOSPersistedTab,
  type OwnerOSSpawnBatch,
  type OwnerOSSpawnIntent,
  type OwnerOSTabColor,
  type OwnerOSTabContext,
  type OwnerOSTabDescriptor,
  type OwnerOSTabIndicator,
  type OwnerOSTabsState,
  type OwnerOSTabType,
  type OwnerOSToolSuggestion,
} from './types.js';

export {
  SCALE_TIERS,
  SCALE_TIER_LABELS,
  autoDetectScaleTier,
  coerceScaleTier,
  defaultTabsFor,
  scaleTierLabel,
  type ScaleSignals,
  type ScaleTier,
  type ScaleTierLabel,
} from './scale-defaults.js';
