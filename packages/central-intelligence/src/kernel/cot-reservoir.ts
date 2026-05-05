/**
 * CoT reservoir — sampled chain-of-thought capture for audit replay.
 *
 * Storing every chain-of-thought is too expensive; storing none means
 * a regulator who later asks "why did the system say X?" gets nothing
 * to inspect. The reservoir is a probabilistic sample biased toward
 * high-stakes decisions:
 *
 *   stakes='low'      → 1% sample
 *   stakes='medium'   → 5% sample
 *   stakes='high'     → 50% sample
 *   stakes='critical' → 100% sample
 *
 * The sink interface is storage-agnostic; production binds to the
 * `cot_reservoir` Postgres table, tests use an in-memory recorder.
 */

import type { CotSample, CotReservoirSink, ThoughtRequest } from './kernel-types.js';

const SAMPLE_RATES: Record<ThoughtRequest['stakes'], number> = {
  low: 0.01,
  medium: 0.05,
  high: 0.5,
  critical: 1.0,
};

export interface CotReservoirDeps {
  readonly sink: CotReservoirSink;
  /** Injectable RNG so tests can be deterministic. */
  readonly rng?: () => number;
}

export interface CotReservoirCaptureInput {
  readonly thoughtId: string;
  readonly threadId: string;
  readonly stakes: ThoughtRequest['stakes'];
  readonly thoughtText: string | null;
  readonly capturedAt: string;
}

export interface CotReservoir {
  maybeCapture(input: CotReservoirCaptureInput): Promise<{ sampled: boolean }>;
}

export function createCotReservoir(deps: CotReservoirDeps): CotReservoir {
  const rng = deps.rng ?? Math.random;
  return {
    async maybeCapture(input) {
      if (!input.thoughtText) return { sampled: false };
      const rate = SAMPLE_RATES[input.stakes];
      if (rng() >= rate) return { sampled: false };
      const sample: CotSample = {
        thoughtId: input.thoughtId,
        threadId: input.threadId,
        stakes: input.stakes,
        thoughtText: input.thoughtText,
        capturedAt: input.capturedAt,
      };
      await deps.sink.capture(sample);
      return { sampled: true };
    },
  };
}

/**
 * In-memory sink useful for tests. Production wires a Postgres-backed
 * sink at the composition root.
 */
export function createInMemoryCotReservoirSink(): CotReservoirSink & {
  samples(): ReadonlyArray<CotSample>;
} {
  const buf: CotSample[] = [];
  return {
    async capture(sample: CotSample): Promise<void> {
      buf.push(sample);
    },
    samples(): ReadonlyArray<CotSample> {
      return buf.slice();
    },
  };
}

/**
 * In-memory persona-drift sink — companion to the Cot one. Used in
 * tests to assert what the kernel detected.
 */
import type { PersonaDriftEvent, PersonaDriftSink, ProvenanceRecord, ProvenanceSink } from './kernel-types.js';

export function createInMemoryPersonaDriftSink(): PersonaDriftSink & {
  events(): ReadonlyArray<PersonaDriftEvent>;
} {
  const buf: PersonaDriftEvent[] = [];
  return {
    async record(event: PersonaDriftEvent): Promise<void> {
      buf.push(event);
    },
    events(): ReadonlyArray<PersonaDriftEvent> {
      return buf.slice();
    },
  };
}

export function createInMemoryProvenanceSink(): ProvenanceSink & {
  records(): ReadonlyArray<ProvenanceRecord>;
} {
  const buf: ProvenanceRecord[] = [];
  return {
    async record(rec: ProvenanceRecord): Promise<void> {
      buf.push(rec);
    },
    records(): ReadonlyArray<ProvenanceRecord> {
      return buf.slice();
    },
  };
}
