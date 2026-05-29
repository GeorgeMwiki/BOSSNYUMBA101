/**
 * Mr. Mwikila autonomous-MD framework — shared types (real-estate).
 *
 * The kernel slice that lets Mr. Mwikila act on the owner's behalf
 * under owner-defined delegation tiers.
 *
 *   T0  inform-only        owner does the action
 *   T1  propose             owner one-tap approves
 *   T2  act-with-reversal   reversible within reversal_window_hours
 *   T3  irrevocable          rare; owner explicitly elevated
 *
 * Ported from Borjie packages/central-intelligence/src/kernel/autonomy/
 * types.ts. Real-estate retailored:
 *   - 12 categories matched to BossNyumba domain: rent-scheduling,
 *     regulatory-filings, lease-renewals, payroll-prep,
 *     listing-counter-offers, maintenance-approvals-low-value,
 *     tenant-communications, evictions-initial-notice, capex,
 *     inventory, marketplace-listings, contractor-engagement.
 *   - Mirrors SQL CHECK in 0290 + 0291.
 *
 * No I/O in this module. Pure types + helper functions.
 */

/**
 * Twelve real-estate delegation categories — MUST mirror the SQL CHECK
 * in migrations 0290 + 0291.
 */
export const DELEGATION_CATEGORIES = [
  'rent-scheduling',
  'regulatory-filings',
  'lease-renewals',
  'payroll-prep',
  'listing-counter-offers',
  'maintenance-approvals-low-value',
  'tenant-communications',
  'evictions-initial-notice',
  'capex',
  'inventory',
  'marketplace-listings',
  'contractor-engagement',
] as const;

export type DelegationCategory = (typeof DELEGATION_CATEGORIES)[number];

export const DELEGATION_TIERS = ['T0', 'T1', 'T2', 'T3'] as const;

export type DelegationTier = (typeof DELEGATION_TIERS)[number];

export const ACTION_STATUSES = [
  'proposed',
  'owner_approved',
  'owner_denied',
  'executed',
  'reversed',
  'committed',
  'blocked_by_inviolable',
  'expired',
] as const;

export type ActionStatus = (typeof ACTION_STATUSES)[number];

/**
 * Per-category default tier. Conservative — the inboxed handler always
 * picks the SAFER of (owner-set tier, category default). The owner
 * explicitly raises the tier if they want more autonomy.
 *
 * Defaults reasoning (real-estate):
 *   - rent-scheduling          T2 — drafting next-month invoice is reversible.
 *   - regulatory-filings       T1 — propose; owner approves before submission.
 *   - lease-renewals           T1 — sensitive counterparty interaction.
 *   - payroll-prep             T1 — money-out, owner reviews.
 *   - listing-counter-offers   T2 — fast-moving market with 4h reversal.
 *   - maintenance-approvals-low-value  T2 — under envelope cap; reversible.
 *   - tenant-communications    T2 — operational comms can be reversed.
 *   - evictions-initial-notice T0 — legal; owner only.
 *   - capex                    T0 — large money-out; owner only.
 *   - inventory                T2 — reorder draft, reversible.
 *   - marketplace-listings     T1 — propose listing, owner approves.
 *   - contractor-engagement    T1 — counterparty; owner approves.
 */
export const CATEGORY_DEFAULT_TIER: Readonly<
  Record<DelegationCategory, DelegationTier>
> = Object.freeze({
  'rent-scheduling': 'T2',
  'regulatory-filings': 'T1',
  'lease-renewals': 'T1',
  'payroll-prep': 'T1',
  'listing-counter-offers': 'T2',
  'maintenance-approvals-low-value': 'T2',
  'tenant-communications': 'T2',
  'evictions-initial-notice': 'T0',
  capex: 'T0',
  inventory: 'T2',
  'marketplace-listings': 'T1',
  'contractor-engagement': 'T1',
});

/**
 * Default reversal window per category (hours).
 *
 * - 4h for listing-counter-offers because counterparties may rely on
 *   the price quickly.
 * - 24h for the rest.
 */
export const CATEGORY_DEFAULT_REVERSAL_HOURS: Readonly<
  Record<DelegationCategory, number>
> = Object.freeze({
  'rent-scheduling': 24,
  'regulatory-filings': 24,
  'lease-renewals': 24,
  'payroll-prep': 24,
  'listing-counter-offers': 4,
  'maintenance-approvals-low-value': 24,
  'tenant-communications': 24,
  'evictions-initial-notice': 24,
  capex: 24,
  inventory: 24,
  'marketplace-listings': 24,
  'contractor-engagement': 24,
});

/**
 * Owner-set delegation preference (one row in `owner_delegation_prefs`).
 * Multi-currency: envelopeThreshold paired with envelopeThresholdCurrency.
 */
export interface DelegationPref {
  readonly tenantId: string;
  readonly category: DelegationCategory;
  readonly tier: DelegationTier;
  readonly reversalWindowHours: number | null;
  readonly envelopeThreshold: number | null;
  readonly envelopeThresholdCurrency: string;
  readonly setByUserId: string | null;
  readonly setAt: string;
  readonly notes: string | null;
}

/**
 * Resolved (effective) delegation for a category. Either an owner-set
 * row or the safe default. The handler always reads through `resolve`
 * — never from the raw table — so the safest of (owner, default) wins.
 */
export interface ResolvedDelegation {
  readonly category: DelegationCategory;
  readonly tier: DelegationTier;
  readonly reversalWindowHours: number;
  readonly envelopeThreshold: number | null;
  readonly envelopeThresholdCurrency: string;
  readonly source: 'owner' | 'default';
}

/**
 * Tier-rank helper — higher number = more autonomy.
 */
export function tierRank(tier: DelegationTier): 0 | 1 | 2 | 3 {
  switch (tier) {
    case 'T0':
      return 0;
    case 'T1':
      return 1;
    case 'T2':
      return 2;
    case 'T3':
      return 3;
  }
}

/**
 * Compose the effective tier of (owner-set, category default). When
 * the owner has no preference for the category, the default wins.
 */
export function effectiveTier(
  ownerTier: DelegationTier | null,
  category: DelegationCategory,
): DelegationTier {
  if (ownerTier === null) return CATEGORY_DEFAULT_TIER[category];
  return ownerTier;
}

/**
 * Resolved-delegation factory. Pass the per-tenant row from the DB
 * (or null when no override) and the category.
 */
export function resolveDelegation(
  pref: DelegationPref | null,
  category: DelegationCategory,
): ResolvedDelegation {
  if (pref === null || pref.category !== category) {
    return Object.freeze({
      category,
      tier: CATEGORY_DEFAULT_TIER[category],
      reversalWindowHours: CATEGORY_DEFAULT_REVERSAL_HOURS[category],
      envelopeThreshold: null,
      envelopeThresholdCurrency: 'TZS',
      source: 'default',
    });
  }
  const tier = effectiveTier(pref.tier, category);
  const reversalWindowHours =
    pref.reversalWindowHours ?? CATEGORY_DEFAULT_REVERSAL_HOURS[category];
  return Object.freeze({
    category,
    tier,
    reversalWindowHours,
    envelopeThreshold: pref.envelopeThreshold,
    envelopeThresholdCurrency: pref.envelopeThresholdCurrency,
    source: 'owner',
  });
}

/**
 * Is the resolved tier permissive enough for Mwikila to execute
 * without waiting for owner approval? True for T2 and T3.
 */
export function tierAllowsImmediateExecution(tier: DelegationTier): boolean {
  return tier === 'T2' || tier === 'T3';
}

/**
 * Is the resolved tier reversible by the owner? True only for T2.
 */
export function tierAllowsReversal(tier: DelegationTier): boolean {
  return tier === 'T2';
}
