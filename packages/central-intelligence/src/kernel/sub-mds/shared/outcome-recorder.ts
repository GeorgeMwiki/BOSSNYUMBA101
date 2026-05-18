/**
 * Outcome recorder — closes the predicted-vs-actual feedback loop
 * (Reflexion-style). Each record is immutable and gets a
 * Reflexion-style critique tag the MD reads back when re-running the
 * redesign stage.
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

export interface OutcomeRecorder {
  record(args: {
    readonly subMdName: string;
    readonly predicted: PredictedOutcome;
    readonly actual: ActualOutcome;
  }): Promise<OutcomeRecord>;
  history(): ReadonlyArray<OutcomeRecord>;
}

const ON_TARGET_BAND = 0.1;

export function createOutcomeRecorder(sink?: OutcomeRecorderSink): OutcomeRecorder {
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
      return rec;
    },
    history() {
      return Object.freeze(history.slice());
    },
  };
}
