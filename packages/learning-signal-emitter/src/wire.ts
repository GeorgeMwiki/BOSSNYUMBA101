/**
 * Learning-signal-emitter — composition root (default-OFF feature flag).
 *
 * The emitter ships behind a flag that is OFF unless explicitly enabled. This
 * package stays ENV-FREE: it never reads `process.env`. The caller (the kernel
 * composition root) reads the flag `BOSSNYUMBA_FEATURE_LEARNING_SIGNAL_EMITTER`
 * and passes the resolved boolean as `deps.enabled`. When the flag is off,
 * {@link wireLearningSignalEmitter} returns `null` and the kernel simply never
 * wires the emitter into the action→outcome pipeline.
 *
 * The returned {@link LearningSignalEmitter} is a thin, dependency-bound facade
 * over {@link emitSignal}: the host calls `emitter.handle(request)` once per
 * (action, outcome) pair without re-threading sinks/store each time. The input
 * is validated at the boundary with zod; a malformed payload yields a blocked
 * {@link EmissionResult} rather than throwing into the caller.
 *
 * @module @bossnyumba/learning-signal-emitter/wire
 */

import { emitSignal, type SignalSinks } from './signal-emitter.js';
import type { Clock, SignalAuditSink, SignalStore } from './ports.js';
import {
  emitRequestSchema,
  type ActionEvent,
  type EmissionResult,
  type LearningSignal,
  type OutcomeEvent,
  type RewardWeights,
  type SignalRoute,
} from './types.js';

/** The canonical feature-flag name. READ BY THE CALLER, never by this package. */
export const LEARNING_SIGNAL_EMITTER_FLAG =
  'BOSSNYUMBA_FEATURE_LEARNING_SIGNAL_EMITTER' as const;

/** Static deps bound once at wire time and reused across every emission. */
export interface LearningSignalEmitterDeps {
  /** Fan-out targets. The belief sink is the sole authorised belief writer. */
  readonly sinks?: SignalSinks;
  /** Optional append-only persistence for emitted signals. */
  readonly store?: SignalStore;
  /** Optional fire-and-forget audit. */
  readonly audit?: SignalAuditSink;
  /** Injectable clock (reserved for future time-stamping; tests pass a fake). */
  readonly clock?: Clock;
  /** Default reward weights when a request omits an override. */
  readonly weights?: RewardWeights;
  /** Default k-anonymity floor for platform rollups. */
  readonly kAnonymity?: number;
}

/**
 * Dependencies for {@link wireLearningSignalEmitter}. Extends the static deps
 * with a single `enabled` boolean that the caller derives from the feature
 * flag.
 */
export interface WireLearningSignalEmitterDeps
  extends LearningSignalEmitterDeps {
  /**
   * Resolved value of `BOSSNYUMBA_FEATURE_LEARNING_SIGNAL_EMITTER`. The
   * composition root computes `flagValue === 'on'` and passes the boolean
   * here; this package never touches the environment itself.
   */
  readonly enabled: boolean;
}

/** One inbound (action, outcome) pair to emit. */
export interface EmitFacadeInput {
  readonly action: ActionEvent;
  readonly outcome: OutcomeEvent;
  readonly weights?: RewardWeights;
  readonly cohortSize?: number;
  readonly kAnonymity?: number;
}

/** Dependency-bound emitter facade returned by {@link wireLearningSignalEmitter}. */
export interface LearningSignalEmitter {
  /**
   * Emit one signal for an (action, outcome) pair. The input is validated at
   * the boundary with zod; a malformed payload yields a `validation-blocked`
   * {@link EmissionResult} (routedTo `['no-route']`) rather than throwing.
   */
  handle(input: EmitFacadeInput): Promise<EmissionResult>;
}

/** Build the blocked result returned when the boundary schema rejects input. */
function validationBlocked(reason: string): EmissionResult {
  const emptySignal: LearningSignal = Object.freeze({
    signalHash: '',
    actionRef: '',
    actionKind: 'other',
    reward: 0,
    components: Object.freeze({
      sla: 0,
      override: 0,
      complaint: 0,
      compliance: 0,
      cost: 0,
      satisfaction: 0,
    }),
    tenantScope: 'platform',
    subjectUserId: null,
    subjectOrgId: null,
    emittedBy: 'bossnyumba-signal-emitter:v1',
    decisionTraceId: null,
    capturedAt: '',
  });
  return Object.freeze({
    signal: emptySignal,
    routedTo: Object.freeze(['no-route'] as ReadonlyArray<SignalRoute>),
    notes: Object.freeze([`validation blocked: ${reason}`]),
  });
}

/**
 * Wire the learning-signal emitter behind its feature flag.
 *
 * Returns a bound {@link LearningSignalEmitter} when `deps.enabled` is true, or
 * `null` when the flag is off (default). Returning `null` is the single,
 * explicit signal the caller uses to skip wiring the emitter entirely.
 */
export function wireLearningSignalEmitter(
  deps: WireLearningSignalEmitterDeps,
): LearningSignalEmitter | null {
  if (!deps.enabled) return null;

  return {
    handle: async (input: EmitFacadeInput): Promise<EmissionResult> => {
      const parsed = emitRequestSchema.safeParse(input);
      if (!parsed.success) {
        return validationBlocked(parsed.error.issues[0]?.message ?? 'invalid');
      }
      // `input.action` / `input.outcome` are already the correctly-typed
      // domain objects; the zod parse above is the boundary guard. We forward
      // the ORIGINAL typed values (not parsed.data) so the exact-optional
      // property shape is preserved under exactOptionalPropertyTypes.
      const weights = input.weights ?? deps.weights;
      return emitSignal({
        action: input.action,
        outcome: input.outcome,
        ...(weights ? { weights } : {}),
        ...(deps.sinks ? { sinks: deps.sinks } : {}),
        ...(deps.store ? { store: deps.store } : {}),
        ...(deps.audit ? { audit: deps.audit } : {}),
        ...(input.cohortSize !== undefined
          ? { cohortSize: input.cohortSize }
          : {}),
        ...(input.kAnonymity !== undefined
          ? { kAnonymity: input.kAnonymity }
          : deps.kAnonymity !== undefined
            ? { kAnonymity: deps.kAnonymity }
            : {}),
      });
    },
  };
}
