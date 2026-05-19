/**
 * createCanUseTool — factory that wraps a caller's policy decision
 * with persistent-rule lookup. The returned function is the universal
 * approval gateway, used by the kernel.
 *
 * Flow:
 *
 *   1. List matching rules from the store (scope-aware).
 *   2. For each rule, evaluate its predicate against the args.
 *      First match wins. Deny rules win over allow rules within the
 *      same scope (defense-in-depth — explicit deny beats implicit).
 *   3. If no rule matches, defer to `policy(toolName, args, ctx)`.
 *   4. Return the resulting `PermissionDecision`.
 *
 * Persisting a NEW rule (when the UI accepts a suggestion) is a
 * separate call: `persistPermissionUpdate(...)` below.
 */

import { evaluatePredicate } from './predicate.js';
import type {
  CanUseToolContext,
  CanUseToolFn,
  PermissionRuleStorePort,
} from './types.js';
import type {
  PermissionDecision,
  PermissionRuleEntity,
  PermissionUpdate,
} from '../types.js';

export interface CanUseToolDeps {
  readonly store: PermissionRuleStorePort;
  readonly policy: CanUseToolFn;
}

export function createCanUseTool(deps: CanUseToolDeps): CanUseToolFn {
  return async (
    toolName: string,
    args: Readonly<Record<string, unknown>>,
    ctx: CanUseToolContext,
  ): Promise<PermissionDecision> => {
    const rules = await deps.store.list({
      toolName,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
    });

    const matched = rules.filter((r) => evaluatePredicate(r.predicate, { args }));
    const denyHit = matched.find((r) => r.verdict === 'deny');
    if (denyHit) {
      return {
        kind: 'deny',
        message:
          denyHit.reason ??
          `denied by persisted permission rule (scope='${denyHit.scope}')`,
      };
    }
    const allowHit = matched.find((r) => r.verdict === 'allow');
    if (allowHit) {
      return { kind: 'allow' };
    }

    return deps.policy(toolName, args, ctx);
  };
}

/**
 * Persist a `PermissionUpdate` accepted by the owner via the UI.
 * Returns the created `PermissionRuleEntity`.
 *
 * Scope rules:
 *   - `session` => sessionId set; tenantId+userId null
 *   - `tenant`  => tenantId set;  userId+sessionId null
 *   - `forever` => userId set;    tenantId+sessionId null
 */
export async function persistPermissionUpdate(
  update: PermissionUpdate,
  ctx: CanUseToolContext,
  store: PermissionRuleStorePort,
): Promise<PermissionRuleEntity> {
  const scopeFields = scopeFieldsFor(update.scope, ctx);
  return store.put({
    scope: update.scope,
    tenantId: scopeFields.tenantId,
    userId: scopeFields.userId,
    sessionId: scopeFields.sessionId,
    toolName: update.toolName,
    predicate: update.predicate ?? null,
    verdict: 'allow',
    reason: update.reason ?? null,
  });
}

function scopeFieldsFor(
  scope: PermissionUpdate['scope'],
  ctx: CanUseToolContext,
): {
  readonly tenantId: string | null;
  readonly userId: string | null;
  readonly sessionId: string | null;
} {
  switch (scope) {
    case 'session':
      return { tenantId: null, userId: null, sessionId: ctx.sessionId };
    case 'tenant':
      return { tenantId: ctx.tenantId, userId: null, sessionId: null };
    case 'forever':
      return { tenantId: null, userId: ctx.userId, sessionId: null };
  }
}
