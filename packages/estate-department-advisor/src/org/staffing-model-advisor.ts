/**
 * staffing-model-advisor — heads-per-door + span-of-control.
 *
 * Sources:
 *   - IREM Property Manager Staffing Survey 2024
 *   - Deloitte Real-Estate Org Design 2023 (span-of-control)
 *   - BOMA Manager-to-Direct-Report Standards
 */

import type {
  AssetClass,
  PortfolioSnapshot,
  Recommendation,
  Role,
  StaffingAdvice,
} from '../types.js';

export interface StaffingBand {
  readonly doorsPerPmMin: number;
  readonly doorsPerPmMax: number;
  readonly doorsPerMaintMin: number;
  readonly doorsPerMaintMax: number;
}

export const MF_STAFFING_BANDS: Readonly<Record<string, StaffingBand>> = {
  garden: { doorsPerPmMin: 110, doorsPerPmMax: 140, doorsPerMaintMin: 80, doorsPerMaintMax: 100 },
  'mid-rise': { doorsPerPmMin: 80, doorsPerPmMax: 110, doorsPerMaintMin: 60, doorsPerMaintMax: 80 },
  'high-rise': { doorsPerPmMin: 55, doorsPerPmMax: 80, doorsPerMaintMin: 40, doorsPerMaintMax: 55 },
  affordable: { doorsPerPmMin: 130, doorsPerPmMax: 170, doorsPerMaintMin: 90, doorsPerMaintMax: 110 },
} as const;

export interface OfficeStaffingBand {
  readonly sfPerPmMin: number;
  readonly sfPerPmMax: number;
  readonly sfPerMaintMin: number;
  readonly sfPerMaintMax: number;
}

export const OFFICE_STAFFING_BANDS: Readonly<Record<string, OfficeStaffingBand>> = {
  A: { sfPerPmMin: 250_000, sfPerPmMax: 350_000, sfPerMaintMin: 100_000, sfPerMaintMax: 150_000 },
  B: { sfPerPmMin: 350_000, sfPerPmMax: 500_000, sfPerMaintMin: 150_000, sfPerMaintMax: 220_000 },
  C: { sfPerPmMin: 500_000, sfPerPmMax: 700_000, sfPerMaintMin: 200_000, sfPerMaintMax: 300_000 },
} as const;

// Deloitte 2023 + BOMA: max direct reports.
export const SPAN_OF_CONTROL: Readonly<Record<Role, number>> = {
  'property-manager': 8,
  'senior-pm': 6,
  'regional-pm': 6,
  'director-ops': 7,
  'asset-manager': 12,
  'leasing-agent': 0,
  'leasing-manager': 10,
  'accounting-manager': 6,
  accountant: 0,
  'maintenance-tech': 0,
  'maintenance-supervisor': 8,
  admin: 0,
};

function classifyMfBand(doors: number, assetClass: AssetClass): string {
  if (assetClass !== 'multifamily') return 'mid-rise';
  if (doors < 80) return 'high-rise';
  if (doors < 200) return 'mid-rise';
  return 'garden';
}

export function adviseStaffing(input: {
  readonly portfolio: PortfolioSnapshot;
  readonly assetClassFocus?: 'multifamily' | 'office';
}): StaffingAdvice {
  const { portfolio } = input;
  const focus = input.assetClassFocus ?? 'multifamily';

  const pmFte = portfolio.fteHeadcount
    .filter((h) => h.role === 'property-manager' || h.role === 'senior-pm')
    .reduce((s, h) => s + h.fte, 0);
  const maintFte = portfolio.fteHeadcount
    .filter((h) => h.role === 'maintenance-tech' || h.role === 'maintenance-supervisor')
    .reduce((s, h) => s + h.fte, 0);

  let currentDoorsPerPmFte = 0;
  let targetDoorsPerPmFte = 0;
  let currentSfPerMaintFte = 0;
  let targetSfPerMaintFte = 0;
  const recs: Recommendation[] = [];

  if (focus === 'multifamily') {
    const mf = portfolio.properties.filter((p) => p.assetClass === 'multifamily');
    const doors = mf.reduce((s, p) => s + p.doors, 0);
    const band = MF_STAFFING_BANDS[classifyMfBand(doors, 'multifamily')];
    if (band) {
      currentDoorsPerPmFte = pmFte > 0 ? doors / pmFte : 0;
      targetDoorsPerPmFte = (band.doorsPerPmMin + band.doorsPerPmMax) / 2;
      currentSfPerMaintFte = maintFte > 0 ? doors / maintFte : 0;
      targetSfPerMaintFte = (band.doorsPerMaintMin + band.doorsPerMaintMax) / 2;

      if (currentDoorsPerPmFte > band.doorsPerPmMax && pmFte > 0) {
        recs.push({
          id: 'staff.pm.overstretched',
          kind: 'org-staffing',
          severity: 'high',
          headline: `PM coverage ${currentDoorsPerPmFte.toFixed(0)} doors/FTE exceeds IREM band (${band.doorsPerPmMax})`,
          rationale: `Above-band PM ratios correlate with 1.4× attrition and 12% NPS drop per IREM 2024 staffing survey.`,
          citation: 'IREM Property Manager Staffing Survey 2024',
          strategicScore: 0.7,
          urgencyScore: 0.6,
          composite: 0.45 * 0.7 + 0.25 * 0.6,
        });
      }
      if (currentSfPerMaintFte > band.doorsPerMaintMax && maintFte > 0) {
        recs.push({
          id: 'staff.maint.overstretched',
          kind: 'org-staffing',
          severity: 'high',
          headline: `Maintenance coverage ${currentSfPerMaintFte.toFixed(0)} doors/FTE exceeds IREM band (${band.doorsPerMaintMax})`,
          rationale: `Above-band maintenance ratios drive response-time SLA breach and Kingsley maintenance-score drop.`,
          citation: 'IREM 2024 + Kingsley Index 2024',
          strategicScore: 0.7,
          urgencyScore: 0.65,
          composite: 0.45 * 0.7 + 0.25 * 0.65,
        });
      }
    }
  } else {
    const office = portfolio.properties.filter((p) => p.assetClass === 'office');
    const sf = office.reduce((s, p) => s + p.rentableSf, 0);
    const klass = sf > 500_000 ? 'A' : sf > 200_000 ? 'B' : 'C';
    const band = OFFICE_STAFFING_BANDS[klass];
    if (band) {
      currentDoorsPerPmFte = pmFte > 0 ? sf / pmFte : 0;
      targetDoorsPerPmFte = (band.sfPerPmMin + band.sfPerPmMax) / 2;
      currentSfPerMaintFte = maintFte > 0 ? sf / maintFte : 0;
      targetSfPerMaintFte = (band.sfPerMaintMin + band.sfPerMaintMax) / 2;

      if (currentDoorsPerPmFte > band.sfPerPmMax) {
        recs.push({
          id: 'staff.office.pm.over',
          kind: 'org-staffing',
          severity: 'medium',
          headline: `Office PM SF/FTE ${currentDoorsPerPmFte.toFixed(0)} exceeds IREM band (${band.sfPerPmMax})`,
          rationale: `Above IREM 2024 office band — review whether 3rd-party PM augmentation is more economic than in-house hire.`,
          citation: 'IREM 2024 Office Staffing',
          strategicScore: 0.55,
          urgencyScore: 0.4,
          composite: 0.45 * 0.55 + 0.25 * 0.4,
        });
      }
    }
  }

  // Span-of-control: assume a flat senior-PM with 0..N PMs as proxy.
  const flags: string[] = [];
  for (const h of portfolio.fteHeadcount) {
    const cap = SPAN_OF_CONTROL[h.role];
    // Heuristic: report capacity violations only when role and FTE pair suggest direct reports.
    if (cap > 0 && h.fte > cap) {
      flags.push(`${h.role} FTE ${h.fte.toFixed(1)} > Deloitte span ${cap}`);
    }
  }

  // Compensation drift surfaced separately; placeholder here.
  return {
    tenantId: portfolio.tenantId,
    currentDoorsPerPmFte,
    targetDoorsPerPmFte,
    currentSfPerMaintFte,
    targetSfPerMaintFte,
    spanOfControlFlags: flags,
    compDriftByRole: [],
    recommendations: recs,
  };
}

export const __test__ = { classifyMfBand };
