/**
 * Scale-aware default tab sets — BossNyumba real-estate edition.
 *
 * Ported from Borjie SC-2; tailored for real-estate portfolios.
 * BossNyumba supports ANY portfolio scale: a single-unit landlord sees a
 * 4-tab cockpit; a multi-country property group sees up to 20 tabs.
 * The tier is a single column on `tenants` (see migration 0274) and is
 * read on the very first cockpit render — never re-fetched per tab.
 *
 * Tier ladder (additive — every higher tier inherits everything below):
 *
 *   T1 single_unit      today's tasks · last rent · cash · chat            (4)
 *   T2 small_portfolio  + tenant roster · maintenance · weekly KPI         (7)
 *   T3 mid_tier         + manager dispatch · compliance cal · multi-prop  (11)
 *                       map · payroll
 *   T4 industrial       + finance · HR pipeline · regulator inbox ·       (16)
 *                       safety board · forecast
 *   T5 multi_country    + group KPI · FX consolidation · cross-border     (20)
 *                       settlement · multi-regulator view
 *
 * Tab ids reference `OwnerOSTabType`, the union the registry validates.
 * New tabs MUST be added to that union first.
 *
 * The defaulter is PURE — it never reads the registry. It returns the
 * ordered id list; the shell hydrates against the registry to render
 * labels / icons. This keeps the package zero-DI.
 *
 * Companion files:
 *   - packages/database (migration 0274 tenants.scale_tier)
 *   - apps/owner-portal/src/components/owner-os/OwnerOSShell.tsx (consumer)
 */

import type { OwnerOSTabType } from './types.js';

// ─── Tier union ─────────────────────────────────────────────────────

export const SCALE_TIERS = [
  't1_single_unit',
  't2_small_portfolio',
  't3_mid_tier',
  't4_industrial_property',
  't5_multi_country',
] as const;

export type ScaleTier = (typeof SCALE_TIERS)[number];

/**
 * Type-guard — narrows an arbitrary string to ScaleTier or returns the
 * safest fallback (t1_single_unit). Used at the brain / signup boundary
 * where we read free-form text out of `tenants.scale_tier`.
 */
export function coerceScaleTier(raw: string | null | undefined): ScaleTier {
  if (raw && (SCALE_TIERS as readonly string[]).includes(raw)) {
    return raw as ScaleTier;
  }
  return 't1_single_unit';
}

// ─── Tier-additive layers ───────────────────────────────────────────
//
// We list each tier as the DELTA above the previous one. The exported
// `defaultTabsFor(tier)` flattens the chain so callers never know about
// the layered shape.
//
// IMPORTANT: every id MUST exist in `OWNER_OS_TAB_TYPES` (types.ts) —
// adding a new tab type is one line there.

const T1_TABS: ReadonlyArray<OwnerOSTabType> = [
  'chat',
  // "Today's tasks" = a focused reminders panel
  'reminders',
  // "Last rent collected" = the rent tab
  'rent',
  // "Cash position" = treasury (cash-on-hand chart)
  'treasury',
];

const T2_DELTA: ReadonlyArray<OwnerOSTabType> = [
  // Small-portfolio gets the tenant roster
  'tenant-roster',
  // Maintenance queue
  'maintenance',
  // Weekly KPI = the standard insights surface
  'insights',
];

const T3_DELTA: ReadonlyArray<OwnerOSTabType> = [
  // Manager dispatch + multi-property map = the operational layer
  'manager-dispatch',
  'multi-property-map',
  // Compliance calendar
  'compliance-calendar',
  // Payroll
  'payroll',
];

const T4_DELTA: ReadonlyArray<OwnerOSTabType> = [
  // Full finance suite already on; add accounting + HR pipeline + risk +
  // regulator inbox, safety board, forecast surfaces.
  'finance',
  'hr',
  'regulator-inbox',
  'safety-board',
  'forecast',
];

const T5_DELTA: ReadonlyArray<OwnerOSTabType> = [
  // Multi-tenant / cross-border group surfaces
  'group-kpi',
  'currency-consolidation',
  'cross-border-settlement',
  'multi-regulator-view',
];

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Return the ordered tab ids the owner cockpit should render by default
 * for a given scale tier. The returned array is frozen — callers MUST
 * NOT mutate it (per project immutability rules).
 *
 * Sizes per spec:
 *   T1  4  T2  7  T3 11  T4 16  T5 20
 */
export function defaultTabsFor(tier: ScaleTier): ReadonlyArray<OwnerOSTabType> {
  switch (tier) {
    case 't1_single_unit':
      return T1_TABS;
    case 't2_small_portfolio':
      return Object.freeze([...T1_TABS, ...T2_DELTA] as const);
    case 't3_mid_tier':
      return Object.freeze([
        ...T1_TABS,
        ...T2_DELTA,
        ...T3_DELTA,
      ] as const);
    case 't4_industrial_property':
      return Object.freeze([
        ...T1_TABS,
        ...T2_DELTA,
        ...T3_DELTA,
        ...T4_DELTA,
      ] as const);
    case 't5_multi_country':
      return Object.freeze([
        ...T1_TABS,
        ...T2_DELTA,
        ...T3_DELTA,
        ...T4_DELTA,
        ...T5_DELTA,
      ] as const);
  }
}

/**
 * Bilingual human label for a tier — used in the marketing site, the
 * /signup wizard summary card, and admin-portal tenant detail.
 * Swahili-first per BossNyumba convention.
 */
export interface ScaleTierLabel {
  readonly tier: ScaleTier;
  readonly labelEn: string;
  readonly labelSw: string;
  readonly descriptionEn: string;
  readonly descriptionSw: string;
  /** Marketing billing-tier hint — NOT billing logic. */
  readonly billingHint:
    | 'free_pilot'
    | 'starter'
    | 'growth'
    | 'enterprise'
    | 'multi_region';
}

export const SCALE_TIER_LABELS: ReadonlyArray<ScaleTierLabel> = Object.freeze([
  {
    tier: 't1_single_unit',
    labelEn: 'Single unit',
    labelSw: 'Nyumba moja',
    descriptionEn: '1 property / unit, owner operates directly.',
    descriptionSw: 'Mali moja / chumba kimoja, mwenye ndiye msimamizi.',
    billingHint: 'free_pilot',
  },
  {
    tier: 't2_small_portfolio',
    labelEn: 'Small portfolio',
    labelSw: 'Mali chache',
    descriptionEn: '2-15 properties, weekly tenant + maintenance ops.',
    descriptionSw: 'Mali 2-15, shughuli za wapangaji na ukarabati kila wiki.',
    billingHint: 'starter',
  },
  {
    tier: 't3_mid_tier',
    labelEn: 'Mid-tier portfolio',
    labelSw: 'Mali za kati',
    descriptionEn: '15-150 properties, manager dispatch, compliance calendar.',
    descriptionSw: 'Mali 15-150, mgawanyo wa mameneja, kalenda ya uzingativu.',
    billingHint: 'growth',
  },
  {
    tier: 't4_industrial_property',
    labelEn: 'Industrial property',
    labelSw: 'Mali za viwanda',
    descriptionEn:
      '150-1500 properties, multi-region, full compliance teams.',
    descriptionSw:
      'Mali 150-1500, mikoa mingi, timu kamili za uzingativu.',
    billingHint: 'enterprise',
  },
  {
    tier: 't5_multi_country',
    labelEn: 'Multi-country group',
    labelSw: 'Kundi la nchi nyingi',
    descriptionEn: 'Cross-border group, multi-currency consolidation.',
    descriptionSw: 'Kundi la nchi mbalimbali, fedha za aina nyingi.',
    billingHint: 'multi_region',
  },
] as const);

/**
 * Look up the bilingual label / hint for a tier. Returns the T1 label
 * as a safe fallback if the tier string is unknown.
 */
export function scaleTierLabel(tier: ScaleTier): ScaleTierLabel {
  const hit = SCALE_TIER_LABELS.find((l) => l.tier === tier);
  return hit ?? SCALE_TIER_LABELS[0]!;
}

// ─── Auto-detect from wizard signals ────────────────────────────────

/**
 * Signal tuple the owner sign-up wizard captures. The fields are all
 * voluntary; missing values are treated as "small" (the most defensive
 * default — a single-unit landlord).
 */
export interface ScaleSignals {
  /** Number of properties / units the owner operates. */
  readonly propertyCount?: number;
  /** Number of distinct geographic regions covered. */
  readonly regionCount?: number;
  /** Number of staff on payroll. */
  readonly staffCount?: number;
  /** True when the org operates in more than one country. */
  readonly crossBorder?: boolean;
}

/**
 * Compute a tier from the signup-wizard signals. The order of checks
 * matters — we test from the top (most-permissive) down so an org with
 * 200 properties AND cross-border ends at T5, not T4.
 *
 * Numbers come from the spec:
 *   1-1 → T1, 2-15 → T2, 15-150 → T3, 150-1500 → T4, +cross-border → T5
 *
 * `regionCount` ≥ 3 forces at LEAST T3 (multi-region) even with a small
 * portfolio — the multi-region cockpit is what makes the tab set worth
 * paying for.
 */
export function autoDetectScaleTier(signals: ScaleSignals): ScaleTier {
  const properties = Math.max(0, signals.propertyCount ?? 1);
  const regions = Math.max(1, signals.regionCount ?? 1);
  const crossBorder = signals.crossBorder === true;

  if (crossBorder) return 't5_multi_country';
  if (properties > 150) return 't4_industrial_property';
  if (properties > 15 || regions > 3) return 't3_mid_tier';
  if (properties > 1) return 't2_small_portfolio';
  return 't1_single_unit';
}
