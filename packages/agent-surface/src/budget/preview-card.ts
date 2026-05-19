/**
 * `BudgetPreviewCard` builder — emits an AG-UI part for the chat
 * surface, rendered as an "approve / deny" card before a multi-step
 * action runs.
 *
 * The shape matches the `budget-preview-card` schema registered in
 * `packages/genui/src/schemas/index.ts`.
 */

import type { ActionEstimate } from './types.js';

export interface BudgetPreviewCardPart {
  readonly kind: 'budget-preview-card';
  readonly title?: string;
  readonly description: string;
  readonly costUsd: number;
  readonly seconds: number;
  readonly breakdown: ReadonlyArray<{
    readonly label: string;
    readonly costUsd: number;
    readonly cacheHit: boolean;
  }>;
  readonly cacheHitRateUsed: number;
  readonly monthlyRemainingUsd: number;
  readonly approveAction: string;
  readonly denyAction: string;
}

export function buildBudgetPreviewCard(args: {
  readonly estimate: ActionEstimate;
  readonly monthlyRemainingUsd: number;
  readonly approveAction: string;
  readonly denyAction: string;
  readonly title?: string;
}): BudgetPreviewCardPart {
  return {
    kind: 'budget-preview-card',
    ...(args.title ? { title: args.title } : {}),
    description: args.estimate.description,
    costUsd: args.estimate.costUsd,
    seconds: args.estimate.seconds,
    breakdown: args.estimate.breakdown.map((b) => ({
      label: b.label,
      costUsd: b.costUsd,
      cacheHit: b.cacheHit === true,
    })),
    cacheHitRateUsed: args.estimate.cacheHitRateUsed,
    monthlyRemainingUsd: args.monthlyRemainingUsd,
    approveAction: args.approveAction,
    denyAction: args.denyAction,
  };
}
