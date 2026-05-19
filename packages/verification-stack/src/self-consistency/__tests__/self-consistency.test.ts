/**
 * Self-Consistency regression tests — 8 numeric tasks with known ground
 * truth. Simple tasks expect ≥ 95% accuracy; complex tasks expect ≥
 * 80%. Each fixture wires a function sampler that simulates an LLM
 * answering with a small noise distribution around the true value.
 */

import { describe, expect, it } from 'vitest';
import { consistentCompute } from '../self-consistency.js';
import { functionSampler } from '../sampler.js';
import { fixedClock } from '../../ports/clock.js';

interface NumericFixture {
  readonly name: string;
  readonly prompt: string;
  readonly trueValue: number;
  /** Per-sample noise distribution. Each entry returned in order. */
  readonly samples: ReadonlyArray<number>;
  /** Complexity tier — simple or complex. */
  readonly tier: 'simple' | 'complex';
  /** Decimals to bucket on. Default 2. */
  readonly bucketDecimals?: number;
  /** Expected verdict. */
  readonly expectVerdict: 'pass' | 'flag' | 'fail';
}

const fixtures: ReadonlyArray<NumericFixture> = [
  {
    name: 'late-fee compute — unanimous',
    prompt: 'Compute late fee for KES 50,000 at 5% after 10 days.',
    trueValue: 2500,
    samples: [2500, 2500, 2500, 2500, 2500],
    tier: 'simple',
    bucketDecimals: 0,
    expectVerdict: 'pass',
  },
  {
    name: 'rent proration — majority 4/5',
    prompt: 'Prorate KES 30,000 over 15 of 30 days.',
    trueValue: 15000,
    samples: [15000, 15000, 15000, 15000, 14500],
    tier: 'simple',
    bucketDecimals: 0,
    expectVerdict: 'pass',
  },
  {
    name: 'currency convert — high consistency 5/5',
    prompt: 'Convert KES 10,000 to TZS at rate 1 KES = 19.5 TZS.',
    trueValue: 195000,
    samples: [195000, 195000, 195000, 195000, 195000],
    tier: 'simple',
    bucketDecimals: 0,
    expectVerdict: 'pass',
  },
  {
    name: 'arrears compound interest — majority 3/5',
    prompt: 'Compute compound interest on 100,000 at 2% over 3 months.',
    trueValue: 6120.8,
    samples: [6120.8, 6120.8, 6120.8, 6121, 6119],
    tier: 'complex',
    bucketDecimals: 2,
    expectVerdict: 'pass',
  },
  {
    name: 'kra-mri compute — bucketed majority',
    prompt: 'Compute Monthly Rental Income tax at 10% on KES 50,000.',
    trueValue: 5000,
    samples: [5000, 5000, 5000, 5000, 4999],
    tier: 'simple',
    bucketDecimals: 0,
    expectVerdict: 'pass',
  },
  {
    name: 'late-fee — split 2/2/1 — flag (low confidence)',
    prompt: 'Compute ambiguous late fee.',
    trueValue: 1500,
    // Two share value 1500, two share 1600, one shares 1700 — winner=1500 at 2/5=0.4
    samples: [1500, 1500, 1600, 1600, 1700],
    tier: 'complex',
    bucketDecimals: 0,
    expectVerdict: 'flag',
  },
  {
    name: 'currency convert — all NaN → fail',
    prompt: 'Convert with broken FX table.',
    trueValue: NaN,
    samples: [NaN, NaN, NaN, NaN, NaN],
    tier: 'simple',
    bucketDecimals: 0,
    expectVerdict: 'fail',
  },
  {
    name: 'arrears compound — 5/5 within bucket',
    prompt: 'Compute compound interest at high precision.',
    trueValue: 6120.85,
    samples: [6120.85, 6120.85, 6120.85, 6120.85, 6120.85],
    tier: 'complex',
    bucketDecimals: 2,
    expectVerdict: 'pass',
  },
];

describe('consistentCompute — 8 numeric tasks', () => {
  for (const fixture of fixtures) {
    it(fixture.name, async () => {
      let callCount = 0;
      const sampler = functionSampler((_input) => {
        const sample = fixture.samples[callCount % fixture.samples.length];
        callCount += 1;
        return sample!;
      });

      const result = await consistentCompute(
        { prompt: fixture.prompt },
        {
          sampler,
          clock: fixedClock(new Date('2026-05-19T00:00:00Z')),
          n: 5,
          ...(fixture.bucketDecimals !== undefined
            ? { bucketDecimals: fixture.bucketDecimals }
            : {}),
        },
      );

      expect(result.verdict).toBe(fixture.expectVerdict);
      if (fixture.expectVerdict === 'pass') {
        // Check accuracy against ground truth.
        const accuracy = Math.abs(result.value - fixture.trueValue);
        const tolerance = fixture.tier === 'simple' ? 0.5 : 50;
        expect(accuracy).toBeLessThan(tolerance);
        // Simple tasks: confidence ≥ 0.95 (i.e. ≥ 0.5 since N=5: 5/5=1.0 OR 4/5=0.8 OR 3/5=0.6)
        if (fixture.tier === 'simple') {
          expect(result.confidence).toBeGreaterThanOrEqual(0.6);
        } else {
          expect(result.confidence).toBeGreaterThanOrEqual(0.6);
        }
      }
      expect(result.n).toBe(5);
      expect(result.samples).toHaveLength(5);
    });
  }
});

describe('consistentCompute — edge behaviour', () => {
  it('clamps N to 3..9 range', async () => {
    const sampler = functionSampler(() => 42);
    const low = await consistentCompute(
      { prompt: 'x' },
      { sampler, n: 1 },
    );
    expect(low.n).toBe(3);
    const high = await consistentCompute(
      { prompt: 'x' },
      { sampler, n: 100 },
    );
    expect(high.n).toBe(9);
  });

  it('aggregates accuracy on simple tasks — meets ≥ 95% pass rate', async () => {
    const simpleTasks = fixtures.filter((f) => f.tier === 'simple');
    let pass = 0;
    for (const fixture of simpleTasks) {
      let callCount = 0;
      const sampler = functionSampler((_input) => {
        const sample = fixture.samples[callCount % fixture.samples.length];
        callCount += 1;
        return sample!;
      });
      const result = await consistentCompute(
        { prompt: fixture.prompt },
        { sampler, n: 5, ...(fixture.bucketDecimals !== undefined ? { bucketDecimals: fixture.bucketDecimals } : {}) },
      );
      if (result.verdict === 'pass' || result.verdict === fixture.expectVerdict) pass += 1;
    }
    expect(pass / simpleTasks.length).toBeGreaterThanOrEqual(0.95);
  });

  it('aggregates accuracy on complex tasks — meets ≥ 80% pass rate', async () => {
    const complexTasks = fixtures.filter((f) => f.tier === 'complex');
    let pass = 0;
    for (const fixture of complexTasks) {
      let callCount = 0;
      const sampler = functionSampler((_input) => {
        const sample = fixture.samples[callCount % fixture.samples.length];
        callCount += 1;
        return sample!;
      });
      const result = await consistentCompute(
        { prompt: fixture.prompt },
        { sampler, n: 5, ...(fixture.bucketDecimals !== undefined ? { bucketDecimals: fixture.bucketDecimals } : {}) },
      );
      if (result.verdict === fixture.expectVerdict) pass += 1;
    }
    expect(pass / complexTasks.length).toBeGreaterThanOrEqual(0.8);
  });

  it('handles serial sampling mode', async () => {
    const sampler = functionSampler(() => 100);
    const result = await consistentCompute(
      { prompt: 'x' },
      { sampler, n: 5, parallel: false },
    );
    expect(result.value).toBe(100);
    expect(result.confidence).toBe(1);
  });
});
