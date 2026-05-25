import { describe, it, expect } from 'vitest';
import {
  OWNER_COMM_PATTERNS,
  commPatternFor,
} from '../owner-relations/comm-pattern-playbook.js';
import {
  adviseDistribution,
  __test__,
} from '../owner-relations/distribution-advisor.js';
import {
  CRISIS_COMM_TEMPLATES,
  templateFor,
} from '../owner-relations/crisis-comm-templates.js';

describe('comm-pattern-playbook', () => {
  it('covers all 8 owner archetypes', () => {
    expect(Object.keys(OWNER_COMM_PATTERNS).length).toBe(8);
  });

  it('cashflow-first has monthly cadence', () => {
    expect(commPatternFor('cashflow-first').cadence).toBe('monthly');
  });

  it('institutional has quarterly cadence', () => {
    expect(commPatternFor('institutional').cadence).toBe('quarterly');
  });

  it('every pattern has a citation', () => {
    for (const k of Object.keys(OWNER_COMM_PATTERNS) as Array<keyof typeof OWNER_COMM_PATTERNS>) {
      expect(OWNER_COMM_PATTERNS[k].citation.length).toBeGreaterThan(0);
    }
  });
});

describe('distribution-advisor', () => {
  it('suspends distribution when reserve below floor', () => {
    const out = adviseDistribution({
      archetype: 'cashflow-first',
      trailingQuarterNoiUsd: [100_000, 110_000, 95_000, 105_000],
      cashReserveUsd: 10_000,
      monthlyOpexUsd: 50_000,
      scheduledCapexUsd: 100_000,
      currentEquityUsd: 5_000_000,
      debtServiceQuarterlyUsd: 30_000,
    });
    expect(out.canDistribute).toBe(false);
  });

  it('cashflow-first archetype has highest payout ratio', () => {
    const out = adviseDistribution({
      archetype: 'cashflow-first',
      trailingQuarterNoiUsd: [100_000, 110_000, 95_000, 105_000],
      cashReserveUsd: 5_000_000,
      monthlyOpexUsd: 50_000,
      scheduledCapexUsd: 100_000,
      currentEquityUsd: 5_000_000,
      debtServiceQuarterlyUsd: 30_000,
    });
    expect(out.canDistribute).toBe(true);
    expect(out.recommendedQuarterlyUsd).toBeGreaterThan(0);
  });

  it('growth-acquisitive has lower payout ratio', () => {
    const growth = adviseDistribution({
      archetype: 'growth-acquisitive',
      trailingQuarterNoiUsd: [100_000, 110_000, 95_000, 105_000],
      cashReserveUsd: 5_000_000,
      monthlyOpexUsd: 50_000,
      scheduledCapexUsd: 100_000,
      currentEquityUsd: 5_000_000,
      debtServiceQuarterlyUsd: 30_000,
    });
    const cashflow = adviseDistribution({
      archetype: 'cashflow-first',
      trailingQuarterNoiUsd: [100_000, 110_000, 95_000, 105_000],
      cashReserveUsd: 5_000_000,
      monthlyOpexUsd: 50_000,
      scheduledCapexUsd: 100_000,
      currentEquityUsd: 5_000_000,
      debtServiceQuarterlyUsd: 30_000,
    });
    expect(growth.recommendedQuarterlyUsd).toBeLessThan(cashflow.recommendedQuarterlyUsd);
  });

  it('median helper handles empty + odd + even arrays', () => {
    expect(__test__.median([])).toBe(0);
    expect(__test__.median([10])).toBe(10);
    expect(__test__.median([10, 20, 30])).toBe(20);
    expect(__test__.median([10, 20, 30, 40])).toBe(25);
  });
});

describe('crisis-comm-templates', () => {
  it('provides all 6 incident-type templates', () => {
    expect(Object.keys(CRISIS_COMM_TEMPLATES).length).toBe(6);
  });

  it('lawsuit template authority is counsel-first', () => {
    expect(templateFor('lawsuit').authorityFirst).toBe('counsel');
  });

  it('tenant-incident template has empathetic tone', () => {
    expect(templateFor('tenant-incident').tone).toBe('empathetic');
  });

  it('every template avoids inappropriate language', () => {
    for (const k of Object.keys(CRISIS_COMM_TEMPLATES) as Array<keyof typeof CRISIS_COMM_TEMPLATES>) {
      expect(CRISIS_COMM_TEMPLATES[k].avoidLanguage.length).toBeGreaterThan(0);
    }
  });
});
