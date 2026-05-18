/**
 * PreToolUse: cost-circuit hook — denies a tool call when the per-tenant
 * USD spend in the rolling window would breach the configured ceiling.
 *
 * Mirrors the existing `cost-circuit-breaker.ts` semantics in
 * `@bossnyumba/ai-copilot/security` but lives at the orchestrator layer
 * so the hook can short-circuit BEFORE the tool runs (the existing
 * breaker is post-hoc accounting). The breaker port is injectable so
 * this package stays dep-free.
 */

import type { Decision } from '../../decision.js';
import type { HookContext, HookResult, PreToolUseHook } from '../../hook-chain.js';

// ─────────────────────────────────────────────────────────────────────
// Port
// ─────────────────────────────────────────────────────────────────────

export interface CostCircuitPort {
  /** Returns the projected spend including this call's estimate. */
  project(args: {
    readonly tenantId: string;
    readonly estimatedCostUsd: number;
  }): Promise<{ readonly projectedUsd: number; readonly ceilingUsd: number }>;
}

export interface CostCircuitHookDeps {
  readonly breaker: CostCircuitPort;
}

// ─────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────

export function createCostCircuitHook(
  deps: CostCircuitHookDeps,
): PreToolUseHook {
  return {
    name: 'cost-circuit',
    stage: 'pre-tool-use',
    async fn(ctx: HookContext, decision: Decision): Promise<HookResult> {
      if (decision.kind !== 'tool_call') return { kind: 'allow' };
      const tenantId =
        ctx.scope.kind === 'platform' ? '_platform' : ctx.scope.tenantId;
      const estimate = decision.call.estimatedCostUsd ?? 0;
      const projection = await deps.breaker.project({
        tenantId,
        estimatedCostUsd: estimate,
      });
      if (projection.projectedUsd <= projection.ceilingUsd) {
        return { kind: 'allow' };
      }
      return {
        kind: 'deny',
        code: 'cost-ceiling-breach',
        reason: `tool '${decision.call.toolName}' would push spend to $${projection.projectedUsd.toFixed(2)} (ceiling $${projection.ceilingUsd.toFixed(2)})`,
      };
    },
  };
}
