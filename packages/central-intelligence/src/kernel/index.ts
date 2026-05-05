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
