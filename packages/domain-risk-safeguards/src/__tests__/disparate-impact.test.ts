/**
 * Disparate-impact audit tests.
 *
 * 12 fixtures:
 *   - 8 balanced cohorts (all three tests pass — verdict 'pass')
 *   - 4 disparate-impact-positive cohorts (at least one test fails)
 *
 * Plus integration: full `runQuarterlyDiAudit` against a stub port.
 */

import { describe, it, expect } from 'vitest';
import {
  auditCohort,
  computeChiSquared,
  computeCohensD,
  computeFourFifths,
  runQuarterlyDiAudit,
} from '../disparate-impact/index.js';
import type {
  DecisionRecord,
  DecisionRecordPort,
  ProtectedClassProxy,
  ScreeningActionClass,
} from '../types.js';

const TENANT = '11111111-1111-1111-1111-111111111111';

function rec(
  bucket: string,
  outcome: 'approve' | 'deny',
  proxy: ProtectedClassProxy = 'age-bucket',
  actionClass: ScreeningActionClass = 'tenant-screening-approve',
  idx = 0,
): DecisionRecord {
  return Object.freeze({
    decisionId: `dec-${bucket}-${outcome}-${idx}`,
    tenantId: TENANT,
    actionClass,
    proxy,
    bucket,
    outcome,
    decidedAt: '2026-02-01T00:00:00.000Z',
  });
}

/**
 * Builds a balanced cohort: each bucket has the same approve rate.
 * 50 records per bucket × 2 buckets.
 */
function balancedCohort(
  proxy: ProtectedClassProxy,
  actionClass: ScreeningActionClass,
): DecisionRecord[] {
  const out: DecisionRecord[] = [];
  for (let i = 0; i < 25; i++) out.push(rec('A', 'approve', proxy, actionClass, i));
  for (let i = 0; i < 25; i++) out.push(rec('A', 'deny', proxy, actionClass, i + 100));
  for (let i = 0; i < 25; i++) out.push(rec('B', 'approve', proxy, actionClass, i + 200));
  for (let i = 0; i < 25; i++) out.push(rec('B', 'deny', proxy, actionClass, i + 300));
  return out;
}

/**
 * Builds a disparate-impact-positive cohort: bucket A has 90%
 * approve, bucket B has 30% approve → 4/5ths fails (0.33).
 */
function diPositiveCohort(
  proxy: ProtectedClassProxy,
  actionClass: ScreeningActionClass,
): DecisionRecord[] {
  const out: DecisionRecord[] = [];
  for (let i = 0; i < 90; i++) out.push(rec('A', 'approve', proxy, actionClass, i));
  for (let i = 0; i < 10; i++) out.push(rec('A', 'deny', proxy, actionClass, i + 100));
  for (let i = 0; i < 30; i++) out.push(rec('B', 'approve', proxy, actionClass, i + 200));
  for (let i = 0; i < 70; i++) out.push(rec('B', 'deny', proxy, actionClass, i + 300));
  return out;
}

describe('disparate-impact — 8 balanced cohorts pass', () => {
  const balanced: Array<{ proxy: ProtectedClassProxy; ac: ScreeningActionClass }> = [
    { proxy: 'age-bucket', ac: 'tenant-screening-approve' },
    { proxy: 'gender-from-name', ac: 'tenant-screening-deny' },
    { proxy: 'nationality-from-id', ac: 'lease-renewal' },
    { proxy: 'disability-flag', ac: 'lease-non-renewal' },
    { proxy: 'single-parent-flag', ac: 'rent-adjustment' },
    { proxy: 'tz-protected-class-act-2010', ac: 'security-deposit-amount' },
    { proxy: 'age-bucket', ac: 'lease-renewal' },
    { proxy: 'gender-from-name', ac: 'rent-adjustment' },
  ];

  for (const { proxy, ac } of balanced) {
    it(`balanced — proxy=${proxy}, action=${ac}, verdict=pass`, () => {
      const records = balancedCohort(proxy, ac);
      const verdict = auditCohort({
        tenantId: TENANT,
        actionClass: ac,
        proxy,
        records,
      });
      expect(verdict.verdict).toBe('pass');
      expect(verdict.fourFifths.passes).toBe(true);
      expect(verdict.chiSquared.rejectsNull).toBe(false);
      expect(verdict.cohensD.magnitude).toBe('negligible');
      expect(verdict.fourFifths.impactRatio).toBeCloseTo(1, 5);
      expect(verdict.mitigationCitations.length).toBeGreaterThan(0);
    });
  }
});

describe('disparate-impact — 4 disparate-impact-positive cohorts surface', () => {
  const diPositive: Array<{ proxy: ProtectedClassProxy; ac: ScreeningActionClass }> = [
    { proxy: 'gender-from-name', ac: 'tenant-screening-deny' },
    { proxy: 'nationality-from-id', ac: 'tenant-screening-approve' },
    { proxy: 'disability-flag', ac: 'lease-non-renewal' },
    { proxy: 'single-parent-flag', ac: 'security-deposit-amount' },
  ];

  for (const { proxy, ac } of diPositive) {
    it(`DI-positive — proxy=${proxy}, action=${ac}, verdict in {concern,breach}`, () => {
      const records = diPositiveCohort(proxy, ac);
      const verdict = auditCohort({
        tenantId: TENANT,
        actionClass: ac,
        proxy,
        records,
      });
      // 4/5ths must fail (0.33 < 0.8)
      expect(verdict.fourFifths.passes).toBe(false);
      expect(verdict.fourFifths.impactRatio).toBeLessThan(0.8);
      // Chi-squared must reject null (large effect, large sample)
      expect(verdict.chiSquared.rejectsNull).toBe(true);
      // Cohen's d must be material (medium or large)
      expect(['medium', 'large']).toContain(verdict.cohensD.magnitude);
      // Composite: 3 tests fail → 'breach'
      expect(verdict.verdict).toBe('breach');
    });
  }
});

describe('disparate-impact — statistical primitive sanity', () => {
  it('4/5ths rule degenerate with empty records', () => {
    const r = computeFourFifths([], 'age-bucket', 'tenant-screening-approve');
    expect(r.passes).toBe(true); // vacuous
  });

  it('chi-squared degenerate with single bucket', () => {
    const r = computeChiSquared(
      [rec('A', 'approve')],
      'age-bucket',
      'tenant-screening-approve',
    );
    expect(r.rejectsNull).toBe(false);
  });

  it('cohen-d returns negligible on balanced data', () => {
    const r = computeCohensD(
      balancedCohort('age-bucket', 'tenant-screening-approve'),
      'age-bucket',
      'tenant-screening-approve',
    );
    expect(r.magnitude).toBe('negligible');
  });

  it('cohen-d returns large on extreme imbalance', () => {
    const r = computeCohensD(
      diPositiveCohort('age-bucket', 'tenant-screening-approve'),
      'age-bucket',
      'tenant-screening-approve',
    );
    expect(['medium', 'large']).toContain(r.magnitude);
  });
});

describe('disparate-impact — runQuarterlyDiAudit integration', () => {
  it('returns one verdict per non-empty (action × proxy) cohort', async () => {
    const records: DecisionRecord[] = [
      ...balancedCohort('age-bucket', 'tenant-screening-approve'),
      ...diPositiveCohort('gender-from-name', 'tenant-screening-deny'),
    ];
    const port: DecisionRecordPort = {
      listSince: async () => records,
    };
    const verdicts = await runQuarterlyDiAudit({
      tenantId: TENANT,
      since: '2026-01-01T00:00:00Z',
      until: '2026-04-01T00:00:00Z',
      decisionRecords: port,
    });
    expect(verdicts.length).toBe(2);
    const passVerdict = verdicts.find((v) => v.proxy === 'age-bucket');
    const breachVerdict = verdicts.find((v) => v.proxy === 'gender-from-name');
    expect(passVerdict?.verdict).toBe('pass');
    expect(breachVerdict?.verdict).toBe('breach');
  });
});
