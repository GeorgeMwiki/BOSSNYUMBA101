/**
 * Autonomy slider — per-tenant default with per-conversation override.
 *
 * Three levels (R2 #3 — Chat / Plan / Agentic):
 *
 *   - `chat`     — Q&A only. Every side-effecting action requires explicit
 *                  approval. Default for new tenants.
 *   - `plan`     — Brain shows a plan as an editable artifact. Owner
 *                  approves the plan; brain executes step-by-step,
 *                  surfacing receipts after each step.
 *   - `agentic`  — Brain executes within the autonomy cap + constitution +
 *                  checkpoint gates. Owner reviews receipts after.
 *                  Opt-in only.
 *
 * Default progression (per-tenant):
 *   - new tenant      → `chat`
 *   - 30 clean days   → auto-suggest `plan` (owner must positively accept)
 *   - never auto      → `agentic` (always explicit opt-in)
 */

/** Stable identifiers — UI labels are localised separately. */
export type AutonomyLevel = 'chat' | 'plan' | 'agentic';

/**
 * Track record signal used to drive auto-suggestion.
 *   - `cleanDays`      — consecutive days with zero policy violations
 *   - `violationsLast90` — count of severity≥`block` events in 90d
 *   - `approvalsLast90`  — count of successful owner approvals in 90d
 */
export interface TenantTrackRecord {
  readonly cleanDays: number;
  readonly violationsLast90: number;
  readonly approvalsLast90: number;
}

/**
 * Tenant-scoped slider state — persisted in the settings store.
 */
export interface TenantAutonomyState {
  readonly tenantId: string;
  readonly currentLevel: AutonomyLevel;
  /** When the current level was last set (epoch ms). */
  readonly setAt: number;
  /** Who set it — `'system'` for auto-suggest accepts. */
  readonly setBy: string;
  /** True iff the platform has surfaced a suggestion the owner has not yet acted on. */
  readonly pendingSuggestion?: AutonomyLevel;
}

/**
 * Per-conversation override — a single conversation may run at a *lower*
 * level than the tenant default. Raising the level mid-conversation
 * requires an explicit owner action that re-runs the auto-suggest gate.
 */
export interface ConversationAutonomyOverride {
  readonly conversationId: string;
  readonly tenantId: string;
  readonly override: AutonomyLevel;
  readonly setAt: number;
  readonly setBy: string;
  readonly expiresAt?: number;
}

/**
 * The outcome of a `pre-tool-use` decision based on the resolved autonomy
 * level. Three shapes:
 *
 *   - `auto-execute`      — agentic mode and the gate allows it
 *   - `request-plan-approval` — plan mode; the action set must be approved
 *                                wholesale before any step runs
 *   - `request-step-approval` — chat mode (or plan mode mid-execution); the
 *                                next single action must be approved
 */
export type AutonomyDecision =
  | { readonly kind: 'auto-execute'; readonly level: AutonomyLevel }
  | { readonly kind: 'request-plan-approval'; readonly level: AutonomyLevel }
  | { readonly kind: 'request-step-approval'; readonly level: AutonomyLevel };

/**
 * Storage port for the slider — abstracted so the package has no DB
 * dependency. Wiring lives in the consumer service.
 */
export interface AutonomyStateStore {
  loadTenantState(tenantId: string): Promise<TenantAutonomyState | null>;
  saveTenantState(state: TenantAutonomyState): Promise<void>;
  loadConversationOverride(
    conversationId: string,
  ): Promise<ConversationAutonomyOverride | null>;
  saveConversationOverride(override: ConversationAutonomyOverride): Promise<void>;
  loadTrackRecord(tenantId: string): Promise<TenantTrackRecord>;
}
