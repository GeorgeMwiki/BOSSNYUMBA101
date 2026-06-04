/**
 * Correlation-detector tests. Verifies the pure Pearson + p-value math and the
 * nightly pass gating (|r|>0.4, p<0.05, n>=30) over the co-observed belief
 * series that each outcome row carries.
 */

import { describe, it, expect } from 'vitest';

import {
  pearson,
  findCorrelations,
  DEFAULT_MIN_SAMPLE,
} from './correlation-detector';
import { createInMemoryBeliefStore } from './in-memory-store';
import type { OutcomeRow } from './ports';
import type { Belief } from './types';

describe('pearson', () => {
  it('returns r=1 for a perfectly correlated series', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8];
    const ys = [2, 4, 6, 8, 10, 12, 14, 16];
    const { r, p } = pearson(xs, ys);
    expect(r).toBeCloseTo(1, 5);
    expect(p).toBeLessThan(0.05);
  });

  it('returns r≈0 for an uncorrelated series', () => {
    const xs = [1, 2, 3, 4, 5, 6];
    const ys = [5, 1, 6, 2, 4, 3];
    const { r } = pearson(xs, ys);
    expect(Math.abs(r)).toBeLessThan(0.6);
  });

  it('returns p=1 for n < 3', () => {
    expect(pearson([1, 2], [1, 2]).p).toBe(1);
  });

  it('returns r=0,p=1 for a constant series (zero variance)', () => {
    const { r, p } = pearson([1, 1, 1, 1], [1, 2, 3, 4]);
    expect(r).toBe(0);
    expect(p).toBe(1);
  });
});

describe('findCorrelations', () => {
  const numericBelief: Belief = {
    id: 'b-1',
    domain: 'market-economics',
    subject: 'kinondoni-2br-rent-comparable',
    description: 'Believed market rent for a Kinondoni 2BR',
    value: { kind: 'scalar', scalar: 0.9 },
    confidence: 0.7,
    sources: [],
    revisedAt: '2026-05-30T00:00:00.000Z',
    revisionCount: 1,
    tags: [],
    subjectUserId: null,
    subjectOrgId: null,
  };

  it('returns [] when there are no numeric beliefs', async () => {
    const store = createInMemoryBeliefStore([
      { ...numericBelief, value: { kind: 'text', text: 'qualitative' } },
    ]);
    const out = await findCorrelations(
      {},
      { store, outcomeFetcher: async () => correlatedOutcomes(40) },
    );
    expect(out).toEqual([]);
  });

  it('returns [] when there are no outcomes', async () => {
    const store = createInMemoryBeliefStore([numericBelief]);
    const out = await findCorrelations(
      {},
      { store, outcomeFetcher: async () => [] },
    );
    expect(out).toEqual([]);
  });

  it('skips cells below the minimum sample size', async () => {
    const store = createInMemoryBeliefStore([numericBelief]);
    const out = await findCorrelations(
      {},
      {
        store,
        outcomeFetcher: async () =>
          correlatedOutcomes(DEFAULT_MIN_SAMPLE - 1),
      },
    );
    expect(out).toEqual([]);
  });

  it('drops rows that carry no co-observed belief value (no constant broadcast)', async () => {
    const store = createInMemoryBeliefStore([numericBelief]);
    // Outcomes vary but never carry a beliefValue → no aligned pairs → no
    // finding (regression guard: an unattributed-without-beliefValue row
    // contributes nothing rather than broadcasting a constant).
    const out = await findCorrelations(
      {},
      {
        store,
        outcomeFetcher: async () =>
          Array.from({ length: 40 }, (_, i) => ({
            segment: 'residential',
            region: 'kinondoni',
            metric: 'occupancy-pct',
            value: i % 7,
          })),
      },
    );
    expect(out).toEqual([]);
  });

  it('DETECTS a real belief×outcome correlation (|r|>0.4, p<0.05)', async () => {
    const store = createInMemoryBeliefStore([numericBelief]);
    const out = await findCorrelations(
      {},
      { store, outcomeFetcher: async () => correlatedOutcomes(40) },
    );
    expect(out.length).toBe(1);
    const finding = out[0];
    expect(finding?.beliefSubject).toBe('kinondoni-2br-rent-comparable');
    expect(finding?.outcomeMetric).toBe('occupancy-pct');
    expect(Math.abs(finding?.r ?? 0)).toBeGreaterThan(0.4);
    expect(finding?.p ?? 1).toBeLessThan(0.05);
    expect(finding?.n).toBe(40);
  });

  it('attributes a row only to its named belief subject', async () => {
    const other: Belief = {
      ...numericBelief,
      id: 'b-2',
      subject: 'mwanza-2br-rent-comparable',
    };
    const store = createInMemoryBeliefStore([numericBelief, other]);
    // All rows are attributed to kinondoni-2br-rent-comparable, so only that
    // belief should yield a finding; the other gets zero aligned pairs.
    const out = await findCorrelations(
      {},
      {
        store,
        outcomeFetcher: async () =>
          correlatedOutcomes(40, 'kinondoni-2br-rent-comparable'),
      },
    );
    expect(out.length).toBe(1);
    expect(out[0]?.beliefSubject).toBe('kinondoni-2br-rent-comparable');
  });
});

/**
 * Build outcomes whose co-observed belief value rises with the outcome value
 * (a genuine positive correlation), plus a little deterministic wobble so the
 * series is not a degenerate straight line.
 */
function correlatedOutcomes(n: number, beliefSubject?: string): OutcomeRow[] {
  return Array.from({ length: n }, (_, i) => {
    const beliefValue = 0.5 + i * 0.01;
    const wobble = i % 3 === 0 ? 0.4 : 0; // breaks perfect collinearity
    return {
      segment: 'residential',
      region: 'kinondoni',
      metric: 'occupancy-pct',
      value: beliefValue * 10 + wobble,
      beliefValue,
      ...(beliefSubject ? { beliefSubject } : {}),
    };
  });
}
