/**
 * Kenya title-search checklist — per Land Act 2012 §38, Land
 * Registration Act 2012, Matrimonial Property Act 2013 §12,
 * Limitation of Actions Act §7.
 */

import type { KETitleSearchInputs, KETitleSearchResult } from '../types.js';

type ChecklistItem = KETitleSearchResult['checklist'][number];

export function checkKETitleSearch(
  inputs: KETitleSearchInputs,
): KETitleSearchResult {
  const checklist: ChecklistItem[] = [];

  checklist.push({
    key: 'lrNumberLookup',
    passed: inputs.lrNumber.length > 0,
    severity: 'critical',
  });
  checklist.push({
    key: 'nlimsRegistration',
    passed: inputs.nlimsRegistered,
    severity: inputs.nlimsRegistered ? 'info' : 'warn',
  });
  checklist.push({
    key: 'noMortgageOrPayoffPlan',
    passed: !inputs.mortgageRegistered,
    severity: inputs.mortgageRegistered ? 'warn' : 'info',
  });
  checklist.push({
    key: 'noCaveats',
    passed: inputs.caveats.length === 0,
    severity: inputs.caveats.length === 0 ? 'info' : 'critical',
  });
  checklist.push({
    key: 'noRestrictions',
    passed: !inputs.restrictionsRegistered,
    severity: inputs.restrictionsRegistered ? 'critical' : 'info',
  });
  checklist.push({
    key: 'spousalConsent',
    passed: inputs.spousalConsentObtained,
    severity: 'critical',
  });
  checklist.push({
    key: 'ratesClearance',
    passed: inputs.ratesClearance,
    severity: 'warn',
  });
  if (inputs.tenureType === 'leasehold') {
    checklist.push({
      key: 'landRentClearance',
      passed: inputs.landRentClearance,
      severity: 'warn',
    });
  }
  checklist.push({
    key: 'surveyPlanReconciled',
    passed: inputs.surveyPlanReconciled,
    severity: 'critical',
  });
  if (inputs.lcbConsentRequired) {
    checklist.push({
      key: 'lcbConsent',
      passed: inputs.lcbConsentObtained,
      severity: 'critical',
    });
  }
  checklist.push({
    key: 'noDoubleAllotmentRisk',
    passed: !inputs.knownDoubleAllotmentRisk,
    severity: inputs.knownDoubleAllotmentRisk ? 'critical' : 'info',
  });
  checklist.push({
    key: 'notInPublicLandWatchlist',
    passed: !inputs.inPublicLandWatchlist,
    severity: inputs.inPublicLandWatchlist ? 'critical' : 'info',
  });

  const criticalGaps = checklist
    .filter((c) => !c.passed && c.severity === 'critical')
    .map((c) => c.key);

  const verdict: KETitleSearchResult['verdict'] =
    criticalGaps.length >= 2
      ? 'unworkable'
      : criticalGaps.length === 1
        ? 'requires-cure'
        : checklist.some((c) => !c.passed && c.severity === 'warn')
          ? 'workable'
          : 'clean';

  return { checklist, criticalGaps, verdict };
}
