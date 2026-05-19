/**
 * Autonomy slider — resolution + decision + auto-suggest logic.
 *
 * The resolution chain (most specific wins):
 *   1. Conversation override (if set, not expired)
 *   2. Tenant default (always present)
 *   3. Platform fallback (`chat`)
 *
 * The decision function maps the resolved level to an `AutonomyDecision`
 * the brain feeds back through its pre-tool-use hook.
 *
 * The auto-suggest function turns a tenant track record into a candidate
 * upgrade. Critically: the platform NEVER auto-applies an upgrade;
 * it only *suggests* (`pendingSuggestion` on TenantAutonomyState).
 */

import type {
  AutonomyDecision,
  AutonomyLevel,
  AutonomyStateStore,
  ConversationAutonomyOverride,
  TenantAutonomyState,
  TenantTrackRecord,
} from './types.js';

/** Default level for a tenant that has not been configured. */
export const DEFAULT_AUTONOMY_LEVEL: AutonomyLevel = 'chat';

/** Days of clean track record before the platform auto-suggests `plan`. */
export const CLEAN_DAYS_FOR_PLAN_SUGGEST = 30;

/**
 * Build a fresh tenant state object for a new tenant (defaults to `chat`).
 */
export const initialTenantState = (
  tenantId: string,
  now: number = Date.now(),
): TenantAutonomyState => ({
  tenantId,
  currentLevel: DEFAULT_AUTONOMY_LEVEL,
  setAt: now,
  setBy: 'system',
});

/**
 * Resolve the effective autonomy level for a given conversation, applying
 * the (override > tenant > platform) chain.
 */
export const resolveAutonomyLevel = (args: {
  readonly tenantState: TenantAutonomyState | null;
  readonly conversationOverride?: ConversationAutonomyOverride | null;
  readonly now?: number;
}): AutonomyLevel => {
  const now = args.now ?? Date.now();
  const override = args.conversationOverride ?? null;
  if (override !== null) {
    const isExpired =
      override.expiresAt !== undefined && override.expiresAt <= now;
    if (!isExpired) return override.override;
  }
  if (args.tenantState !== null) return args.tenantState.currentLevel;
  return DEFAULT_AUTONOMY_LEVEL;
};

/**
 * Map an autonomy level to a `pre-tool-use` decision.
 *
 * `isFirstStepOfPlan` is true when the brain is about to execute the first
 * step of an already-approved plan — in `plan` mode this is the moment
 * the brain transitions from "plan-approved" to "step-by-step" execution.
 */
export const decideAutonomyAction = (args: {
  readonly level: AutonomyLevel;
  readonly hasPlanApproval?: boolean;
}): AutonomyDecision => {
  switch (args.level) {
    case 'chat':
      return { kind: 'request-step-approval', level: 'chat' };
    case 'plan': {
      if (args.hasPlanApproval !== true) {
        return { kind: 'request-plan-approval', level: 'plan' };
      }
      return { kind: 'request-step-approval', level: 'plan' };
    }
    case 'agentic':
      return { kind: 'auto-execute', level: 'agentic' };
  }
};

/**
 * Compute the next slider-suggestion based on the track record. Returns
 * `null` if no suggestion is warranted. Pure function — no I/O.
 *
 * Suggestion rules:
 *   - Current = `chat`, cleanDays ≥ 30, no recent violations → suggest `plan`
 *   - Current = `plan` → no auto-suggest to `agentic` (always opt-in)
 *   - Current = `agentic` → no suggestion (already top)
 */
export const computeAutonomySuggestion = (args: {
  readonly currentLevel: AutonomyLevel;
  readonly trackRecord: TenantTrackRecord;
  readonly cleanDaysThreshold?: number;
}): AutonomyLevel | null => {
  const threshold = args.cleanDaysThreshold ?? CLEAN_DAYS_FOR_PLAN_SUGGEST;
  if (args.currentLevel !== 'chat') return null;
  if (args.trackRecord.violationsLast90 > 0) return null;
  if (args.trackRecord.cleanDays < threshold) return null;
  return 'plan';
};

/**
 * Apply a positive owner acceptance of a pending suggestion.
 *   - validates the suggestion is the one currently pending
 *   - returns a new state object (no mutation)
 *   - clears the pending flag
 */
export const acceptSuggestion = (args: {
  readonly state: TenantAutonomyState;
  readonly approverUserId: string;
  readonly acceptedLevel: AutonomyLevel;
  readonly now?: number;
}): TenantAutonomyState => {
  if (args.state.pendingSuggestion !== args.acceptedLevel) {
    throw new Error(
      `Cannot accept level "${args.acceptedLevel}" — no matching pending suggestion (pending: ${args.state.pendingSuggestion ?? 'none'}).`,
    );
  }
  const next: TenantAutonomyState = {
    tenantId: args.state.tenantId,
    currentLevel: args.acceptedLevel,
    setAt: args.now ?? Date.now(),
    setBy: args.approverUserId,
  };
  return next;
};

/**
 * Owner explicitly downgrades — always allowed, no checks.
 */
export const downgradeAutonomy = (args: {
  readonly state: TenantAutonomyState;
  readonly approverUserId: string;
  readonly toLevel: AutonomyLevel;
  readonly now?: number;
}): TenantAutonomyState => {
  const order: Record<AutonomyLevel, number> = { chat: 0, plan: 1, agentic: 2 };
  if (order[args.toLevel] >= order[args.state.currentLevel]) {
    throw new Error(
      `downgradeAutonomy may only lower the level (current ${args.state.currentLevel}, requested ${args.toLevel}). Use acceptSuggestion or upgradeAutonomy.`,
    );
  }
  return {
    tenantId: args.state.tenantId,
    currentLevel: args.toLevel,
    setAt: args.now ?? Date.now(),
    setBy: args.approverUserId,
  };
};

/**
 * Owner explicitly upgrades to `agentic`. This is the *only* path to
 * agentic — there is no auto-suggest for `agentic`.
 */
export const upgradeAutonomyToAgentic = (args: {
  readonly state: TenantAutonomyState;
  readonly approverUserId: string;
  readonly now?: number;
}): TenantAutonomyState => {
  return {
    tenantId: args.state.tenantId,
    currentLevel: 'agentic',
    setAt: args.now ?? Date.now(),
    setBy: args.approverUserId,
  };
};

/**
 * High-level orchestration helper that consolidates the store calls into
 * a single resolveLevel-for-conversation function. Caller provides the
 * store; this wraps the resolution chain.
 */
export const resolveLevelForConversation = async (args: {
  readonly store: AutonomyStateStore;
  readonly tenantId: string;
  readonly conversationId: string;
  readonly now?: number;
}): Promise<AutonomyLevel> => {
  const [tenantState, override] = await Promise.all([
    args.store.loadTenantState(args.tenantId),
    args.store.loadConversationOverride(args.conversationId),
  ]);
  return resolveAutonomyLevel({
    tenantState,
    conversationOverride: override,
    now: args.now ?? Date.now(),
  });
};
