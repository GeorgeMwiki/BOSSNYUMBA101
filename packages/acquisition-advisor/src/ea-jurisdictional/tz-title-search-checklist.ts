/**
 * Tanzania title-search checklist — per Land Act 1999 §22,
 * Village Land Act 1999, Ministry of Lands (MLHHSD) practice.
 */

import type { TZTitleSearchInputs, TZTitleSearchResult } from '../types.js';

type ChecklistItem = TZTitleSearchResult['checklist'][number];

export function checkTZTitleSearch(
  inputs: TZTitleSearchInputs,
): TZTitleSearchResult {
  const checklist: ChecklistItem[] = [];

  // Verify cert type matches land class
  const ctMatch =
    (inputs.titleClass === 'general' && inputs.certificateType === 'CT') ||
    (inputs.titleClass === 'village' && inputs.certificateType === 'CCRO');
  checklist.push({
    key: 'certificateTypeMatchesClass',
    passed: ctMatch,
    severity: 'critical',
  });

  // Right of occupancy term: warn if expiry within 10 years
  const yearsRemaining = inputs.issueYear + inputs.termYears - new Date().getFullYear();
  checklist.push({
    key: 'occupancyTermNotExpiring',
    passed: yearsRemaining >= 10,
    severity: yearsRemaining >= 10 ? 'info' : 'warn',
  });

  checklist.push({
    key: 'noEncumbrances',
    passed: !inputs.encumbrancesRegistered,
    severity: inputs.encumbrancesRegistered ? 'warn' : 'info',
  });
  checklist.push({
    key: 'noCaveats',
    passed: inputs.caveats.length === 0,
    severity: inputs.caveats.length === 0 ? 'info' : 'critical',
  });
  checklist.push({
    key: 'traTaxClearance',
    passed: inputs.traTaxClearance,
    severity: 'warn',
  });
  checklist.push({
    key: 'surveyDiagramOnFile',
    passed: inputs.surveyDiagramOnFile,
    severity: 'critical',
  });
  checklist.push({
    key: 'plotRentClearance',
    passed: inputs.plotRentClearance,
    severity: 'warn',
  });
  if (inputs.titleClass === 'village') {
    checklist.push({
      key: 'villageCouncilAttestation',
      passed: inputs.villageCouncilAttestation,
      severity: 'critical',
    });
  }
  checklist.push({
    key: 'nemcStatusClean',
    passed: inputs.nemcStatusClean,
    severity: 'warn',
  });
  checklist.push({
    key: 'noCustomaryOverlap',
    passed: !inputs.customaryOverlapRisk,
    severity: inputs.customaryOverlapRisk ? 'critical' : 'info',
  });

  const criticalGaps = checklist
    .filter((c) => !c.passed && c.severity === 'critical')
    .map((c) => c.key);

  const verdict: TZTitleSearchResult['verdict'] =
    criticalGaps.length >= 2
      ? 'unworkable'
      : criticalGaps.length === 1
        ? 'requires-cure'
        : checklist.some((c) => !c.passed && c.severity === 'warn')
          ? 'workable'
          : 'clean';

  return { checklist, criticalGaps, verdict };
}
