/**
 * @bossnyumba/governance
 *
 * Phase K-E — Governance Cluster.
 *
 * The brain consults this package before every action that can affect the
 * real world. Four modules:
 *
 *   1. constitution/       — written principles + LLM self-critique gate
 *   2. autonomy-slider/    — chat / plan / agentic per-tenant + per-convo
 *   3. checkpoint-gates/   — per-action-class HITL policy
 *   4. managed-settings/   — admin-locked tenant policy, fail-closed
 *
 * Designed call order in the pre-tool-use hook:
 *
 *   1. resolveManagedSettings()  — admin policy first
 *   2. evaluateGate()             — cheapest deny (no LLM)
 *   3. resolveAutonomyLevel() + decideAutonomyAction()
 *   4. enforceConstitution()     — self-critique pass
 *
 * Wiring (services + apps) is downstream of this package.
 */

// Namespaced re-exports (Constitution.*, AutonomySlider.*, etc.) for
// callers that prefer the qualified style.
export * as Constitution from './constitution/index.js';
export * as AutonomySlider from './autonomy-slider/index.js';
export * as CheckpointGates from './checkpoint-gates/index.js';
export * as ManagedSettings from './managed-settings/index.js';

// Flat re-exports — every public function and type from each sub-module.
// Constitution
export {
  enforceConstitution,
  isCompliant,
  passthroughSelfCritiquePort,
  strictSelfCritiquePort,
  composePorts,
  pickWorstViolation,
  shouldSampleReadOnlyForTelemetry,
  PRINCIPLE_CHECKERS,
  SEVERITY_RANK,
} from './constitution/index.js';
export type {
  ActionRiskClass,
  ConstitutionContext,
  ConstitutionVerdict,
  EnforceConstitutionOptions,
  PrincipleName,
  PrincipleVerdict,
  ProposedAction,
  SelfCritiquePort,
  Severity,
} from './constitution/index.js';

// Autonomy Slider
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
} from './autonomy-slider/index.js';
export type {
  AutonomyDecision,
  AutonomyLevel,
  AutonomyStateStore,
  ConversationAutonomyOverride,
  TenantAutonomyState,
  TenantTrackRecord,
} from './autonomy-slider/index.js';

// Checkpoint Gates
export {
  DEFAULT_GATE_CONFIG,
  initialTenantGateSettings,
  evaluateGate,
  evaluateGateForTenant,
  updateGateConfig,
} from './checkpoint-gates/index.js';
export type {
  ActionClass,
  CheckpointGateConfig,
  GateRequest,
  GateSettingsStore,
  GateVerdict,
  TenantGateSettings,
} from './checkpoint-gates/index.js';

// Managed Settings
export {
  MOST_RESTRICTIVE_LOCKS,
  buildFailClosedBundle,
  isFailClosedBundle,
  resolveManagedSettings,
} from './managed-settings/index.js';
export type {
  ManagedSettings as ManagedSettingsBundle,
  ManagedSettingsCache,
  ManagedSettingsLedger,
  ManagedSettingsLocks,
  ManagedSettingsRemote,
  RemoteFetchOutcome,
  ResolveManagedSettingsDeps,
} from './managed-settings/index.js';
