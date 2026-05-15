/**
 * Service-level orchestration on top of repositories.
 */

export {
  MigrationWriterService,
  type ExtractedBundle,
  type WriterReport,
  type WriterRowOutcome,
  type WriterOptions,
  type PropertyDraft,
  type UnitDraft,
  type TenantDraft,
  type EmployeeDraft,
  type DepartmentDraft,
  type TeamDraft,
} from './migration-writer.service.js';

// Brain kernel substrate — Drizzle-backed sinks for the central
// intelligence kernel's CoT reservoir, persona drift, and provenance.
export {
  createKernelSubstrateService,
  type KernelSubstrateService,
  type KernelSinkScope,
  type CotSampleShape,
  type PersonaDriftShape,
  type ProvenanceShape,
} from './kernel-substrate.service.js';

// Kernel memory — Drizzle-backed prior-turns loader and recent-user-
// turn counter for the central intelligence kernel. Reads thread_events
// (the brain's existing conversation log) — read-only, never mutates.
export {
  createKernelMemoryService,
  type KernelMemoryService,
  type KernelMemoryDeps,
  type KernelPriorTurn,
} from './kernel-prior-turns.service.js';

// Kernel grounding — Drizzle-backed GroundingFactsProvider that reads
// occupancy, active leases, open work-orders, and lease-expiry counts.
// Triggered by user-message keywords; produces tenant-scoped facts the
// kernel mixes into the system prompt as grounding evidence.
export {
  createKernelGroundingProvider,
  type GroundingFactShape,
  type GroundingFactsProviderShape,
  type GroundingViewRole,
  type KernelGroundingDeps,
} from './kernel-grounding.service.js';

// Kernel cohort — Drizzle-backed TenantAggregateSource for the
// graph-privacy DP aggregator. Composed at the api-gateway sovereign
// composition root; reads cross-tenant arrears / collections /
// renewals / maintenance-TTC. Returns per-tenant per-statistic
// contributions; missing data ⇒ empty array (the aggregator handles
// that path safely). Port shape duck-typed locally so this package
// does not compile-time-depend on @bossnyumba/graph-privacy.
export {
  createPgTenantAggregateSource,
  type TenantAggregateSourceShape,
  type ContributionsArgs,
  type PlatformSliceShape,
} from './kernel-cohort.service.js';

// Platform privacy-budget ledger — Drizzle-backed PlatformBudgetLedger
// (port duck-typed locally; see platform-budget-ledger.service.ts).
// Composed at the api-gateway sovereign composition root in place of
// the in-memory ledger so cohort DP-aggregator budget consumption
// survives api-gateway restarts. Backed by migration 0116.
export {
  createPgPlatformBudgetLedger,
  PrivacyBudgetExhaustedError,
  type PlatformBudgetLedgerShape,
  type PgBudgetLedgerDeps,
} from './platform-budget-ledger.service.js';

// Currency rates — Drizzle-backed FX normaliser used by the
// platform-overview HQ KPI router. Loads ISO-4217 → USD snapshots
// from `currency_rates` (migration 0117) and converts mixed-currency
// payment sums into a single USD total. Unknown codes contribute 0
// with a soft warn — never throws on lookup misses.
export {
  createCurrencyRatesService,
  type CurrencyRate,
  type CurrencySum,
  type CurrencyRatesService,
} from './currency-rates.service.js';

// Persona branding — Drizzle-backed persistence for per-tenant
// kernel-persona overrides (displayName / openingPreamble / voice
// profile id). Adapts to the kernel's PersonaBrandingResolver port at
// the api-gateway sovereign composition root. Migration 0118.
export {
  createPersonaBrandingService,
  type PersonaBrandingShape,
  type PersonaBrandingService,
} from './persona-branding.service.js';

// Currency preferences — per-user / per-tenant / platform-default
// display-currency choice. Resolution chain: user → tenant → platform.
// Built for the world, starting with TZ — operators add new currencies
// via the table without code changes. Migration 0119.
export {
  createCurrencyPreferencesService,
  type CurrencyPreferenceRow,
  type CurrencyPreferenceScopeKind,
  type CurrencyPreferencesService,
  type ResolvePreferenceArgs,
  type ResolvedCurrency,
} from './currency-preferences.service.js';

// Market data cache — Drizzle-backed TTL cache for external market-
// data adapter responses (Zillow, Airbnb, Rentometer, etc.). Composed
// at the api-gateway sovereign composition root and handed to the
// adapter factories so repeated kernel queries within the TTL window
// don't hammer the upstream provider. Migration 0120.
export {
  createMarketDataCacheService,
  type MarketDataCacheEntry,
  type MarketDataCacheService,
} from './market-data-cache.service.js';

// Kernel memory hierarchy — LITFIN-style four-tier memory ABOVE the
// existing thread_events transport. The kernel reads semantic facts +
// the latest reflective digest at step 4 (memory recall) and writes
// episodic rows at step 13 (provenance write). Migration 0121.
//
// NB: this set of services exposes ONLY the read+write surface. Fact
// extraction (semantic), pattern observation (procedural), and digest
// generation (reflective) are the consolidation cycle agent's
// responsibility — that runs in a separate composition root.
export {
  createEpisodicMemoryService,
  type EpisodicEntry,
  type EpisodicKind,
  type EpisodicMemoryService,
  type EpisodicRecallArgs,
  type EpisodicRecordArgs,
} from './kernel-memory-episodic.service.js';
export {
  createSemanticMemoryService,
  type DecayArgs,
  type LookupArgs,
  type SearchArgs,
  type SemanticFact,
  type SemanticMemoryService,
  type SemanticSource,
  type UpsertFactArgs,
} from './kernel-memory-semantic.service.js';
export {
  createProceduralMemoryService,
  type MatchArgs,
  type ProceduralMemoryService,
  type ProceduralPattern,
  type RecordArgs as ProceduralRecordArgs,
} from './kernel-memory-procedural.service.js';
export {
  createReflectiveMemoryService,
  type LatestArgs,
  type ReflectiveDigest,
  type ReflectiveDigestInput,
  type ReflectiveMemoryService,
  type ReflectivePeriodKind,
  type ReflectiveTopicCount,
} from './kernel-memory-reflective.service.js';

// Kernel feedback (migration 0122) — online-learning signal store.
// Captures thumbs / corrections / flags per kernel turn so the kernel
// can read its own per-user rollup at step 4 (memory recall) and bias
// the next turn toward conservative, citation-heavy output when the
// recent negative-rate is elevated. Closes the "stock LLMs are STATIC"
// assessment gap.
export {
  createFeedbackService,
  type FeedbackEntry,
  type FeedbackRollup,
  type FeedbackService,
  type FeedbackSignal,
  type RecallArgs as FeedbackRecallArgs,
  type RollupArgs as FeedbackRollupArgs,
} from './kernel-feedback.service.js';

// Kernel agency (migration 0123) — Drizzle-backed GoalsPort +
// ActionAuditSink. The kernel reads ACTIVE goals at step 4 (memory
// recall) and the wake-loop opens new goals through the same service.
// The audit sink is append-only.
export {
  createKernelGoalsService,
  type Goal as KernelGoal,
  type GoalListArgs as KernelGoalListArgs,
  type GoalMetrics as KernelGoalMetrics,
  type GoalOpenArgs as KernelGoalOpenArgs,
  type GoalPriority as KernelGoalPriority,
  type GoalStatus as KernelGoalStatus,
  type GoalStep as KernelGoalStep,
  type GoalStepDraft as KernelGoalStepDraft,
  type GoalStepStatus as KernelGoalStepStatus,
  type GoalUpdateStepArgs as KernelGoalUpdateStepArgs,
  type KernelGoalsService,
} from './kernel-goals.service.js';
export {
  createKernelActionAuditService,
  type ActionAuditDecision as KernelActionAuditDecision,
  type ActionAuditEntry as KernelActionAuditEntry,
  type KernelActionAuditService,
} from './kernel-action-audit.service.js';

// Sovereign action ledger (migration 0129) — hash-chained agency-side
// audit ledger of EXECUTED sovereign-tier actions. Append-only +
// tamper-evident; verifyLedgerChain re-derives every row's hash.
// Closes LITFIN parity Gap C in .planning/parity-litfin/07-agency.md.
export {
  createSovereignActionLedgerService,
  computeRowHash as computeSovereignLedgerRowHash,
  hashPayload as hashSovereignLedgerPayload,
  GENESIS_HASH as SOVEREIGN_LEDGER_GENESIS_HASH,
  type SovereignActionLedgerService,
  type SovereignLedgerAppendArgs,
  type SovereignLedgerAppendResult,
  type SovereignLedgerRow,
  type SovereignLedgerVerifyResult,
} from './sovereign-action-ledger.service.js';

// Per-tenant autonomy policy reader (migration 0080 — autonomy_policies).
// Adapts to the kernel-agency `AutonomyPolicyPort` shape; falls back to
// default-allow-low-stakes whenever the row is missing, autonomous mode
// is disabled, the policy_json is malformed, or the DB query throws.
export {
  createPgAutonomyPolicyService,
  defaultAllowLowStakes as defaultAllowLowStakesAutonomy,
  type AutonomyPolicyDecideArgs,
  type AutonomyPolicyDecision,
  type AutonomyStakes,
  type PgAutonomyPolicyService,
} from './autonomy-policy.service.js';

// Voice-turn log (migration 0110) — Drizzle-backed adapter for the
// voice-agent's `VoiceTurnRepository` shape. Duck-typed so the database
// package does not compile-time-depend on `@bossnyumba/ai-copilot`.
export {
  createVoiceTurnsService,
  type VoiceToolCallShape,
  type VoiceTurnRowShape,
  type VoiceTurnsService,
} from './voice-turns.service.js';

// Market-rate snapshots (migration 0103) — Drizzle-backed adapter for
// the market-surveillance agent's snapshot persistence. `listActiveUnits`
// is composed elsewhere from the occupancy/units repository.
export {
  createMarketRateSnapshotsService,
  type DriftFlag,
  type ListRecentArgs as MarketRateListRecentArgs,
  type MarketRateSnapshotShape,
  type MarketRateSnapshotsService,
} from './market-rate-snapshots.service.js';

// Tenant predictions + intervention opportunities (migration 0106) —
// Drizzle-backed adapter for the predictive-interventions agent.
// `listActiveTenants` is composed elsewhere from occupancy/lease repos.
export {
  createTenantPredictionsService,
  type InterventionOpportunityShape,
  type InterventionStatus,
  type PredictionHorizonDays,
  type TenantPredictionShape,
  type TenantPredictionsService,
} from './tenant-predictions.service.js';

// Monthly close runs + steps (migration 0099 — Wave 28 PhA2) —
// Drizzle-backed adapter for the MonthlyCloseOrchestrator's RunStorePort.
// (tenantId, period_year, period_month) uniqueness is enforced at the
// schema layer; recordStep idempotency on (run_id, step_name).
export {
  createMonthlyCloseRunsService,
  type CreateRunArgs as MonthlyCloseCreateRunArgs,
  type Decision as MonthlyCloseDecision,
  type MonthlyCloseRunsService,
  type RecordStepArgs as MonthlyCloseRecordStepArgs,
  type RunPatch as MonthlyCloseRunPatch,
  type RunStateShape as MonthlyCloseRunStateShape,
  type RunStatus as MonthlyCloseRunStatus,
  type StepRecordShape as MonthlyCloseStepRecordShape,
  type Trigger as MonthlyCloseTrigger,
} from './monthly-close-runs.service.js';

// Sensor routing control plane (migration 0126, LITFIN-parity Wave K) —
// Drizzle-backed adapter for the multi-LLM router. Records every sensor
// attempt to `sensor_call_log` with the outcome enum so dashboards can
// split availability / cost / refusal failure modes; debits the matching
// period envelope in `tenant_budget_envelopes`. `selectSensorChain`
// returns the builtin (task, tenant-tier) → ordered chain — stays
// read-only by default so wiring into the live router is a follow-up.
export {
  createSensorRoutingService,
  type SensorRoutingService,
  type RecordSensorCallArgs,
  type BudgetStatus,
  type SensorChainVerdict,
  type SensorChoice,
  type TenantTier,
} from './sensor-routing.service.js';

// Approval policy (migration 0128, K5 parity) — declarative four-eye policy
// table for sovereign-tier kernel tools. Per-tenant rows override the
// platform-default row; both fall back to the kernel baseline. Carries
// role-group quorum, max-stale-minutes, recall-window, and re-auth
// requirements. Adapts to the kernel's `ApprovalPolicyPort` shape; the
// kernel's `four-eye-approval.ts` hands `resolve()` to the gate so each
// proposed action loads its declarative policy at propose-time.
export {
  createApprovalPolicyService,
  defaultBaseline as defaultApprovalPolicyBaseline,
  type ApprovalPolicyResolveArgs,
  type ApprovalPolicyService,
  type ApprovalPolicyUpsertArgs,
  type ResolvedApprovalPolicy,
} from './approval-policy.service.js';

// Privacy-budget composer (migration 0130, parity K6.2) — unified
// (ε, δ) refusal gate that sums per-tenant + platform DP spend over a
// 30-day rolling window. Closes parity-gap G2 (alternating-surface
// attack against the two independent ledgers). Hard caps: platform
// (5.0, 1e-5), pro (10.0, 1e-5), enterprise (50.0, 1e-5). The default
// repository is in-memory; production composition roots wire a
// Drizzle-backed adapter against privacy_budget_ledger.
export {
  createPrivacyBudgetComposerService,
  InMemoryPrivacyBudgetRepository as InMemoryPrivacyBudgetComposerRepository,
  PrivacyBudgetExceededError,
  PRIVACY_BUDGET_TIER_CAPS,
  PRIVACY_BUDGET_WINDOW_DAYS,
  type BudgetAvailability,
  type CheckBudgetArgs,
  type PrivacyBudgetComposerConfig,
  type PrivacyBudgetComposerService,
  type PrivacyBudgetRepository as PrivacyBudgetComposerRepository,
  type PrivacyBudgetTier,
  type PrivacyBudgetWindow,
  type RecordSpendArgs,
  type RemainingBudget,
} from './privacy-budget-composer.service.js';

// Voyager skill registry (migration 0133 — C5 Phase A). Adapter for the
// kernel's `SkillRetrieverPort` (in `@bossnyumba/central-intelligence`).
// Production composition wires this; tests pass in-memory fakes.
export {
  createSkillRegistryService,
  type ListByTenantArgs as SkillListByTenantArgs,
  type RecordOutcomeArgs as SkillRecordOutcomeArgs,
  type SearchByEmbeddingArgs as SkillSearchByEmbeddingArgs,
  type SkillRegistryService,
  type SkillRow,
  type SkillRowWithSimilarity,
  type SkillStatus,
  type UpsertSkillArgs as SkillUpsertArgs,
} from './skill-registry.service.js';

// Reflexion buffer (migration 0134 — C5 Phase A). Adapter for the
// kernel's `ReflexionBufferPort`. Reads the last N reflections at
// session start, writes one row at session end.
export {
  createReflexionBufferService,
  type RecallReflexionsArgs,
  type RecordReflexionArgs,
  type ReflexionBufferService,
  type ReflexionEntry,
  type ReflexionOutcome,
} from './reflexion-buffer.service.js';

// Implicit feedback signals (migration 0135 — C5 Phase A). Adapter for
// the sensorium's downstream signal store. Joined to traces by
// `(trace_id, agent_action_id, tenant_id, user_id, surface, role)`.
export {
  createImplicitFeedbackSignalsService,
  type ImplicitFeedbackRollup,
  type ImplicitFeedbackSignalsService,
  type ImplicitSignal,
  type ImplicitSignalType,
  type ListByTraceArgs as ImplicitFeedbackListByTraceArgs,
  type ListForUserArgs as ImplicitFeedbackListForUserArgs,
  type RecordSignalArgs as ImplicitFeedbackRecordArgs,
  type RollupForTenantArgs as ImplicitFeedbackRollupArgs,
} from './implicit-feedback-signals.service.js';

// Sensorium event log (migration 0132 — C4 Phase A, Central Command).
// Drizzle-backed append-only store for the 14-event sensory taxonomy
// emitted by the client-side sensory bus in admin-platform-portal.
// The server-side `BehaviorObserver` (packages/ai-copilot) aggregates
// rolling-window event histograms here into signals the brain consumes
// at memory-recall time.
export {
  createSensoriumEventLogService,
  type CountByTypeArgs as SensoriumCountByTypeArgs,
  type ListForSessionArgs as SensoriumListForSessionArgs,
  type SensoriumEventInput,
  type SensoriumEventLogService,
  type SensoriumEventRow,
} from './sensorium-event-log.service.js';

// Agency run checkpoints (migration 0136, C6 Phase A — Central Command).
// Durable substrate for the agency executor. The durable runner (api-
// gateway composition) writes one checkpoint row per (run_id, step_index)
// so retries + crash-recovery + operator-resumable goals work without a
// third-party orchestrator. Phase A in-tree implementation; Phase B may
// promote to a real Inngest dashboard.
export {
  createAgencyRunCheckpointsService,
  type AgencyCheckpointRow,
  type AgencyCheckpointState,
  type AgencyRunCheckpointsService,
  type ListStuckRunningArgs as AgencyCheckpointListStuckArgs,
  type RecordPendingArgs as AgencyCheckpointRecordPendingArgs,
} from './agency-run-checkpoints.service.js';
