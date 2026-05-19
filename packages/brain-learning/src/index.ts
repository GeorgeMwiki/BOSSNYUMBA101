/**
 * @bossnyumba/brain-learning
 *
 * Phase N-E — runtime learning + self-improvement substrate.
 *
 * Anthropic does not allow fine-tuning Claude in 2026, so this package
 * splits learning into:
 *   (a) a **runtime layer** that works on any model — trace logging,
 *       owner-reaction capture, active learning, skill curation, KG
 *       growth, eval-driven iteration, 90-day cycle reporting, and
 *   (b) a **data pipeline** that feeds self-hosted student models
 *       (Qwen / Llama / Mistral) — preference-pair builder + distilled
 *       student infra.
 *
 * The 9 modules:
 *   1. trace-logger             — every conversation captured + 4-layer PII
 *   2. owner-reaction-capture   — 9 reaction kinds → feedback events
 *   3. preference-pair-builder  — DPO/KTO/SimPO/PRM step-DPO JSONL
 *   4. active-learning-queue    — uncertainty sampling for human labelling
 *   5. eval-driven-iteration    — K-D Inspect drives 5pp regression alerts
 *   6. skill-curation           — auto-promote/quarantine on top of K-C
 *   7. knowledge-graph-growth   — edge decay + ceiling eviction on K-D
 *   8. distilled-student-infra  — IStudentModelClient + 3 adapters
 *   9. 90-day-cycle-tracker     — internal admin weekly digest
 *
 * All wire-side persistence is delegated to ports. The package has no
 * direct dependency on the database or kernel substrate.
 */

export * from './types.js';

// 1. trace-logger
export {
  logTrace,
  storageTierFor,
  isAlreadyLogged,
  makeRedactionPipeline,
  redactByRegex,
  applyConsentGate,
} from './trace-logger/index.js';
export type {
  TraceLoggerPorts,
  LogTraceInput,
  LogTraceOutcome,
  TraceEventStore,
  RedactionPipeline,
  RedactionInput,
  RedactionOutput,
  RedactionPipelineConfig,
  MLRedactor,
  CanaryChecker,
} from './trace-logger/index.js';

// 2. owner-reaction-capture
export {
  captureReaction,
  validateFeedbackPayload,
  isPositiveReaction,
  isNegativeReaction,
} from './owner-reaction-capture/index.js';
export type {
  CaptureReactionInput,
  CaptureReactionOutcome,
  FeedbackEventStore,
  OwnerReactionPorts,
} from './owner-reaction-capture/index.js';

// 3. preference-pair-builder
export {
  buildPreferencePairs,
  pairToJsonlRow,
  applyQualityFilter,
  hasMinimumCohort,
  generateKtoFromThumbs,
  generateDpoFromRegenerateThenAccept,
  generateDpoFromOwnerEdit,
  generateKtoFromStarRating,
  generatePrmStepDpoFromToolRecovery,
  MIN_PAIRS_BEFORE_TUNING,
  MIN_CHOSEN_QUALITY,
  REJECTED_PERCENTILE_TARGET,
} from './preference-pair-builder/index.js';
export type {
  BuildPreferencePairsInput,
  BuildPreferencePairsResult,
  PreferencePairSources,
  FeedbackEventReader,
  ToolRecoveryFeed,
  GeneratorDeps,
  TurnContentResolver,
  QualityScorer,
  ToolFailThenSucceedInput,
  QualityFilterInput,
  QualityVerdict,
} from './preference-pair-builder/index.js';

// 4. active-learning-queue
export {
  enqueueActiveLearningItem,
  buildDailyDigest,
  recordDecline,
  checkActiveLearningTrigger,
  MAX_ITEMS_PER_LABELLER_PER_DAY,
  DECLINE_DEPRIORITISE_THRESHOLD,
  CONFIDENCE_TRIGGER_THRESHOLD,
  PRM_STEP_TRIGGER_THRESHOLD,
  CALIBRATION_DRIFT_THRESHOLD,
} from './active-learning-queue/index.js';
export type {
  ActiveLearningPorts,
  ActiveLearningItemStore,
  EnqueueInput,
  EnqueueOutcome,
  RecordDeclineInput,
  RecordDeclineOutcome,
  TriggerCheckInput,
} from './active-learning-queue/index.js';

// 5. eval-driven-iteration
export {
  runEvalCycle,
  checkRegression,
  failedScenarioToPair,
  REGRESSION_ALERT_THRESHOLD_PP,
} from './eval-driven-iteration/index.js';
export type {
  EvalCyclePorts,
  InspectHarnessPort,
  EvalScenarioRun,
  PreferencePairSink,
} from './eval-driven-iteration/index.js';

// 6. skill-curation
export {
  runSkillCuration,
  evaluateSkill,
  PROMOTION_MIN_RUNS,
  PROMOTION_MIN_FEEDBACK_RATIO,
  QUARANTINE_CATASTROPHIC_FAILURES,
  QUARANTINE_CONFIDENCE_DROP_PCT,
} from './skill-curation/index.js';
export type {
  SkillCurationPorts,
  SkillCurationResult,
  SkillRegistryPort,
  SkillPromotionGatePort,
  SkillRecord,
  SkillEvaluationInput,
} from './skill-curation/index.js';

// 7. knowledge-graph-growth
export {
  runKGGrowthCycle,
  decayConfidence,
  resolveKGConflict,
  defaultGrowthConfig,
  EDGE_HALF_LIFE_DAYS,
  ORPHAN_NODE_ARCHIVE_DAYS,
  DEFAULT_PER_TENANT_NODE_CEILING,
} from './knowledge-graph-growth/index.js';
export type {
  KGGrowthPorts,
  TemporalKGPort,
  KGObservationCandidate,
  KGEdgeForDecay,
  KGNodeForArchive,
  KGGrowthConfig,
  KGObservation,
} from './knowledge-graph-growth/index.js';

// 8. distilled-student-infra
export {
  OllamaClient,
  VLLMClient,
  BedrockHaikuClient,
  resolveStudentClient,
} from './distilled-student-infra/index.js';
export type {
  IStudentModelClient,
  StudentInvokeInput,
  StudentInvokeOutput,
  StudentResolutionInput,
  NcCostCascadeFallback,
} from './distilled-student-infra/index.js';

// 9. cycle-tracker (90-day-cycle-tracker)
export {
  buildWeeklyDigest,
  renderCapabilityCardPayload,
} from './cycle-tracker/index.js';
export type {
  CycleTrackerPorts,
  CycleTrackerSources,
  CapabilityCardPayload,
  CapabilityCardMetric,
  CapabilityCardChart,
} from './cycle-tracker/index.js';
