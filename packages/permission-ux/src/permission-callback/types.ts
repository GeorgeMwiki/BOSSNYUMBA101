/**
 * canUseTool + PermissionUpdate persistence — type vocabulary.
 *
 * The `canUseTool` callback is the universal approval gateway. It
 * sits between the kernel's `evaluatePermissionMode(...)` (Claude
 * Code's six-mode evaluator, already shipped) and the tool executor.
 *
 * Pattern (canonical, per R1 §K.7):
 *
 *   1. Kernel evaluates permission mode -> if `ask`, calls
 *      `canUseTool(name, args, ctx)`.
 *   2. `canUseTool` looks up persisted rules in the J1 entity-store.
 *   3. If a rule matches, the rule's verdict is returned directly.
 *   4. Otherwise, falls back to the caller's policy callback.
 *   5. If the policy allows + carries `suggestions`, the UI shows
 *      "yes, don't ask me again" buttons. On click, the suggestion
 *      becomes a persisted `permission_rule` entity in J1.
 */

import type {
  PermissionDecision,
  PermissionRuleEntity,
  PermissionScope,
  PermissionUpdate,
} from '../types.js';

export type { PermissionDecision, PermissionUpdate, PermissionScope } from '../types.js';

export interface CanUseToolContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly sessionId: string;
  /** AbortSignal so long-running approvals can cancel. */
  readonly signal?: AbortSignal;
  /**
   * Free-form trace identifier the J9 chat-workspace sets so the
   * decision can be threaded onto a specific approval card. Carried
   * through as a context value; the substrate doesn't interpret it.
   */
  readonly approvalCardId?: string;
}

export type CanUseToolFn = (
  toolName: string,
  args: Readonly<Record<string, unknown>>,
  ctx: CanUseToolContext,
) => Promise<PermissionDecision>;

// ─────────────────────────────────────────────────────────────────────
// Persistence port — wired by the caller to J1 entity-store.
// ─────────────────────────────────────────────────────────────────────

export interface PermissionRuleStorePort {
  /** Persist a new rule. Returns the created entity. */
  put(rule: NewPermissionRule): Promise<PermissionRuleEntity>;
  /** List rules that potentially apply at the given lookup scope. */
  list(query: PermissionRuleQuery): Promise<ReadonlyArray<PermissionRuleEntity>>;
}

export interface NewPermissionRule {
  readonly scope: PermissionScope;
  readonly tenantId: string | null;
  readonly userId: string | null;
  readonly sessionId: string | null;
  readonly toolName: string;
  readonly predicate: Readonly<Record<string, unknown>> | null;
  readonly verdict: 'allow' | 'deny';
  readonly reason: string | null;
}

export interface PermissionRuleQuery {
  readonly toolName: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly sessionId: string;
}
