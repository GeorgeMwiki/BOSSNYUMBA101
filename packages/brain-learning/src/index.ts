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
  type TraceLoggerPorts,
  type LogTraceInput,
  type TraceEventStore,
  type RedactionPipeline,
  type RedactionInput,
  type RedactionOutput,
} from './trace-logger/index.js';

// 2. owner-reaction-capture
export {
  captureReaction,
  type CaptureReactionInput,
  type FeedbackEventStore,
  type OwnerReactionPorts,
} from './owner-reaction-capture/index.js';

// 3. preference-pair-builder
export {
  buildPreferencePairs,
  pairToJsonlRow,
  MIN_PAIRS_BEFORE_TUNING,
  REJECTED_PERCENTILE_TARGET,
  type BuildPreferencePairsInput,
  type PreferencePairSources,
} from './preference-pair-builder/index.js';

// 4. active-learning-queue
export {
  enqueueActiveLearningItem,
  buildDailyDigest,
  recordDecline,
  MAX_ITEMS_PER_LABELLER_PER_DAY,
  DECLINE_DEPRIORITISE_THRESHOLD,
  type ActiveLearningPorts,
  type ActiveLearningItemStore,
  type EnqueueInput,
} from './active-learning-queue/index.js';

// 5. eval-driven-iteration
export {
  runEvalCycle,
  REGRESSION_ALERT_THRESHOLD_PP,
  type EvalCyclePorts,
  type InspectHarnessPort,
  type EvalScenarioRun,
} from './eval-driven-iteration/index.js';

// 6. skill-curation
export {
  runSkillCuration,
  PROMOTION_MIN_RUNS,
  PROMOTION_MIN_FEEDBACK_RATIO,
  QUARANTINE_CATASTROPHIC_FAILURES,
  QUARANTINE_CONFIDENCE_DROP_PCT,
  type SkillCurationPorts,
  type SkillRegistryPort,
  type SkillPromotionGatePort,
} from './skill-curation/index.js';

// 7. knowledge-graph-growth
export {
  runKGGrowthCycle,
  EDGE_HALF_LIFE_DAYS,
  ORPHAN_NODE_ARCHIVE_DAYS,
  DEFAULT_PER_TENANT_NODE_CEILING,
  type KGGrowthPorts,
  type TemporalKGPort,
  type KGGrowthConfig,
} from './knowledge-graph-growth/index.js';

// 8. distilled-student-infra
export {
  OllamaClient,
  VLLMClient,
  BedrockHaikuClient,
  resolveStudentClient,
  type IStudentModelClient,
  type StudentInvokeInput,
  type StudentInvokeOutput,
  type StudentResolutionInput,
} from './distilled-student-infra/index.js';

// 9. 90-day-cycle-tracker
export {
  buildWeeklyDigest,
  renderCapabilityCardPayload,
  type CycleTrackerPorts,
  type CycleTrackerSources,
} from './cycle-tracker/index.js';
