/**
 * Outcome recorder — closes the predicted-vs-actual feedback loop
 * (Reflexion-style). Each record is immutable and gets a
 * Reflexion-style critique tag the MD reads back when re-running the
 * redesign stage.
 *
 * Phase E.5.3 wires this to the autonomy-governance SloEvent stream. The
 * `SloEventSink` port is OPTIONAL — when injected, every recorded outcome
 * fans out an SloEvent so the live SLO monitor can demote / rollback
 * misbehaving sub-MDs in real time.
 *
 * To avoid a circular workspace dep between this package and
 * `@bossnyumba/autonomy-governance`, the SloEvent shape is mirrored here
 * structurally. The autonomy-governance side accepts `SloEvent` and is
 * structurally compatible (verified by the cross-package integration
 * test in `packages/autonomy-governance/src/slo/__tests__/slo-stream.test.ts`).
 */

import type { ActualOutcome, PredictedOutcome } from './sub-md-base.js';

export interface OutcomeRecord {
  readonly subMdName: string;
  readonly predicted: PredictedOutcome;
  readonly actual: ActualOutcome;
  /** signed error (actual - predicted) in predicted units. */
  readonly delta: number;
  /** absolute error / predicted magnitude. Clamped to [0, 10]. */
  readonly relativeError: number;
  readonly verdict: 'on-target' | 'under-performed' | 'over-performed';
  readonly recordedAtMs: number;
}

export interface OutcomeRecorderSink {
  record(rec: OutcomeRecord): Promise<void>;
}

/**
 * Structural mirror of
 * `@bossnyumba/autonomy-governance:SloEvent`. The autonomy-governance
 * stream consumer accepts this shape verbatim.
 *
 * `metric` is restricted to the 4 SloMetric values the autonomy-governance
 * package recognises. `outcome-recorder` emits `task-completion-rate` by
 * default because that's the metric every sub-MD always produces (every
 * recorded outcome is by definition a completion event).
 */
export interface SubMdSloEvent {
  readonly subMd: string;
  readonly tenantId: string | null;
  readonly timestamp: string;
  readonly metric:
    | 'resolution-quality'
    | 'task-completion-rate'
    | 'owner-cs-score'
    | 'cost-per-resolution';
  readonly actualValue: number;
  readonly predictedValue?: number;
  readonly delta: number;
}

/**
 * Port for fanning out per-outcome SLO events. Default in tests is
 * `undefined` (no-op). Production composition (kernel boot) wires this
 * to the autonomy-governance stream sink.
 */
export interface SloEventSink {
  emit(event: SubMdSloEvent): Promise<void>;
}

export interface OutcomeRecorderOptions {
  /** Tenant scope tag; passed through to every emitted SloEvent. */
  readonly tenantId?: string | null;
  /** SLO event stream sink — optional. When omitted, no events are emitted. */
  readonly sloEventSink?: SloEventSink;
}

export interface OutcomeRecorder {
  record(args: {
    readonly subMdName: string;
    readonly predicted: PredictedOutcome;
    readonly actual: ActualOutcome;
  }): Promise<OutcomeRecord>;
  history(): ReadonlyArray<OutcomeRecord>;
}

const ON_TARGET_BAND = 0.1;

/**
 * Map the recorded outcome onto an SloEvent. The conversion rule:
 *
 *   actualValue   = actual.value
 *   predictedValue = predicted.value
 *   delta         = computed against an implicit target of `predicted.value`
 *                   (the sub-MD's own forecast), sign-flipped for cost-style
 *                   metrics so "negative delta = breach" holds.
 *
 * The default `metric` is `task-completion-rate` — every outcome record IS
 * a task completion. Callers that want a different metric can override via
 * the explicit `metric` property on the actual outcome's unit field
 * (`unit === 'usd-cents'` → `cost-per-resolution`).
 */
function outcomeToSloEvent(args: {
  readonly subMdName: string;
  readonly predicted: PredictedOutcome;
  readonly actual: ActualOutcome;
  readonly tenantId: string | null;
}): SubMdSloEvent {
  const { subMdName, predicted, actual, tenantId } = args;

  // Pick metric: heuristic — units of `usd-cents` are cost; quality-like
  // units (`score`, `ratio`, anything ≤1) are resolution-quality; default
  // is task-completion-rate.
  let metric: SubMdSloEvent['metric'] = 'task-completion-rate';
  if (actual.unit === 'usd-cents' || predicted.unit === 'usd-cents') {
    metric = 'cost-per-resolution';
  } else if (actual.unit === 'score' || actual.unit === 'ratio') {
    metric = 'resolution-quality';
  }

  // Delta convention: for higher-is-better metrics, delta = actual - target.
  // We use the sub-MD's own prediction as the local target. For
  // cost-per-resolution (lower is better), flip the sign.
  const rawDelta = actual.value - predicted.value;
  const delta = metric === 'cost-per-resolution' ? -rawDelta : rawDelta;

  return Object.freeze({
    subMd: subMdName,
    tenantId,
    timestamp: new Date(actual.recordedAtMs).toISOString(),
    metric,
    actualValue: actual.value,
    predictedValue: predicted.value,
    delta,
  });
}

export function createOutcomeRecorder(
  sinkOrOptions?: OutcomeRecorderSink | OutcomeRecorderOptions,
  legacyOptions?: OutcomeRecorderOptions,
): OutcomeRecorder {
  // Backwards-compatible signature:
  //   createOutcomeRecorder()
  //   createOutcomeRecorder(sink)
  //   createOutcomeRecorder(sink, options)
  //   createOutcomeRecorder(options)
  let sink: OutcomeRecorderSink | undefined;
  let options: OutcomeRecorderOptions;
  if (isSink(sinkOrOptions)) {
    sink = sinkOrOptions;
    options = legacyOptions ?? {};
  } else {
    sink = undefined;
    options = sinkOrOptions ?? {};
  }
  const tenantId: string | null = options.tenantId ?? null;
  const sloEventSink = options.sloEventSink;

  const history: OutcomeRecord[] = [];
  return {
    async record(args) {
      const { subMdName, predicted, actual } = args;
      const delta = actual.value - predicted.value;
      const denom = Math.abs(predicted.value) < 1e-6 ? 1 : Math.abs(predicted.value);
      const relativeError = Math.min(10, Math.abs(delta) / denom);
      const verdict: OutcomeRecord['verdict'] =
        relativeError <= ON_TARGET_BAND
          ? 'on-target'
          : delta < 0
            ? 'under-performed'
            : 'over-performed';
      const rec: OutcomeRecord = Object.freeze({
        subMdName,
        predicted: Object.freeze({ ...predicted }),
        actual: Object.freeze({ ...actual }),
        delta,
        relativeError,
        verdict,
        recordedAtMs: actual.recordedAtMs,
      });
      history.push(rec);
      if (sink) {
        await sink.record(rec);
      }
      if (sloEventSink) {
        const event = outcomeToSloEvent({
          subMdName,
          predicted,
          actual,
          tenantId,
        });
        await sloEventSink.emit(event);
      }
      return rec;
    },
    history() {
      return Object.freeze(history.slice());
    },
  };
}

function isSink(x: unknown): x is OutcomeRecorderSink {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as { record?: unknown }).record === 'function' &&
    typeof (x as { emit?: unknown }).emit !== 'function'
  );
}
