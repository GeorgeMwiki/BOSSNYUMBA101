/**
 * Self-Consistency — Wang 2022, arxiv 2203.11171.
 *
 * Run N samples → majority-vote on the structured output → emit
 * `{ value, confidence, samples }`. Confidence is `winningCount / N`.
 *
 * Default N = 5. Configurable 3..9. Used for:
 *   - late-fee compute
 *   - rent proration
 *   - currency convert
 *   - KRA-MRI compute
 *   - arrears compound interest
 *
 * Closes L1 #9 and L3 #8.
 */

import type {
  ConsistencyResult,
  ConsistencySample,
  Verdict,
} from '../types.js';
import { systemClock, type Clock } from '../ports/clock.js';
import type { SamplerPort, NumericPromptInput } from './sampler.js';

export interface ConsistentComputeDeps {
  readonly sampler: SamplerPort;
  readonly clock?: Clock;
  /** Number of samples (3..9). Default 5. */
  readonly n?: number;
  /**
   * Number of decimals to round to when bucketing samples for majority
   * vote. Use `0` for integers (counts, money in minor units), `2` for
   * currency in major units, `4` for ratios. Default 2.
   */
  readonly bucketDecimals?: number;
  /** Min confidence to consider the result usable. Default 0.6. */
  readonly minConfidence?: number;
  /** Run samples in parallel? Default true. */
  readonly parallel?: boolean;
}

const DEFAULTS = {
  n: 5,
  bucketDecimals: 2,
  minConfidence: 0.6,
  parallel: true,
} as const;

/**
 * Run Self-Consistency on a numeric prompt.
 *
 * Returns the majority value, its confidence, and the per-sample
 * record. The verdict is:
 *   - `pass` when confidence >= minConfidence
 *   - `flag` when below threshold (caller should escalate)
 *   - `fail` when N samples all returned NaN (sampler is broken)
 */
export async function consistentCompute(
  input: NumericPromptInput,
  deps: ConsistentComputeDeps,
): Promise<ConsistencyResult> {
  const clock = deps.clock ?? systemClock;
  const start = clock.monotonicMs();
  const nRaw = deps.n ?? DEFAULTS.n;
  const n = Math.max(3, Math.min(9, nRaw));
  const decimals = deps.bucketDecimals ?? DEFAULTS.bucketDecimals;
  const minConfidence = deps.minConfidence ?? DEFAULTS.minConfidence;
  const parallel = deps.parallel ?? DEFAULTS.parallel;

  const rawValues = parallel
    ? await Promise.all(
        Array.from({ length: n }, (_, i) => callSampler(deps.sampler, input, i)),
      )
    : await runSerial(deps.sampler, input, n);

  const samples: ConsistencySample[] = rawValues.map((rawValue, index) => ({
    index,
    rawValue,
    normalisedValue: Number.isFinite(rawValue) ? bucket(rawValue, decimals) : NaN,
  }));

  // Drop NaN samples for the majority vote but track failure rate.
  const validSamples = samples.filter((s) => Number.isFinite(s.normalisedValue));
  if (validSamples.length === 0) {
    return {
      value: Number.NaN,
      confidence: 0,
      samples,
      n,
      winningCount: 0,
      verdict: 'fail' as Verdict,
      elapsedMs: clock.monotonicMs() - start,
    };
  }

  const counts = new Map<number, number>();
  for (const s of validSamples) {
    counts.set(s.normalisedValue, (counts.get(s.normalisedValue) ?? 0) + 1);
  }
  let winningValue = validSamples[0]!.normalisedValue;
  let winningCount = 0;
  for (const [value, count] of counts) {
    if (count > winningCount) {
      winningValue = value;
      winningCount = count;
    } else if (count === winningCount && value < winningValue) {
      // Tie-break by smaller value for determinism.
      winningValue = value;
    }
  }
  const confidence = winningCount / n;
  const verdict: Verdict = confidence >= minConfidence ? 'pass' : 'flag';

  return {
    value: winningValue,
    confidence,
    samples,
    n,
    winningCount,
    verdict,
    elapsedMs: clock.monotonicMs() - start,
  };
}

async function callSampler(
  sampler: SamplerPort,
  input: NumericPromptInput,
  _index: number,
): Promise<number> {
  try {
    return await sampler.sample(input);
  } catch {
    return Number.NaN;
  }
}

async function runSerial(
  sampler: SamplerPort,
  input: NumericPromptInput,
  n: number,
): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push(await callSampler(sampler, input, i));
  }
  return out;
}

function bucket(value: number, decimals: number): number {
  const m = Math.pow(10, decimals);
  return Math.round(value * m) / m;
}
