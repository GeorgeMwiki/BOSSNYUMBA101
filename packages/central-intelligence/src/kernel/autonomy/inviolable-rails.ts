/**
 * Mr. Mwikila — inviolable safety rails for autonomous actions
 * (real-estate retailored, multi-currency aware).
 *
 * These are hard-coded refusals the kernel issues BEFORE any
 * autonomous handler executes. They override every owner-set
 * delegation tier (even T3) because they enforce CLAUDE.md hard
 * rules + landlord regulatory constraints.
 *
 * The six rails:
 *
 *   1. Kill-switch — fail-closed first. CLAUDE.md hard rule.
 *
 *   2. Family-member discipline / hire / fire — owner-only. Mwikila
 *      will not autonomously act on family-relation HR.
 *
 *   3. Non-domestic-currency contracts — post-Mar-2026 USD-cliff
 *      remediation. Owner contracts MUST be in domestic currency for
 *      the tenant's jurisdiction (TZS/KES/UGX/etc.). USD-denominated
 *      domestic rent / payroll / contractor invoices are refused.
 *
 *   4. Monthly money-out envelope — every autonomous action that moves
 *      money above the per-tenant envelope (or platform default) is
 *      refused. Owner must approve via four-eye flow.
 *
 *   5. Capex over envelope — same as (4) but specific to capex
 *      categories. The envelope_threshold is the inviolable cap; even
 *      T3 cannot exceed it.
 *
 *   6. Eviction-initial-notice — legal action. Mr. Mwikila never
 *      autonomously initiates the eviction ladder. T0 only.
 *
 * Deterministic — no LLM. Pure functions of the action descriptor and
 * the owner config.
 *
 * Ported from Borjie packages/central-intelligence/src/kernel/autonomy/
 * inviolable-rails.ts.
 */

import type { DelegationCategory } from './types.js';

/** Platform-wide default envelope cap in tenant's domestic currency. */
export const DEFAULT_MONTHLY_ENVELOPE = 5_000_000;

export const INVIOLABLE_REASONS = [
  'kill_switch_open',
  'family_member_target',
  'non_domestic_currency',
  'envelope_exceeded',
  'capex_over_envelope',
  'eviction_autonomy_refused',
] as const;

export type InviolableReason = (typeof INVIOLABLE_REASONS)[number];

export interface InviolableVerdictAutonomy {
  readonly status: 'pass' | 'block';
  readonly reason?: InviolableReason;
  readonly humanReadable?: string;
  readonly humanReadableSw?: string;
}

/**
 * Descriptor of the autonomous action the handler is about to take.
 * The handler builds this before calling `checkAutonomyInviolable`.
 *
 * `domesticCurrency` is the tenant's jurisdiction's primary currency
 * (looked up via jurisdiction-resolver). When the action is money-
 * moving and `currency !== domesticCurrency`, the non-domestic rail
 * blocks.
 */
export interface AutonomyActionDescriptor {
  readonly category: DelegationCategory;
  /**
   * Money out (in `currency`) if any. Zero or negative when no money
   * moves. payroll / inventory / capex / rent handlers populate this;
   * informational handlers (reminders / lease-renewal-draft) leave it 0.
   */
  readonly amount: number;
  /** ISO-4217 currency code of the moved amount. */
  readonly currency: string;
  /** Tenant's domestic currency for cliff check. */
  readonly domesticCurrency: string;
  /**
   * When the action targets people, the role they hold relative to
   * the owner. 'family' triggers the family-member rail.
   */
  readonly targetRelation?: 'family' | 'staff' | 'tenant' | 'counterparty' | null;
  /** Resolved per-category envelope (currency = envelopeThresholdCurrency). */
  readonly envelopeThreshold: number | null;
  /** True when the platform kill-switch is open. */
  readonly killSwitchOpen: boolean;
}

/**
 * The six inviolable rails. Order matters — kill-switch wins first,
 * then family, then currency, then envelope guards, then eviction.
 */
export function checkAutonomyInviolable(
  d: AutonomyActionDescriptor,
): InviolableVerdictAutonomy {
  // 1. Kill-switch — fail-closed first.
  if (d.killSwitchOpen) {
    return {
      status: 'block',
      reason: 'kill_switch_open',
      humanReadable:
        'Platform kill-switch is open. Mr. Mwikila will not act autonomously.',
      humanReadableSw:
        'Swichi ya dharura iko wazi. Mr. Mwikila hatachukua hatua peke yake.',
    };
  }

  // 2. Family-member target.
  if (d.targetRelation === 'family') {
    return {
      status: 'block',
      reason: 'family_member_target',
      humanReadable:
        'Family-member HR is owner-only. Mr. Mwikila will not act here.',
      humanReadableSw:
        'Maamuzi ya kifamilia ni ya mwenye nyumba pekee. Mr. Mwikila hatachukua hatua.',
    };
  }

  // 6. Eviction autonomy refusal — legal escalation, owner only.
  if (d.category === 'evictions-initial-notice') {
    return {
      status: 'block',
      reason: 'eviction_autonomy_refused',
      humanReadable:
        'Eviction initial notices are legal. Mr. Mwikila will never autonomously initiate the eviction ladder — owner must act.',
      humanReadableSw:
        'Notisi ya kuondoa mpangaji ni hatua ya kisheria. Mr. Mwikila hatachukua hatua hii peke yake.',
    };
  }

  // 3. Non-domestic currency.
  if (d.amount > 0 && d.currency !== d.domesticCurrency) {
    return {
      status: 'block',
      reason: 'non_domestic_currency',
      humanReadable: `Domestic non-${d.domesticCurrency} currency contracts are refused (USD-cliff remediation).`,
      humanReadableSw: `Mikataba ya nyumbani kwa sarafu nyingine isipokuwa ${d.domesticCurrency} hairuhusiwi.`,
    };
  }

  const envelope = d.envelopeThreshold ?? DEFAULT_MONTHLY_ENVELOPE;

  // 5. Capex-specific cap.
  if (d.category === 'capex' && d.amount > envelope) {
    return {
      status: 'block',
      reason: 'capex_over_envelope',
      humanReadable:
        'Capex above the monthly envelope is owner-only — Mr. Mwikila will not act.',
      humanReadableSw:
        'Matumizi makubwa zaidi ya kiasi cha mwezi ni ya mwenye nyumba pekee.',
    };
  }

  // 4. Generic money-out cap.
  if (d.amount > envelope) {
    return {
      status: 'block',
      reason: 'envelope_exceeded',
      humanReadable:
        'Action exceeds the monthly money-out envelope — owner approval required.',
      humanReadableSw:
        'Hatua inazidi kiwango cha pesa cha mwezi - idhini ya mwenye nyumba inahitajika.',
    };
  }

  return { status: 'pass' };
}
