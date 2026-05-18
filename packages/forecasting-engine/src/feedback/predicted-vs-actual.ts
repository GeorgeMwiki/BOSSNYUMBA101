/**
 * predicted-vs-actual — reconcile predictions with reality.
 *
 * A record-keeper. The orchestrator emits a `Prediction` at simulate-
 * time; later, when the action's real outcome lands, the caller
 * provides the `actual` and we compute the delta.
 */

import type { ForecastBand, PredictedActualDelta } from '../types.js';

export interface Prediction {
  readonly id: string;
  readonly metric: string;
  readonly band: ForecastBand;
  readonly createdAtMs: number;
}

export function computeDelta(
  prediction: Prediction,
  actual: number,
): PredictedActualDelta {
  const absoluteError = Math.abs(actual - prediction.band.p50);
  const relativeError =
    Math.abs(prediction.band.p50) > 1e-9
      ? absoluteError / Math.abs(prediction.band.p50)
      : 0;
  const withinP10P90 =
    actual >= prediction.band.p10 && actual <= prediction.band.p90;
  return {
    predictionId: prediction.id,
    metric: prediction.metric,
    predictedP50: prediction.band.p50,
    actual,
    absoluteError,
    relativeError,
    withinP10P90,
  };
}

export interface PredictionStore {
  put(p: Prediction): void;
  get(id: string): Prediction | undefined;
  list(): ReadonlyArray<Prediction>;
}

export function createPredictionStore(): PredictionStore {
  let map: ReadonlyMap<string, Prediction> = new Map();
  return {
    put(p) {
      const next = new Map(map);
      next.set(p.id, p);
      map = next;
    },
    get(id) {
      return map.get(id);
    },
    list() {
      return Array.from(map.values());
    },
  };
}
