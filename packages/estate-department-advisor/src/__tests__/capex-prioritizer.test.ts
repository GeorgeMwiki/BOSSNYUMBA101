import { describe, it, expect } from 'vitest';
import {
  prioritizeCapex,
  __test__,
} from '../portfolio/capex-prioritizer.js';
import type { CapexLine } from '../portfolio/capex-prioritizer.js';
import { TENANT_ID } from './fixtures.js';

const lines: ReadonlyArray<CapexLine> = [
  { id: 'reg-1', propertyId: 'p1', description: 'Fire-alarm code upgrade', urgency: 'regulatory', estimatedCostUsd: 50_000, expectedIrr: 0, strategicFit: 0.6 },
  { id: 'life-1', propertyId: 'p2', description: 'Stairwell rail replacement', urgency: 'life-safety', estimatedCostUsd: 30_000, expectedIrr: 0, strategicFit: 0.5 },
  { id: 'rev-1', propertyId: 'p3', description: 'Unit-mix repositioning', urgency: 'revenue-critical', estimatedCostUsd: 200_000, expectedIrr: 0.18, strategicFit: 0.8 },
  { id: 'eff-1', propertyId: 'p4', description: 'LED retrofit', urgency: 'efficiency', estimatedCostUsd: 80_000, expectedIrr: 0.22, strategicFit: 0.5 },
  { id: 'aes-1', propertyId: 'p5', description: 'Lobby refresh', urgency: 'aesthetic', estimatedCostUsd: 120_000, expectedIrr: 0.06, strategicFit: 0.3 },
];

describe('capex-prioritizer', () => {
  it('funds regulatory + life-safety regardless of budget', () => {
    const result = prioritizeCapex({ tenantId: TENANT_ID, lines, budgetUsd: 10_000 });
    const fundedIds = result.funded.map((f) => f.id);
    expect(fundedIds).toContain('reg-1');
    expect(fundedIds).toContain('life-1');
  });

  it('ranks composite descending', () => {
    const result = prioritizeCapex({ tenantId: TENANT_ID, lines, budgetUsd: 1_000_000 });
    for (let i = 1; i < result.ranked.length; i += 1) {
      expect(result.ranked[i]?.composite ?? 0).toBeLessThanOrEqual((result.ranked[i - 1]?.composite ?? 0) + 1e-9);
    }
  });

  it('defers items when budget exhausted', () => {
    const result = prioritizeCapex({ tenantId: TENANT_ID, lines, budgetUsd: 100_000 });
    expect(result.deferred.length).toBeGreaterThan(0);
  });

  it('emits recommendations with ownerRole', () => {
    const result = prioritizeCapex({ tenantId: TENANT_ID, lines, budgetUsd: 1_000_000 });
    expect(result.recommendations.every((r) => r.ownerRole !== undefined)).toBe(true);
  });

  it('URGENCY_SCORE descends from regulatory to aesthetic', () => {
    expect(__test__.URGENCY_SCORE.regulatory).toBeGreaterThan(__test__.URGENCY_SCORE['life-safety']);
    expect(__test__.URGENCY_SCORE['life-safety']).toBeGreaterThan(__test__.URGENCY_SCORE['revenue-critical']);
    expect(__test__.URGENCY_SCORE['revenue-critical']).toBeGreaterThan(__test__.URGENCY_SCORE.efficiency);
    expect(__test__.URGENCY_SCORE.efficiency).toBeGreaterThan(__test__.URGENCY_SCORE.aesthetic);
  });

  it('zero-line input returns empty ranked', () => {
    const result = prioritizeCapex({ tenantId: TENANT_ID, lines: [], budgetUsd: 100_000 });
    expect(result.ranked).toEqual([]);
    expect(result.funded).toEqual([]);
    expect(result.deferred).toEqual([]);
  });

  it('normalize handles zero max', () => {
    expect(__test__.normalize(1, 0)).toBe(0);
  });

  it('ownerForUrgency surfaces director-ops for regulatory', () => {
    expect(__test__.ownerForUrgency('regulatory')).toBe('director-ops');
    expect(__test__.ownerForUrgency('life-safety')).toBe('director-ops');
  });
});
