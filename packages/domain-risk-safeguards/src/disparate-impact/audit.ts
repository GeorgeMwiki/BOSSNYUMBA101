/**
 * Disparate-impact audit driver.
 *
 * For each (actionClass, proxy) cohort, the audit runs the three tests
 * (4/5ths + Chi-squared + Cohen's d) and emits a composite verdict.
 *
 * Triggering policy:
 *   - The audit runs quarterly (cron-driven; the cron is wired in by
 *     consumers via `runQuarterlyDiAudit`).
 *   - Tenant-owners receive a *monthly* DI summary (subset).
 *   - BOSSNYUMBA HQ admin receives the full quarterly report.
 *
 * Verdict composition:
 *   - All three tests pass            → `pass`
 *   - 4/5ths fails OR Chi rejects OR Cohen's d ≥ medium → `concern`
 *   - 4/5ths fails AND Chi rejects AND Cohen's d ≥ medium → `breach`
 *
 * Each verdict carries the citation chain so consumers can render
 * provenance to the owner / admin UI.
 */

import {
  computeChiSquared,
  computeCohensD,
  computeFourFifths,
} from './statistics.js';
import type {
  DecisionRecord,
  DecisionRecordPort,
  DisparateImpactVerdict,
  ProtectedClassProxy,
  ScreeningActionClass,
} from '../types.js';

const MITIGATION_CITATIONS: ReadonlyArray<string> = Object.freeze([
  'HUD AI Guidance, May 2024 — applicability of Fair Housing Act to AI tenant-screening',
  'EU AI Act (phased 2025-2026) — tenant screening = HIGH-RISK class',
  'SafeRent settlement playbook — disparate-impact testing is table stakes',
  'Uniform Guidelines on Employee Selection Procedures § 1607.4(D) — 4/5ths rule',
  'Tanzanian Protected Classes Act 2010 — domestic protected-class baseline',
]);

const ALL_PROXIES: ReadonlyArray<ProtectedClassProxy> = Object.freeze([
  'tz-protected-class-act-2010',
  'gender-from-name',
  'nationality-from-id',
  'age-bucket',
  'disability-flag',
  'single-parent-flag',
]);

const ALL_ACTION_CLASSES: ReadonlyArray<ScreeningActionClass> = Object.freeze([
  'tenant-screening-approve',
  'tenant-screening-deny',
  'lease-renewal',
  'lease-non-renewal',
  'rent-adjustment',
  'security-deposit-amount',
]);

/**
 * Audit a single (tenantId, actionClass, proxy) cohort. Pure — the
 * decision records are passed in by the caller.
 */
export function auditCohort(
  args: {
    readonly tenantId: string;
    readonly actionClass: ScreeningActionClass;
    readonly proxy: ProtectedClassProxy;
    readonly records: ReadonlyArray<DecisionRecord>;
  },
): DisparateImpactVerdict {
  const { tenantId, actionClass, proxy, records } = args;
  const cohortRecords = records.filter(
    (r) => r.actionClass === actionClass && r.proxy === proxy,
  );

  const fourFifths = computeFourFifths(cohortRecords, proxy, actionClass);
  const chiSquared = computeChiSquared(cohortRecords, proxy, actionClass);
  const cohensD = computeCohensD(cohortRecords, proxy, actionClass);

  const fourFifthsFails = !fourFifths.passes;
  const chiRejects = chiSquared.rejectsNull;
  const dIsMaterial = cohensD.magnitude === 'medium' || cohensD.magnitude === 'large';

  const failingTests = [fourFifthsFails, chiRejects, dIsMaterial].filter(Boolean).length;
  const verdict: DisparateImpactVerdict['verdict'] =
    failingTests === 0 ? 'pass' : failingTests >= 3 ? 'breach' : 'concern';

  return Object.freeze({
    tenantId,
    actionClass,
    proxy,
    fourFifths,
    chiSquared,
    cohensD,
    verdict,
    mitigationCitations: MITIGATION_CITATIONS,
  });
}

/**
 * Run the full quarterly DI audit for a single tenant. Yields one
 * verdict per (actionClass × proxy) cohort that has at least 1 record.
 */
export async function runQuarterlyDiAudit(
  args: {
    readonly tenantId: string;
    readonly since: string;
    readonly until: string;
    readonly decisionRecords: DecisionRecordPort;
  },
): Promise<ReadonlyArray<DisparateImpactVerdict>> {
  const { tenantId, since, until, decisionRecords } = args;
  const all = await decisionRecords.listSince({ tenantId, since, until });

  const verdicts: DisparateImpactVerdict[] = [];
  for (const actionClass of ALL_ACTION_CLASSES) {
    for (const proxy of ALL_PROXIES) {
      const cohortRecords = all.filter(
        (r) => r.actionClass === actionClass && r.proxy === proxy,
      );
      if (cohortRecords.length === 0) continue;
      verdicts.push(auditCohort({ tenantId, actionClass, proxy, records: cohortRecords }));
    }
  }
  return Object.freeze(verdicts);
}
