/**
 * @bossnyumba/central-intelligence — kernel public surface.
 *
 * The disciplined cognitive layer above the streaming agent loop.
 * Mirrors LITFIN's brain-kernel patterns, scoped to property
 * management. See `.planning/litfin-parity-plan.md` for the gap
 * analysis that motivated this module.
 *
 * Typical composition:
 *
 *   const kernel = createBrainKernel({
 *     sensors: [claudeOpus, claudeSonnet, openaiGpt4o],
 *     cohort: dpCohortSource,
 *     cotReservoir: createCotReservoir({ sink: pgCotSink }),
 *     driftSink: pgDriftSink,
 *     priorTurnsLoader: (id) => memory.priorTurns(id),
 *     judge: (txt) => llmJudge(txt),
 *   });
 *
 *   const decision = await kernel.think({
 *     threadId, userMessage, scope, tier, stakes, surface,
 *   });
 */

export * from './kernel-types.js';
export {
  TENANT_RESIDENT_PERSONA,
  OWNER_ADVISOR_PERSONA,
  ESTATE_MANAGER_PERSONA,
  ORG_ADMIN_PERSONA,
  PLATFORM_SOVEREIGN_PERSONA,
  SOVEREIGN_ADMIN_PERSONA,
  MARKETING_GUIDE_PERSONA,
  CLASSROOM_TUTOR_PERSONA,
  ALL_PERSONAS,
  selectPersona,
  renderIdentityPreamble,
  personalisePersona,
  type PersonaIdentity,
  type UserProfile,
} from './identity.js';
export {
  contains,
  commonAncestor,
  cohortMinK,
  isTierCompatibleWithScope,
  locusPhrase,
  tierRank,
} from './awareness-scopes.js';
export { checkInviolable, type InviolableVerdict } from './inviolable.js';
export {
  checkPublicInviolable,
  PUBLIC_INVIOLABLE_LIMITS,
  type PublicInviolableInput,
  type PublicInviolableVerdict,
  type PublicInviolableCategory,
} from './public-inviolable.js';
export {
  runPolicyGate,
  isWithinBusinessHoursEAT,
  DEFAULT_COST_CEILINGS,
  type PolicyGateInput,
  type PolicyGateOutput,
  type PolicyGateRequestContext,
  type PolicyGateDecisionContext,
  type PolicyGateTier,
} from './policy-gate.js';
export {
  checkSelfAwareness,
  renderModuleInventoryBlock,
  describeCapabilities,
  groupByCategory,
  BRAIN_MODULES,
  type SelfAwarenessInput,
  type SelfAwarenessOutput,
  type BrainModule,
  type BrainModuleCategory,
} from './self-awareness.js';
export {
  inferMindState,
  renderMindStateDirective,
  renderMindStateDirectiveWithProfile,
  createAffectiveAccumulator,
  AFFECTIVE_DEFAULT,
  type MindState,
  type Urgency,
  type Expertise,
  type Mode,
  type AffectiveState,
  type AffectiveProfile,
  type AffectiveObservation,
  type AffectiveAccumulator,
} from './theory-of-mind.js';
export {
  assessCognitiveLoad,
  renderLoadDirective,
  renderLoadDirectiveWithProfile,
  createCognitiveLoadAccumulator,
  type CognitiveLoadInput,
  type CognitiveLoadOutput,
  type CognitiveLoadAccumulator,
  type CognitiveLoadAccumulatorProfile,
  type AccumulatorObservation,
} from './cognitive-load.js';
export {
  BOSSNYUMBA_PERSONA,
  renderSituatedAddress,
  renderPersonaPrelude,
  isBrandReservedName,
  preservesBrandName,
  type SituatedAddressArgs,
} from './persona.js';
export {
  detectDrift,
  extractDistinctiveTokens,
  jaccardOverlap,
  DEFAULT_DRIFT_THRESHOLD,
  type DriftDetectorInput,
  type DriftVerdict,
} from './drift-detector.js';
export {
  BOSSNYUMBA_REFERENCE_PERSONA,
  PERSONA_VECTOR_DIMS,
  probePersonaVector,
  perDimDrift,
  aggregateL2,
  worstDim,
  type PersonaVector,
  type PersonaVectorDim,
  type PersonaVectorProbeInput,
} from './persona-drift/vectors.js';
export {
  assessPersonaDrift,
  emitPersonaDriftIfBreached,
  DEFAULT_PER_DIM_THRESHOLD,
  DEFAULT_AGGREGATE_THRESHOLD,
  type DriftAlertVerdict,
  type AssessDriftInput,
  type EmitDriftEventInput,
} from './persona-drift/alert.js';
export { scoreConfidence, type ConfidenceInput } from './confidence.js';
export { normalize, type NormaliserOutput } from './normalizer.js';
export {
  createBrainCache,
  thoughtCacheKey,
  cacheKeyForRequest,
  classifyIntent,
  DEFAULT_INTENT_TTL_MS,
  type BrainCache,
  type BrainCacheDeps,
  type CacheIntent,
} from './brain-cache.js';
export {
  createSensorRouter,
  SensorFailoverError,
  type SensorRouter,
  type SensorFailoverDeps,
  type SensorHealthSnapshot,
  type BreakerState,
  type SensorOutcome,
} from './sensor-failover.js';
export {
  createCotReservoir,
  createInMemoryCotReservoirSink,
  createInMemoryPersonaDriftSink,
  createInMemoryProvenanceSink,
  type CotReservoir,
  type CotReservoirDeps,
  type CotReservoirCaptureInput,
} from './cot-reservoir.js';
export {
  buildCohortMixin,
  type CohortFinding,
  type CohortMixin,
  type CohortSource,
} from './cohort-signal.js';
export {
  gradeProperty,
  evaluatePropertyGrade,
  renderGradeBriefing,
  type PropertyGrade,
  type PropertyGradeSnapshot,
  type PropertyGradeInputs,
  type AxisEvaluation,
  type GradeAxisKey,
  type GradeBand,
  type GradeInputs,
} from './continuous-grading.js';
export {
  createBrainKernel,
  type BrainKernel,
  type BrainKernelDeps,
} from './kernel.js';
export {
  createOpenAiEmbedder,
  createNullEmbedder,
  EMBEDDER_NOT_CONFIGURED_ERROR,
  type EmbedderPort,
  type OpenAiEmbedderConfig,
} from './embedder.js';
export {
  createApprovalGate,
  createInMemoryApprovalStore,
  buildApprovalPolicy,
  DEFAULT_APPROVAL_POLICY,
  type ApprovalGate,
  type ApprovalGateDeps,
  type ApprovalPolicy,
  type ApprovalPolicyResolver,
  type ApprovalRecord,
  type ApprovalRoleGroup,
  type ApprovalSignature,
  type ApprovalStatus,
  type ApprovalStore,
  type ProposeArgs,
  type ProposedAction,
  type SignArgs,
} from './four-eye-approval.js';
export {
  createBriefingComposer,
  type Briefing,
  type BriefingDataPoint,
  type BriefingInputs,
  type BriefingComposerDeps,
} from './briefing.js';
export {
  createNudgeRouter,
  createInMemoryNudgeDedupe,
  type Nudge,
  type NudgeIntent,
  type NudgeRouterDeps,
  type NudgeDedupeStore,
} from './proactive-nudge.js';
export {
  createAnthropicSensor,
  ANTHROPIC_SENSOR_PRESETS,
  type AnthropicSensorConfig,
  type AnthropicMessagesClient,
  type AnthropicMessageBlock,
  type AnthropicMessageResponse,
  type AnthropicRequestContentBlock,
  type AnthropicRequestMessage,
} from './sensors/anthropic-sensor.js';
export {
  createAnthropicJudge,
  type AnthropicJudgeConfig,
  type JudgeVerdict,
} from './sensors/anthropic-judge.js';
export { scrubCotText } from './cot-reservoir.js';
export {
  createDpCohortSource,
  type DpAggregator,
  type DpAggregateQuery,
  type DpAggregateOutcome,
  type DpPlatformAuthContext,
  type DpCohortSourceDeps,
} from './sources/dp-cohort-source.js';
export {
  composeSovereign,
  type ComposeSovereignConfig,
  type SovereignBrain,
  type SubstrateSinks,
} from './compose.js';
export {
  applyVoiceProfile,
  personaWithVoice,
  setVoiceProfileResolver,
  SURFACE_DEFAULT_VOICE,
  type VoicedPersona,
  type VoiceProfile,
  type VoiceProfileId,
  type VoiceProfileResolver,
  type PersonaVoiceSection,
  type VoicePace,
  type VoiceTone,
  type VoiceVocabularyRegister,
  type VoiceSentencePauseLength,
  type VoiceCodeSwitchingRules,
  type VoiceBindingHint,
} from './voice-bridge.js';
export {
  applyBrandingOverride,
  createInMemoryPersonaBrandingResolver,
  type PersonaBrandingOverride,
  type PersonaBrandingResolver,
} from './branding.js';
export {
  createEnvKillswitchPort,
  resolveKillswitch,
  renderKillswitchRefusalText,
  type KillswitchLevel,
  type KillswitchPort,
  type KillswitchReasonCode,
  type KillswitchState,
} from './killswitch.js';
export {
  resolveUncertaintyPolicy,
  type PropertyManagementEntity,
  type UncertaintyAction,
  type UncertaintyDecision,
  type UncertaintyPolicyInput,
} from './uncertainty-policy.js';
export {
  createDecisionTraceRecorder,
  createInMemoryDecisionTraceStore,
  type CreateDecisionTraceRecorderArgs,
  type DecisionTrace,
  type DecisionTraceRecorder,
  type DecisionTraceStore,
  type DecisionTraceWriter,
  type KernelStepName,
  type KernelStepRecord,
} from './decision-trace.js';

/**
 * BrainToolSpec registry — kernel-side deterministic tool layer
 * (Zod-validated, tier-gated, audit-logged). Distinct from the
 * SaaS-billing `McpTier` in `@bossnyumba/mcp-server`; this is the
 * INTERNAL-cost tier the brain reasons about. See `tool-spec.ts` for
 * the seed catalog of 5 property-management tools.
 */
export {
  createBrainToolRegistry,
  createInMemoryBrainToolAuditSink,
  registerSeedBrainTools,
  computeKraMri,
  triageMaintenanceTicket,
  LookupTenantArrearsInputSchema,
  LookupTenantArrearsOutputSchema,
  ComputeKraMriInputSchema,
  ComputeKraMriOutputSchema,
  CheckComplianceCertificateInputSchema,
  CheckComplianceCertificateOutputSchema,
  GetMarketRateBandInputSchema,
  GetMarketRateBandOutputSchema,
  TriageMaintenanceTicketInputSchema,
  TriageMaintenanceTicketOutputSchema,
  SEED_BRAIN_TOOL_NAMES,
  type BrainToolTier,
  type BrainToolSpec,
  type BrainToolAuditRow,
  type BrainToolAuditSink,
  type BrainToolOutcome,
  type BrainToolRegistry,
  type BrainToolRegistryDeps,
  type InMemoryBrainToolAuditSink,
  type LookupTenantArrearsInput,
  type LookupTenantArrearsOutput,
  type ComputeKraMriInput,
  type ComputeKraMriOutput,
  type CheckComplianceCertificateInput,
  type CheckComplianceCertificateOutput,
  type GetMarketRateBandInput,
  type GetMarketRateBandOutput,
  type TriageMaintenanceTicketInput,
  type TriageMaintenanceTicketOutput,
  type SeedBrainToolDeps,
} from './tool-spec.js';

// LITFIN-style four-tier memory hierarchy ports — episodic, semantic,
// procedural, reflective. Adapters live in `@bossnyumba/database`; the
// composition root binds them to the kernel via BrainKernelDeps.memory
// (and ComposeSovereignConfig.memory).
export type {
  EpisodicEntry,
  EpisodicKind,
  EpisodicMemoryPort,
  EpisodicRecallArgs,
  EpisodicRecordArgs,
  MemoryHierarchy,
  ProceduralMatchArgs,
  ProceduralMemoryPort,
  ProceduralPattern,
  ProceduralRecordArgs,
  ReflectiveDigest,
  ReflectiveDigestInput,
  ReflectiveLatestArgs,
  ReflectiveMemoryPort,
  ReflectivePeriodKind,
  ReflectiveTopicCount,
  SemanticDecayArgs,
  SemanticFact,
  SemanticLookupArgs,
  SemanticMemoryPort,
  SemanticSearchArgs,
  SemanticSource,
  SemanticUpsertArgs,
} from './memory/index.js';

// Online-learning feedback port — the brain's "growth" pattern.
// The kernel reads recent feedback at step 4 (memory recall) so the
// next turn can apologise for past mistakes and bias toward
// conservative output when the user has been pushing back lately.
// Mirrors LITFIN's feedback loop and closes the "stock LLMs are
// STATIC" assessment gap.
export type {
  FeedbackEntry,
  FeedbackMemoryPort,
  FeedbackRecallArgs,
  FeedbackSignal,
} from './feedback/index.js';

/**
 * Graph kernel tools — Neo4j-backed query tools the agent loop can
 * invoke (portfolio concentration, connected parties, lease network,
 * vacancy clusters). Surfaced under a `tools` namespace so callers
 * write `tools.createGraphKernelTools(graphService)`.
 */
export * as tools from './tools/index.js';

/**
 * Reflection + consolidation cycle — the brain's "sleep" orchestrator
 * that compresses episodic entries into semantic facts, procedural
 * patterns, and reflective digests. The four memory ports above
 * remain the read+write primitives; this layer owns the periodic
 * cycle that runs above them.
 */
export {
  runConsolidationCycle,
  FACT_EXTRACTION_SYSTEM_PROMPT,
  REFLECTIVE_DIGEST_SYSTEM_PROMPT,
  DEFAULT_CONSOLIDATION_CONFIG,
  type ConsolidationConfig,
  type ConsolidationDeps,
  type ConsolidationJudgeCallArgs,
  type ConsolidationJudgePort,
  type ConsolidationLogger,
  type ConsolidationReport,
  type ConsolidationScope,
  type DetectedPattern,
  type ExtractedFact,
  type ReflectiveDigestPayload,
} from './consolidation/index.js';

/**
 * Internal debate + counterfactual reasoning — the "multiple voices
 * in your head" pattern. High-stakes decisions invoke 2–3 voices
 * arguing different angles, then a synthesiser. Counterfactual
 * prompts force the brain to imagine alternative paths.
 */
export {
  runDebate,
  DEFAULT_PROPERTY_DEBATE_VOICES,
  buildCounterfactuals,
  runCounterfactuals,
  type CounterfactualDomain,
  type CounterfactualOutcome,
  type CounterfactualScenario,
  type DebateConfig,
  type DebateContribution,
  type DebateDeps,
  type DebateOutcome,
  type DebatePersona,
  type DebateVoice,
} from './debate/index.js';

/**
 * World model + trajectory prediction — the kernel's "imagination"
 * layer. Forward-simulates property / tenant / owner / agency state
 * vectors so the brain can reason about WHERE THIS IS HEADING, not
 * just the present tense. Mirrors LITFIN's
 * `/src/core/credit-mind/world-model/` borrower-trajectory pattern.
 */
export * as worldModel from './world-model/index.js';

/**
 * Introspection layer — the brain's "self-knowledge" pattern.
 * Decision-trace replay (drift / regression / fairness sweeps) plus
 * per-persona capability cards (Anthropic-style model cards). Closes
 * the assessment gap "the brain doesn't know what it can do."
 */
export * as introspection from './introspection/index.js';

/**
 * Agency layer — goal tracker, plan decomposer, autonomous executor,
 * action-tool registry, and the proactive wake-loop. The kernel itself
 * mixes ACTIVE goals into its system prompt (step 4 extension); the
 * loop runs above the kernel and is scheduled by the api-gateway.
 */
export * as agency from './agency/index.js';

/**
 * Counter-model — second-LLM sanity check on destroy-tier / billing-
 * tier actions BEFORE the four-eye approval gate fires. Central Command
 * Phase B (B5). See `.planning/research/central-command/2025-agentic-
 * admin-patterns.md` §"Counter-model sanity check".
 */
export * as counterModel from './counter-model/index.js';

// Named re-exports for callers that want the counter-model types
// without the namespace import dance (the api-gateway composition
// wiring needs `CounterModel` + `CounterModelLlmClient` at the type
// site).
export {
  createCounterModelReview,
  type CounterModel,
  type CounterModelConfig,
  type CounterModelLlmClient,
  type CounterModelReviewArgs,
  type CounterModelReviewOutcome,
  type CounterModelVerdict,
} from './counter-model/index.js';

/**
 * AG-UI Protocol — brain-↔UI streaming wire. Typed event surface +
 * SSE emitter + kernel-stream → AG-UI adapter. The api-gateway and
 * Next.js admin portal share this contract so generative-UI primitives
 * (charts, forms, KPI grids, etc.) render against a stable type tree.
 */
export {
  createAgUiEmitter,
  pumpKernelToAgUi,
  uuidv7,
  agUiSseHeaders,
  type AgUiEmitterHandle,
  type AgUiEmitterDeps,
  type AgUiOtelSpanRecorder,
  type KernelLikeEvent,
  type KernelToAgUiAdapterDeps,
} from './streaming/ag-ui-emitter.js';
export {
  validateAgUiEvent,
  isAgUiEventType,
  isTerminalAgUiEvent,
  AG_UI_EVENT_TYPES,
  AG_UI_TERMINAL_EVENT_TYPES,
  AG_UI_UI_PART_KINDS,
  type AgUiEvent,
  type AgUiEventType,
  type AgUiTerminalEventType,
  type AgUiUiPart,
  type AgUiUiPartKind,
  type AgUiUsage,
  type JsonPatch,
  type JsonPatchOp,
  type ColumnDef,
  type KpiTile,
  type JsonSchema,
  type WorkflowStep,
  type TimelineEvent,
  type MapMarker,
  type CalendarEvent,
} from './streaming/ag-ui-types.js';

// ─────────────────────────────────────────────────────────────────────
// HQ-tier tool vocabulary (Central Command — gap-closer for C2).
//
// 12 `platform.*` BrainTools the admin chat can invoke to actually RUN
// the company through conversation. Surface includes:
//   - 5 read tools  (list_tenants, list_users, system_health,
//                    list_recent_traces, read_feature_flag)
//   - 4 mutate tools (create_tenant, create_user, set_feature_flag,
//                    run_consolidation_tick)
//   - 1 destroy tool (set_killswitch)
//   - 1 billing tool (adjust_invoice)
//   - 1 external-comm tool (send_announcement)
//
// `seedHqBrainTools(registry, deps)` registers all 12 on the existing
// `BrainToolRegistry`. Composition root in `services/api-gateway`
// wires concrete adapters via `createHqToolRegistry`.
// ─────────────────────────────────────────────────────────────────────

export {
  RISK_TIERS_ORDERED,
  SOVEREIGN_LEDGER_TIERS,
  assertHqToolSpecValid,
  callerCanReachTenant,
  callerHasAllScopes,
  callerHasAnyScope,
  compareRiskTier,
  isSovereignTier,
  requiresCostCeiling,
  scopeMatches,
  type HqCallerScopes,
  type HqOtelSpanRecorder,
  type HqRefusalReasonCode,
  type HqSovereignLedgerSink,
  type HqToolContext,
  type HqToolExecutionResult,
  type HqToolSpec,
  type RiskTier,
} from './risk-tier.js';

export * as hqTools from './tool-spec/hq-tools/index.js';
