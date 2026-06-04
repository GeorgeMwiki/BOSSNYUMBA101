/**
 * `@bossnyumba/belief-engine` — public surface.
 *
 * Epistemic belief layer for the property operating system. Pure logic with
 * an injected {@link BeliefStorePort}; the engine NEVER writes a belief
 * directly — every write routes through {@link reviseBelief} → convince-loop →
 * store.upsert, and a revision only replaces a value when the confidence delta
 * clears the 0.25 gate (0.05-0.25 queues for review; below 0.05 is a no-op).
 *
 * Beliefs are property facts: tenant reliability, unit demand, arrears risk,
 * rent comparables. Also ships a DPO preference-learner, a LinUCB contextual
 * bandit, Mem0 ADD/UPDATE/DELETE/NOOP fact semantics, and a nightly Pearson
 * belief×outcome correlation pass.
 *
 * Wire it at the composition root with {@link wireBeliefEngine} behind the
 * default-OFF flag {@link BELIEF_ENGINE_FLAG}; the in-memory store ships for
 * tests + local dev. No direct DB/SDK/env access — every side effect is an
 * injected port.
 *
 * @module @bossnyumba/belief-engine
 */

// Domain types + boundary schemas
export * from './types';

// Injected ports (store, web-search, outcome fetcher, audit sink, clock).
// `safeFetch` stays internal — it is intentionally NOT re-exported here.
export {
  systemClock,
  NO_WEB_SEARCH,
  emitAudit,
  type Clock,
  type BeliefStorePort,
  type WebSearchPort,
  type OutcomeRow,
  type OutcomeFetcher,
  type BeliefAuditSink,
} from './ports';

// Belief store (pure helpers)
export { makeSubjectKey, computeConfidence, clamp01 } from './belief-store';

// In-memory reference adapter (tests + local dev)
export {
  createInMemoryBeliefStore,
  type InMemoryBeliefStore,
} from './in-memory-store';

// Convince-loop + guarded revise entry
export {
  convinceLoop,
  sanitizeSearchQuery,
  REVISE_DELTA_THRESHOLD,
  SPLIT_DELTA_THRESHOLD,
  QUARANTINE_REVISE_FLOOR,
  type ConvinceArgs,
  type ConvinceDeps,
} from './convince-loop';
export { reviseBelief, type ReviseBeliefDeps } from './revise-belief';

// Value comparison + evidence weighting (pure)
export { valuesOverlap, SCALAR_TOLERANCE_PCT } from './value-overlap';
export {
  newSideEvidenceWeight,
  priorSideEvidenceWeight,
  ageInDays,
  PORTAL_AUTHORITY,
} from './evidence-weight';

// DPO preference-learner (pure)
export {
  createHeadState,
  trainHead,
  predictWinProbability,
  dpoLoss,
  rankByPreferenceHead,
  inferModalDimension,
  DEFAULT_TRAIN_CONFIG,
  type PreferenceHeadState,
  type TrainConfig,
} from './preference-learner';
export type { PreferencePair, TenantScope } from './learning-types';

// LinUCB contextual bandit (pure)
export {
  createArmState,
  ucbScore,
  updateArmState,
  selectArmByUcb,
  type ArmState,
  type FeatureVector,
  type LinUcbConfig,
} from './bandit';

// Mem0 ADD/UPDATE/DELETE/NOOP semantics (pure)
export {
  decideMem0Op,
  describeMem0Decision,
  type Mem0Decision,
  type Mem0Candidate,
  type Mem0ExistingFact,
  type DecideMem0Options,
} from './mem0-semantics';

// Nightly Pearson belief×outcome correlation pass
export {
  findCorrelations,
  pearson,
  DEFAULT_MIN_SAMPLE,
  R_THRESHOLD,
  P_THRESHOLD,
  type FindCorrelationsArgs,
  type FindCorrelationsDeps,
  type PearsonResult,
} from './correlation-detector';

// Composition root (default-OFF feature flag)
export {
  wireBeliefEngine,
  BELIEF_ENGINE_FLAG,
  type BeliefEngine,
  type BeliefEngineDeps,
  type BeliefEngineResult,
  type WireBeliefEngineDeps,
} from './wire';
