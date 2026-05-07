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
  type PolicyGateInput,
  type PolicyGateOutput,
} from './policy-gate.js';
export {
  checkSelfAwareness,
  type SelfAwarenessInput,
  type SelfAwarenessOutput,
} from './self-awareness.js';
export {
  inferMindState,
  renderMindStateDirective,
  type MindState,
  type Urgency,
  type Expertise,
  type Mode,
} from './theory-of-mind.js';
export {
  assessCognitiveLoad,
  renderLoadDirective,
  type CognitiveLoadInput,
  type CognitiveLoadOutput,
} from './cognitive-load.js';
export { scoreConfidence, type ConfidenceInput } from './confidence.js';
export { normalize, type NormaliserOutput } from './normalizer.js';
export {
  createBrainCache,
  thoughtCacheKey,
  type BrainCache,
  type BrainCacheDeps,
} from './brain-cache.js';
export {
  createSensorRouter,
  SensorFailoverError,
  type SensorRouter,
  type SensorFailoverDeps,
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
  renderGradeBriefing,
  type PropertyGrade,
  type GradeBand,
  type GradeInputs,
} from './continuous-grading.js';
export {
  createBrainKernel,
  type BrainKernel,
  type BrainKernelDeps,
} from './kernel.js';
export {
  createApprovalGate,
  createInMemoryApprovalStore,
  type ApprovalGate,
  type ApprovalGateDeps,
  type ApprovalRecord,
  type ApprovalSignature,
  type ApprovalStatus,
  type ApprovalStore,
  type ProposedAction,
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
} from './sensors/anthropic-judge.js';
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
