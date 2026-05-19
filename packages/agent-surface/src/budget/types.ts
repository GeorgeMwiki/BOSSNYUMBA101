/**
 * Budget + Time Boxes (R2 #9).
 *
 * Three nested scopes:
 *
 *   tenant     monthly cap  — hard stop when reached.
 *   conversation  optional cap — soft warn at 90%, optional hard stop.
 *   action     pre-execution estimate + approve/deny.
 *
 * The integration with K-D prefix-cache:
 *   each `CostLine` carries `cacheHit`. When estimating an action, the
 *   estimator multiplies projected tokens by an "expected cache hit
 *   rate" (a sliding-window observed value, exposed as
 *   `BudgetMonitor.observedCacheHitRate()`). This keeps the preview
 *   honest — repeat actions get cheaper projections.
 */

import type { CostLine, Result } from '../types.js';

export type Currency = 'USD';

export interface BudgetCaps {
  /** Monthly cap per tenant. Required. */
  readonly tenantMonthlyUsd: number;
  /** Optional per-conversation cap. */
  readonly conversationUsd?: number;
  /** Soft-warn threshold as a fraction in (0, 1). Default 0.9. */
  readonly warnAt?: number;
}

export interface ActionEstimate {
  readonly description: string;
  /** Estimated total cost in USD. */
  readonly costUsd: number;
  /** Estimated wall-time in seconds. */
  readonly seconds: number;
  /** Cost breakdown — at least one entry. */
  readonly breakdown: ReadonlyArray<CostLine>;
  /**
   * Observed cache hit rate that was used to discount the estimate.
   * Surfaced so the UI can show "based on 73% cache hit rate".
   */
  readonly cacheHitRateUsed: number;
}

export interface BudgetState {
  readonly tenantId: string;
  readonly periodStartIso: string;
  readonly tenantSpentUsd: number;
  readonly tenantCapUsd: number;
  readonly conversations: Readonly<Record<string, number>>;
  readonly observedCacheHitRate: number;
  /** Has the tenant hit its monthly cap? */
  readonly tenantOver: boolean;
}

export type BudgetEvent =
  | { readonly kind: 'spend'; readonly conversationId: string; readonly costUsd: number; readonly at: Date }
  | { readonly kind: 'estimate'; readonly conversationId: string; readonly estimate: ActionEstimate; readonly at: Date }
  | { readonly kind: 'approval'; readonly conversationId: string; readonly approved: boolean; readonly at: Date }
  | { readonly kind: 'cap-reached'; readonly conversationId?: string; readonly at: Date };

export type BudgetError =
  | { readonly kind: 'tenant-cap-reached'; readonly capUsd: number; readonly spentUsd: number }
  | { readonly kind: 'conversation-cap-reached'; readonly capUsd: number; readonly spentUsd: number }
  | { readonly kind: 'estimate-rejected'; readonly reason: string };

export type ApproveSpendResult = Result<{ readonly newState: BudgetState }, BudgetError>;
