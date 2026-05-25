import { describe, expect, it } from 'vitest';
import { adviseExitTiming } from '../disposition/exit-timing-advisor.js';
import type { ExitTimingInputs } from '../types.js';

const allTriggered: ExitTimingInputs = {
  assetId: 'EX-1',
  forwardIRR24mo: 0.06,
  holdingHurdle: 0.10, // spread 400 bps > 200 bps
  marketCapRate: 0.060,
  entryCapRate: 0.075, // 150 bps compression
  taxBasis: 50_000_000,
  depreciationRecapture: 0.20, // net basis 40M
  debtPaydown: 20_000_000, // 40 > 20 → no trap
  rcaVelocityZ: 0.8,
  cmbsIssuanceZ: 0.2,
};

describe('exit-timing-advisor', () => {
  it('returns sell-now when all 5 triggers met', () => {
    const r = adviseExitTiming(allTriggered);
    expect(r.verdict).toBe('sell-now');
    expect(r.score).toBe(5);
  });

  it('returns soft-test when exactly 3 triggers met', () => {
    const r = adviseExitTiming({
      ...allTriggered,
      rcaVelocityZ: 0,
      cmbsIssuanceZ: -1,
    });
    expect(r.verdict).toBe('soft-test');
    expect(r.score).toBe(3);
  });

  it('returns continue-hold when ≤ 2 triggers met', () => {
    const r = adviseExitTiming({
      ...allTriggered,
      forwardIRR24mo: 0.11,
      marketCapRate: 0.08,
      depreciationRecapture: 0.80,
      rcaVelocityZ: -1,
      cmbsIssuanceZ: -1,
    });
    expect(r.verdict).toBe('continue-hold');
    expect(r.score).toBeLessThanOrEqual(2);
  });

  it('reports correct triggers list', () => {
    const r = adviseExitTiming(allTriggered);
    expect(r.triggers).toHaveLength(5);
    expect(r.triggers.every((t) => t.met)).toBe(true);
  });
});
