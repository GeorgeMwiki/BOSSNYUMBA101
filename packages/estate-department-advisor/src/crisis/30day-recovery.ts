/**
 * 30day-recovery — day-3 to day-30 recovery actions per incident.
 */

import type { CrisisIncident, PlaybookAction } from '../types.js';

const D = (n: number) => n * 24;

export function thirtyDayRecovery(
  incident: CrisisIncident,
): ReadonlyArray<PlaybookAction> {
  switch (incident) {
    case 'fire':
      return [
        { orderInSequence: 1, action: 'Adjuster final report + scope of loss', owner: 'insurer', slaHours: D(7) },
        { orderInSequence: 2, action: 'Restoration vendor RFP', owner: 'asset-manager', slaHours: D(10) },
        { orderInSequence: 3, action: 'Permit-pull for repairs', owner: 'asset-manager', slaHours: D(14) },
        { orderInSequence: 4, action: 'Tenant make-good / rent-credit decisions', owner: 'director-ops', slaHours: D(14) },
        { orderInSequence: 5, action: 'Insurance proceeds drawdown #1', owner: 'director-ops', slaHours: D(21) },
        { orderInSequence: 6, action: 'Construction kickoff', owner: 'asset-manager', slaHours: D(28) },
      ];
    case 'flood':
      return [
        { orderInSequence: 1, action: 'Mold-clearance testing', owner: 'maintenance-supervisor', slaHours: D(7) },
        { orderInSequence: 2, action: 'Drywall + flooring restoration', owner: 'asset-manager', slaHours: D(14) },
        { orderInSequence: 3, action: 'Root-cause source analysis (plumbing/roof/etc.)', owner: 'maintenance-supervisor', slaHours: D(21) },
        { orderInSequence: 4, action: 'Capital improvement plan to prevent recurrence', owner: 'asset-manager', slaHours: D(28) },
      ];
    case 'eviction-mass':
      return [
        { orderInSequence: 1, action: 'Court hearings + judgments', owner: 'external-counsel', slaHours: D(14) },
        { orderInSequence: 2, action: 'Unit turn + re-leasing', owner: 'leasing-manager', slaHours: D(21) },
        { orderInSequence: 3, action: 'Bad-debt write-off accounting', owner: 'accounting-manager', slaHours: D(28) },
        { orderInSequence: 4, action: 'Screening-policy retrospective', owner: 'director-ops', slaHours: D(28) },
      ];
    case 'lawsuit-served':
      return [
        { orderInSequence: 1, action: 'Discovery responses drafted', owner: 'external-counsel', slaHours: D(21) },
        { orderInSequence: 2, action: 'Settlement-vs-defend analysis', owner: 'external-counsel', slaHours: D(28) },
        { orderInSequence: 3, action: 'Reserve accrual booked', owner: 'accounting-manager', slaHours: D(30) },
      ];
    case 'loan-default':
      return [
        { orderInSequence: 1, action: 'Forbearance / modification executed', owner: 'external-counsel', slaHours: D(14) },
        { orderInSequence: 2, action: 'Cure payment or equity infusion processed', owner: 'director-ops', slaHours: D(21) },
        { orderInSequence: 3, action: 'Covenant compliance dashboard published', owner: 'accounting-manager', slaHours: D(28) },
      ];
    case 'fraud-discovered':
      return [
        { orderInSequence: 1, action: 'Forensic-report draft delivered', owner: 'external-counsel', slaHours: D(14) },
        { orderInSequence: 2, action: 'Insurance claim filed under fidelity bond', owner: 'director-ops', slaHours: D(21) },
        { orderInSequence: 3, action: 'Law-enforcement referral decision', owner: 'external-counsel', slaHours: D(21) },
        { orderInSequence: 4, action: 'Controls strengthening rollout', owner: 'accounting-manager', slaHours: D(28) },
      ];
    case 'ransomware':
      return [
        { orderInSequence: 1, action: 'Full system restore from clean backup', owner: 'external-ir-firm', slaHours: D(7) },
        { orderInSequence: 2, action: 'Regulator + data-subject notifications executed', owner: 'external-counsel', slaHours: D(14) },
        { orderInSequence: 3, action: 'Vulnerability remediation + patch program', owner: 'external-ir-firm', slaHours: D(21) },
        { orderInSequence: 4, action: 'Insurance claim + sub-rogation strategy', owner: 'director-ops', slaHours: D(28) },
      ];
    case 'employee-misconduct':
      return [
        { orderInSequence: 1, action: 'Investigation report finalised', owner: 'external-counsel', slaHours: D(14) },
        { orderInSequence: 2, action: 'Termination or reinstatement decision executed', owner: 'director-ops', slaHours: D(21) },
        { orderInSequence: 3, action: 'Policy / training updates rolled out', owner: 'director-ops', slaHours: D(28) },
      ];
    default: {
      const _exhaustive: never = incident;
      void _exhaustive;
      return [];
    }
  }
}
