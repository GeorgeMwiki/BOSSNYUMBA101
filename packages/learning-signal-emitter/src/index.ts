/**
 * `@bossnyumba/learning-signal-emitter` — public surface.
 *
 * One (action, outcome) → reward-scored → per-power-tier isolation-gated →
 * fanned out to injected sinks (belief / reflexion / mastery / pattern /
 * persona / preference). The brain layer (Mr. Mwikila) emits one
 * {@link LearningSignal} per pair; the emitter never writes a belief directly —
 * the belief sink wraps the belief-engine convince-loop.
 *
 * Wire the sinks (and an optional append-only store + audit) at the kernel
 * composition root with {@link wireLearningSignalEmitter}, behind the default-
 * OFF flag {@link LEARNING_SIGNAL_EMITTER_FLAG}. No direct DB/SDK/env access —
 * every side effect is an injected port.
 *
 * Overlap note: this is distinct from `@bossnyumba/continuous-learning` (a
 * data-gathering loop over field extractions → prioritised questions). This
 * package is the reward-scored (action, outcome) → learning-primitive fan-out
 * and shares no types with it.
 *
 * @module @bossnyumba/learning-signal-emitter
 */

// Types + boundary schemas
export * from './types.js';

// Injected ports (seams) + default clock
export * from './ports.js';

// Reward model (pure)
export {
  scoreAction,
  rewardOf,
  DEFAULT_WEIGHTS,
  type ScoreActionInput,
} from './reward-model.js';

// Per-tier isolation gate (pure)
export {
  enforceIsolation,
  isolationAllowed,
  DEFAULT_K_ANONYMITY,
  type IsolationCheckInput,
  type IsolationResult,
} from './per-tier-isolation.js';

// Signal emitter + fan-out
export {
  emitSignal,
  buildSignal,
  buildSignalHash,
  routePlan,
  type EmitInput,
} from './signal-emitter.js';

// In-memory reference store (tests + dev)
export {
  createInMemorySignalStore,
  type InMemoryStoreHandle,
} from './in-memory-store.js';

// Composition root (default-OFF feature flag)
export {
  wireLearningSignalEmitter,
  LEARNING_SIGNAL_EMITTER_FLAG,
  type LearningSignalEmitter,
  type LearningSignalEmitterDeps,
  type WireLearningSignalEmitterDeps,
  type EmitFacadeInput,
} from './wire.js';
