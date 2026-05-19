import { describe, expect, it } from 'vitest';
import {
  bandFromScore,
  computeCompositeRisk,
  createCustomerSuccessCompile,
} from '../verticals/bossnyumba-internal/customer-success-compile.js';
import type {
  ChurnSignal,
  CsTouchpoint,
  OwnerAccount,
} from '../verticals/bossnyumba-internal/entities.js';
import { makeCtx } from './_helpers.js';

const nowMs = 1_700_000_000_000;
const tenDaysAgo = nowMs - 10 * 86_400_000;
const oneDayAgo = nowMs - 86_400_000;

function owner(id: string, arr: number, extra: Partial<OwnerAccount> = {}): OwnerAccount {
  return {
    id,
    tenantId: 'tenant-1',
    displayName: `Owner ${id}`,
    seatCount: 4,
    arrUsdMinor: arr,
    tenureMonths: 18,
    lastActiveAtMs: nowMs,
    ...extra,
  };
}

function signal(
  ownerId: string,
  kind: ChurnSignal['kind'],
  severity = 1,
  atMs = oneDayAgo,
): ChurnSignal {
  return {
    id: `sig-${ownerId}-${kind}-${Math.random()}`,
    ownerAccountId: ownerId,
    kind,
    observedAtMs: atMs,
    severityScore: severity,
    notes: '',
  };
}

function touch(ownerId: string, atMs = oneDayAgo): CsTouchpoint {
  return {
    id: `tp-${ownerId}-${atMs}`,
    ownerAccountId: ownerId,
    channel: 'email',
    atMs,
    summary: '',
    outcome: 'pending',
  };
}

describe('computeCompositeRisk', () => {
  it('returns 0 for no signals', () => {
    const r = computeCompositeRisk([]);
    expect(r.score).toBe(0);
    expect(r.topKind).toBe('none');
  });

  it('weights usage-drop highest among kinds', () => {
    const r = computeCompositeRisk([signal('o1', 'usage-drop')]);
    expect(r.topKind).toBe('usage-drop');
    expect(r.score).toBeCloseTo(0.4, 2);
  });

  it('clamps to 1.0', () => {
    const r = computeCompositeRisk([
      signal('o1', 'usage-drop'),
      signal('o1', 'payment-failure'),
      signal('o1', 'support-spike'),
      signal('o1', 'csat-drop'),
      signal('o1', 'competitor-mention'),
      signal('o1', 'feature-request-stalled'),
    ]);
    expect(r.score).toBeLessThanOrEqual(1);
  });
});

describe('bandFromScore', () => {
  it('green below 0.45', () => {
    expect(bandFromScore(0.2)).toBe('green');
  });
  it('amber [0.45, 0.75)', () => {
    expect(bandFromScore(0.5)).toBe('amber');
  });
  it('red >= 0.75', () => {
    expect(bandFromScore(0.8)).toBe('red');
  });
});

describe('createCustomerSuccessCompile', () => {
  it('produces a CS brief with red and amber buckets', async () => {
    const sub = createCustomerSuccessCompile({ nowMs });
    const { ctx } = makeCtx({ nowMs });
    const inputs = [
      {
        owner: owner('red-big', 50_000_00),
        windowSignals: [
          signal('red-big', 'usage-drop'),
          signal('red-big', 'payment-failure'),
          signal('red-big', 'support-spike'),
        ],
        windowTouchpoints: [touch('red-big', tenDaysAgo)],
        riskAtWindowStart: 0.8,
      },
      {
        owner: owner('amber-mid', 12_000_00),
        windowSignals: [signal('amber-mid', 'csat-drop'), signal('amber-mid', 'usage-drop')],
        windowTouchpoints: [touch('amber-mid')],
        riskAtWindowStart: 0.4,
      },
      {
        owner: owner('green', 5_000_00),
        windowSignals: [],
        windowTouchpoints: [touch('green')],
        riskAtWindowStart: 0,
      },
    ];
    const r = await sub.compile.run({
      inputs,
      window: { startMs: nowMs - 7 * 86_400_000, endMs: nowMs },
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.redOwners.length).toBe(1);
    expect(r.output.redOwners[0]!.ownerAccountId).toBe('red-big');
    expect(r.output.amberOwners.length).toBeGreaterThanOrEqual(1);
    expect(r.output.totalArrAtRiskUsdMinor).toBe(50_000_00);
    expect(r.output.recommendedActions.some((a) => a.includes('RED owners'))).toBe(true);
  });

  it('surfaces recent wins when risk dropped > 0.2', async () => {
    const sub = createCustomerSuccessCompile({ nowMs });
    const { ctx } = makeCtx({ nowMs });
    const r = await sub.compile.run({
      inputs: [
        {
          owner: owner('saved', 8_000_00),
          windowSignals: [], // current risk = 0
          windowTouchpoints: [touch('saved')],
          riskAtWindowStart: 0.85, // was red entering window
        },
      ],
      window: { startMs: nowMs - 7 * 86_400_000, endMs: nowMs },
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.recentWins.length).toBe(1);
    expect(r.output.recommendedActions.some((a) => a.includes('wins'))).toBe(true);
  });

  it('detects cohort anomalies above lift threshold', async () => {
    const sub = createCustomerSuccessCompile({
      nowMs,
      baselineCohortRiskRate: 0.1,
      cohortLiftThreshold: 2,
    });
    const { ctx } = makeCtx({ nowMs });
    // 5 owners in same cohort, 4 at risk → rate 0.8, baseline 0.1, lift 8x
    const inputs = Array.from({ length: 5 }).map((_, i) => ({
      owner: owner(`o${i}`, 5_000_00, { tenureMonths: 6, seatCount: 5 }),
      windowSignals:
        i < 4
          ? [signal(`o${i}`, 'usage-drop'), signal(`o${i}`, 'csat-drop')]
          : [],
      windowTouchpoints: [touch(`o${i}`)],
      riskAtWindowStart: 0.3,
    }));
    const r = await sub.compile.run({
      inputs,
      window: { startMs: nowMs - 7 * 86_400_000, endMs: nowMs },
      inputTenantId: 'tenant-1',
      ctx,
    });
    expect(r.output.cohortAnomalies.length).toBeGreaterThan(0);
    expect(r.output.anomalies[0]!.severity).toBe('critical');
  });
});
