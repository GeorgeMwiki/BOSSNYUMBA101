/**
 * Mr. Mwikila autonomous-MD framework — kernel slice public surface.
 *
 * Real-estate retailored. Composition:
 *
 *   import { autonomy } from '@bossnyumba/central-intelligence';
 *
 *   const delegation = autonomy.resolveDelegation(prefRow, 'rent-scheduling');
 *   if (delegation.tier === 'T0' || delegation.tier === 'T1') {
 *     // propose-only — queue an inbox row, do not execute.
 *   }
 *   const verdict = autonomy.checkAutonomyInviolable({
 *     category: 'rent-scheduling',
 *     amount: 0,
 *     currency: 'TZS',
 *     domesticCurrency: 'TZS',
 *     envelopeThreshold: delegation.envelopeThreshold,
 *     killSwitchOpen,
 *   });
 *   if (verdict.status === 'block') {
 *     // queue inbox row with status='blocked_by_inviolable'.
 *   }
 */

export {
  DELEGATION_CATEGORIES,
  DELEGATION_TIERS,
  ACTION_STATUSES,
  CATEGORY_DEFAULT_TIER,
  CATEGORY_DEFAULT_REVERSAL_HOURS,
  tierRank,
  effectiveTier,
  resolveDelegation,
  tierAllowsImmediateExecution,
  tierAllowsReversal,
  type DelegationCategory,
  type DelegationTier,
  type ActionStatus,
  type DelegationPref,
  type ResolvedDelegation,
} from './types.js';

export {
  DEFAULT_MONTHLY_ENVELOPE,
  INVIOLABLE_REASONS,
  checkAutonomyInviolable,
  type InviolableReason,
  type InviolableVerdictAutonomy,
  type AutonomyActionDescriptor,
} from './inviolable-rails.js';
