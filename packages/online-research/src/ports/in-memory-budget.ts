/**
 * In-memory `BudgetMonitorPort` — used for tests + dev.
 *
 * Production wires this against K-F's `BudgetMonitor` so the real
 * tenant/conversation tally is consulted. The in-memory version
 * supports:
 *
 *   - per-tenant monthly cap (denies after spentUsd >= capUsd)
 *   - per-conversation cap (denies + records cap-reached)
 *   - approval gating (returns `approval_required` when configured)
 *
 * The cap behaviour is intentionally narrower than K-F's — we only
 * need enough surface to exercise the orchestrator-worker control flow.
 */

import type {
  BudgetMonitorPort,
  BudgetPreflightInput,
  BudgetVerdict,
  BudgetRecordInput,
} from './index.js';

export interface InMemoryBudgetMonitorConfig {
  readonly tenantMonthlyCapUsd: number;
  readonly conversationCapUsd?: number;
  /** Initial spend, useful for seeding tests against a near-cap state. */
  readonly initialTenantSpentUsd?: number;
  /** Approval required when estimated cost is >= this many USD. */
  readonly approvalThresholdUsd?: number;
}

export function createInMemoryBudgetMonitor(
  config: InMemoryBudgetMonitorConfig,
): BudgetMonitorPort & {
  readonly tenantSpentUsd: () => number;
  readonly conversationSpentUsd: (conversationId: string) => number;
} {
  let tenantSpent = config.initialTenantSpentUsd ?? 0;
  const conversationSpends = new Map<string, number>();

  return {
    preflight: async (input: BudgetPreflightInput): Promise<BudgetVerdict> => {
      const projectedTenant = tenantSpent + input.estimatedCostUsd;
      if (projectedTenant > config.tenantMonthlyCapUsd) {
        return Object.freeze({ kind: 'denied', reason: 'tenant_cap' });
      }
      const convoSpent = conversationSpends.get(input.conversationId) ?? 0;
      const projectedConvo = convoSpent + input.estimatedCostUsd;
      if (
        config.conversationCapUsd !== undefined &&
        projectedConvo > config.conversationCapUsd
      ) {
        return Object.freeze({ kind: 'denied', reason: 'conversation_cap' });
      }
      if (
        input.requiresApproval ||
        (config.approvalThresholdUsd !== undefined && input.estimatedCostUsd >= config.approvalThresholdUsd)
      ) {
        return Object.freeze({
          kind: 'approval_required',
          remainingUsd: config.tenantMonthlyCapUsd - tenantSpent,
          previewToken: `prv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        });
      }
      return Object.freeze({
        kind: 'allowed',
        remainingUsd: config.tenantMonthlyCapUsd - tenantSpent,
      });
    },
    record: async (input: BudgetRecordInput) => {
      tenantSpent += input.actualCostUsd;
      const prior = conversationSpends.get(input.conversationId) ?? 0;
      conversationSpends.set(input.conversationId, prior + input.actualCostUsd);
    },
    tenantSpentUsd: () => tenantSpent,
    conversationSpentUsd: (conversationId: string) =>
      conversationSpends.get(conversationId) ?? 0,
  };
}
