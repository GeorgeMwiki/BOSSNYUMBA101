/**
 * @bossnyumba/governance/autonomy-slider
 *
 * The chat / plan / agentic toggle. Per-tenant default, per-conversation
 * override. The header dropdown in J9 chat-workspace consumes this
 * contract; J9 picks it up.
 *
 * UX surface contract:
 *   - The header dropdown renders three radio options for the three
 *     `AutonomyLevel` values.
 *   - On change, the front-end posts a `ConversationAutonomyOverride`.
 *   - The brain calls `resolveLevelForConversation` and then
 *     `decideAutonomyAction` at every pre-tool-use hook.
 */

export {
  DEFAULT_AUTONOMY_LEVEL,
  CLEAN_DAYS_FOR_PLAN_SUGGEST,
  initialTenantState,
  resolveAutonomyLevel,
  decideAutonomyAction,
  computeAutonomySuggestion,
  acceptSuggestion,
  downgradeAutonomy,
  upgradeAutonomyToAgentic,
  resolveLevelForConversation,
} from './slider.js';

export type {
  AutonomyDecision,
  AutonomyLevel,
  AutonomyStateStore,
  ConversationAutonomyOverride,
  TenantAutonomyState,
  TenantTrackRecord,
} from './types.js';
