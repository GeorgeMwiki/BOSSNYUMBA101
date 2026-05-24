/**
 * Uganda title-search checklist — per Land Registration Act 1922
 * (as amended), Land Act 1998 Cap 227, Land Amendment Act 2004.
 */

import type { UGTitleSearchInputs, UGTitleSearchResult } from '../types.js';

type ChecklistItem = UGTitleSearchResult['checklist'][number];

export function checkUGTitleSearch(
  inputs: UGTitleSearchInputs,
): UGTitleSearchResult {
  const checklist: ChecklistItem[] = [];

  checklist.push({
    key: 'whitePageSearchClean',
    passed: inputs.whitePageSearchClean,
    severity: 'critical',
  });
  checklist.push({
    key: 'encroachmentSearchClean',
    passed: inputs.encroachmentSearchClean,
    severity: 'critical',
  });
  if (inputs.tenureSystem === 'mailo') {
    checklist.push({
      key: 'noBibanjaHolders',
      passed: !inputs.bibanjaHoldersPresent,
      severity: inputs.bibanjaHoldersPresent ? 'critical' : 'info',
    });
  }
  checklist.push({
    key: 'spousalConsent',
    passed: inputs.spousalConsentObtained,
    severity: 'critical',
  });
  checklist.push({
    key: 'kccaRatesClearance',
    passed: inputs.kccaRatesClearance,
    severity: 'warn',
  });
  checklist.push({
    key: 'nemaStatusClean',
    passed: inputs.nemaStatusClean,
    severity: 'warn',
  });
  if (inputs.tenureSystem === 'mailo' || inputs.tenureSystem === 'freehold') {
    checklist.push({
      key: 'demdAuthenticated',
      passed: inputs.demdAuthenticated,
      severity: 'critical',
    });
  }
  checklist.push({
    key: 'noOverlappingCustomary',
    passed: !inputs.overlappingCustomaryClaim,
    severity: inputs.overlappingCustomaryClaim ? 'critical' : 'info',
  });

  if (inputs.tenureSystem === 'leasehold' && inputs.leaseTermYears !== undefined) {
    checklist.push({
      key: 'leaseTermAcceptable',
      passed: inputs.leaseTermYears >= 20,
      severity: inputs.leaseTermYears < 20 ? 'warn' : 'info',
    });
  }

  const criticalGaps = checklist
    .filter((c) => !c.passed && c.severity === 'critical')
    .map((c) => c.key);

  const verdict: UGTitleSearchResult['verdict'] =
    criticalGaps.length >= 2
      ? 'unworkable'
      : criticalGaps.length === 1
        ? 'requires-cure'
        : checklist.some((c) => !c.passed && c.severity === 'warn')
          ? 'workable'
          : 'clean';

  return { checklist, criticalGaps, verdict };
}
