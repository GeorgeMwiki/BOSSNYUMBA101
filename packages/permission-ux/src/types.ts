/**
 * @bossnyumba/permission-ux — shared public types.
 *
 * Cross-module type vocabulary. Every module re-exports its own
 * surface; this file is the canonical home for cross-cutting shapes.
 */

/**
 * Risk tier — string-literal union mirroring the kernel's
 * `risk-tier.ts`. Repeated here so this substrate has no direct
 * import dependency on @bossnyumba/central-intelligence.
 */
export type RiskTier =
  | 'read'
  | 'mutate'
  | 'destroy'
  | 'billing'
  | 'external-comm';

/**
 * The agent's permission posture for a single proposed tool call.
 * Mirrors the Claude Code `auto` mode classifier verdict.
 */
export type AutoModeVerdict = 'safe' | 'borderline' | 'unsafe';

/**
 * Persistence scope for a `PermissionUpdate`.
 *
 *   - `session`  — applies for the rest of the current chat session.
 *   - `tenant`   — applies for the tenant going forward (all users +
 *                  all future sessions).
 *   - `forever`  — applies for the user-account, persisted on this
 *                  device + propagated cross-device on next login.
 */
export type PermissionScope = 'session' | 'tenant' | 'forever';

/**
 * One persistable "yes don't ask again" rule. Carried inside a
 * `PermissionDecision` as a suggestion the UI may accept or discard.
 *
 *   - `kind: 'persist-allow'` — store as an always-allow rule.
 *   - `predicate` (optional)  — a narrow shape that must match for the
 *     rule to apply. e.g. `{ "args.tenantId": "11111..." }`. Absent
 *     predicate = matches every invocation of `toolName`.
 */
export interface PermissionUpdate {
  readonly kind: 'persist-allow';
  readonly scope: PermissionScope;
  readonly toolName: string;
  readonly predicate?: Readonly<Record<string, unknown>>;
  readonly reason?: string;
}

/**
 * `canUseTool` callback return value.
 *
 *   - `'allow'` — proceed.
 *   - `'deny'`  — block. The `message` is shown to the model so it
 *     can pivot.
 *   - `{ allow: true, suggestions }` — proceed; the UI may offer the
 *     `suggestions` to the owner as "yes don't ask me again" options.
 */
export type PermissionDecision =
  | { readonly kind: 'allow' }
  | { readonly kind: 'deny'; readonly message: string }
  | {
      readonly kind: 'allow-with-suggestions';
      readonly suggestions: ReadonlyArray<PermissionUpdate>;
    };

/**
 * Wire-friendly mirror of the `permission_rule` entity that J1 stores.
 */
export interface PermissionRuleEntity {
  readonly id: string;
  readonly type: 'permission_rule';
  readonly scope: PermissionScope;
  readonly tenantId: string | null;
  readonly userId: string | null;
  readonly sessionId: string | null;
  readonly toolName: string;
  readonly predicate: Readonly<Record<string, unknown>> | null;
  readonly verdict: 'allow' | 'deny';
  readonly createdAt: string;
  readonly reason: string | null;
}
