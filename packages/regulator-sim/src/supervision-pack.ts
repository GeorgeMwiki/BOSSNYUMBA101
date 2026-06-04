/**
 * Regulator simulation — property-regulator supervision pack.
 *
 * Generates the document set a Tanzania property / housing regulator plus a
 * treasury supervisor would request during a routine supervisory visit:
 *
 *   1. Cover sheet            (institution + period + checksum)
 *   2. Rent collection        (billed vs collected in the period)
 *   3. Lease compliance       (active leases in good standing)
 *   4. Treasury liquidity     (coverage ratio)
 *   5. AML / sanctions        (alert disposition)
 *   6. Model governance       (registry + cards + monitoring)
 *   7. Incident & breach log
 *   8. Tenant-complaint summary
 *
 * Deterministic for a given input, so it doubles as a reproducible regulator
 * submission and a test fixture. Pure — no port dependency.
 *
 * @module @bossnyumba/regulator-sim/supervision-pack
 */

import type {
  SupervisionDocument,
  SupervisionPackInput,
  SupervisionPackResult,
} from './types';

// Non-crypto checksum: stable + zero-dep, used only for repeatable artefact
// IDs and tests. A production submission anchors the pack to the hash-chain
// audit ledger (`@bossnyumba/audit-hash-chain`) instead.
function checksum(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return `cs-${(h >>> 0).toString(16)}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

function coverSheet(input: SupervisionPackInput): SupervisionDocument {
  return {
    section: '1',
    title: 'Cover Sheet',
    contents: [
      `Institution: ${input.institution}`,
      `Portfolio registration: ${input.portfolioRegistrationNumber}`,
      `Reporting period: ${input.periodFromIso} to ${input.periodToIso}`,
    ].join('\n'),
  };
}

function rentCollection(input: SupervisionPackInput): SupervisionDocument {
  return {
    section: '2',
    title: 'Rent Collection',
    contents: [
      `Rent collected vs billed: ${fmtPct(input.rentCollectionRatio)}`,
      `Regulatory expectation: 100.00% of billed rent collected or under plan`,
      input.rentCollectionRatio >= 1.0
        ? 'Status: FULLY COLLECTED'
        : 'Status: ARREARS (collection plan required)',
    ].join('\n'),
  };
}

function leaseCompliance(input: SupervisionPackInput): SupervisionDocument {
  return {
    section: '3',
    title: 'Lease Compliance',
    contents: [
      `Leases in good standing: ${fmtPct(input.leaseComplianceRatio)}`,
      `Threshold (alert): 95.00%`,
      input.leaseComplianceRatio >= 0.95
        ? 'Status: WITHIN APPETITE'
        : 'Status: ELEVATED (lapsed-lease remediation required)',
    ].join('\n'),
  };
}

function liquidity(input: SupervisionPackInput): SupervisionDocument {
  return {
    section: '4',
    title: 'Treasury Liquidity',
    contents: [
      `Liquidity coverage ratio: ${fmtPct(input.liquidityRatio)}`,
      `Regulatory minimum: 100.00%`,
      input.liquidityRatio >= 1.0 ? 'Status: COMPLIANT' : 'Status: BREACH',
    ].join('\n'),
  };
}

function amlSection(input: SupervisionPackInput): SupervisionDocument {
  const open = Math.max(input.amlAlerts - input.amlClosed, 0);
  return {
    section: '5',
    title: 'AML / Sanctions',
    contents: [
      `Alerts raised: ${input.amlAlerts}`,
      `Alerts closed: ${input.amlClosed}`,
      `Alerts open: ${open}`,
      open === 0
        ? 'All alerts dispositioned within SLA'
        : `${open} alert(s) require attention`,
    ].join('\n'),
  };
}

function modelGovernance(): SupervisionDocument {
  return {
    section: '6',
    title: 'Model Governance',
    contents: [
      'All decisioning models are registered in the model registry.',
      'Each model card was reviewed within the last 90 days.',
      'Drift monitoring (PSI + KS) runs daily on production scores.',
      'Fairness monitoring runs daily on protected attributes; tolerance +/-10pp.',
    ].join('\n'),
  };
}

function incidentLog(): SupervisionDocument {
  return {
    section: '7',
    title: 'Incidents & Breaches',
    contents: [
      'All security incidents logged in the OCSF audit ledger (append-only).',
      'Incident-response runbooks covered: account takeover, RLS probe, deepfake voice.',
      'PDPA breach notifications dispatched within 72 hours where applicable.',
    ].join('\n'),
  };
}

function complaints(): SupervisionDocument {
  return {
    section: '8',
    title: 'Tenant Complaints',
    contents: [
      'Complaints intake bilingual (English and Swahili).',
      'Resolution SLA: tier-1 under 24h, tier-2 under 7 days, escalations under 30 days.',
      'All complaints anchored to the same hash-chain ledger as decisions.',
    ].join('\n'),
  };
}

export function buildSupervisionPack(
  input: SupervisionPackInput,
): SupervisionPackResult {
  const documents: ReadonlyArray<SupervisionDocument> = [
    coverSheet(input),
    rentCollection(input),
    leaseCompliance(input),
    liquidity(input),
    amlSection(input),
    modelGovernance(),
    incidentLog(),
    complaints(),
  ];

  const corpus = documents
    .map((d) => `${d.section}.${d.title}|${d.contents}`)
    .join('\n---\n');

  return {
    institution: input.institution,
    periodFromIso: input.periodFromIso,
    periodToIso: input.periodToIso,
    documents,
    checksum: checksum(corpus),
  };
}

export const SUPERVISION_PACK_REQUIRED_SECTIONS = [
  'Cover Sheet',
  'Rent Collection',
  'Lease Compliance',
  'Treasury Liquidity',
  'AML / Sanctions',
  'Model Governance',
  'Incidents & Breaches',
  'Tenant Complaints',
] as const;
