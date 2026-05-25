/**
 * 72hr-triage — first-72-hour action sequences per incident.
 */

import type { CrisisIncident, PlaybookAction } from '../types.js';

export function firstSeventyTwoHours(
  incident: CrisisIncident,
): ReadonlyArray<PlaybookAction> {
  switch (incident) {
    case 'fire':
      return [
        { orderInSequence: 1, action: 'Confirm life-safety; evacuate; head-count', owner: 'director-ops', slaHours: 0.5 },
        { orderInSequence: 2, action: 'Notify fire marshal + insurer (24-hr policy clock)', owner: 'director-ops', slaHours: 2 },
        { orderInSequence: 3, action: 'Alternative housing for displaced tenants', owner: 'property-manager', slaHours: 12 },
        { orderInSequence: 4, action: 'Secure scene + board-up if needed', owner: 'maintenance-supervisor', slaHours: 4 },
        { orderInSequence: 5, action: 'Initial press / tenant communication', owner: 'director-ops', slaHours: 6 },
        { orderInSequence: 6, action: 'Adjuster site visit scheduled', owner: 'insurer', slaHours: 48 },
        { orderInSequence: 7, action: 'Damage photo + video documentation', owner: 'maintenance-supervisor', slaHours: 24 },
      ];
    case 'flood':
      return [
        { orderInSequence: 1, action: 'Shut off water source; isolate affected area', owner: 'maintenance-supervisor', slaHours: 0.5 },
        { orderInSequence: 2, action: 'Notify insurer + remediation vendor', owner: 'director-ops', slaHours: 2 },
        { orderInSequence: 3, action: 'Begin dehumidification within mold window (< 48h)', owner: 'maintenance-supervisor', slaHours: 6 },
        { orderInSequence: 4, action: 'Mold-remediation contract scoped', owner: 'asset-manager', slaHours: 24 },
        { orderInSequence: 5, action: 'Tenant communication + temporary housing if needed', owner: 'property-manager', slaHours: 12 },
        { orderInSequence: 6, action: 'Document moisture readings + photos', owner: 'maintenance-supervisor', slaHours: 12 },
      ];
    case 'eviction-mass':
      return [
        { orderInSequence: 1, action: 'Counsel review of notices for compliance', owner: 'external-counsel', slaHours: 8 },
        { orderInSequence: 2, action: 'Serve notices with proper proof-of-service', owner: 'property-manager', slaHours: 24 },
        { orderInSequence: 3, action: 'Sheriff scheduling for lockouts', owner: 'external-counsel', slaHours: 48 },
        { orderInSequence: 4, action: 'Press/community comms cadence agreed', owner: 'director-ops', slaHours: 24 },
        { orderInSequence: 5, action: 'Re-marketing plan drafted for vacated units', owner: 'leasing-manager', slaHours: 72 },
      ];
    case 'lawsuit-served':
      return [
        { orderInSequence: 1, action: 'Retain counsel; do not respond directly', owner: 'external-counsel', slaHours: 4 },
        { orderInSequence: 2, action: 'Notify insurer per policy (typical 24h)', owner: 'director-ops', slaHours: 24 },
        { orderInSequence: 3, action: 'Issue litigation hold on documents/emails', owner: 'external-counsel', slaHours: 8 },
        { orderInSequence: 4, action: 'Internal communication: privileged, no speculation', owner: 'director-ops', slaHours: 8 },
        { orderInSequence: 5, action: 'Counsel files appearance / answer', owner: 'external-counsel', slaHours: 72 },
      ];
    case 'loan-default':
      return [
        { orderInSequence: 1, action: 'Request lender meeting; gather covenant data', owner: 'director-ops', slaHours: 4 },
        { orderInSequence: 2, action: 'Workout counsel retained', owner: 'external-counsel', slaHours: 24 },
        { orderInSequence: 3, action: 'Draft restructure proposal', owner: 'director-ops', slaHours: 48 },
        { orderInSequence: 4, action: 'Owner equity-call decision communicated', owner: 'director-ops', slaHours: 48 },
        { orderInSequence: 5, action: 'Lender meeting held', owner: 'lender', slaHours: 72 },
      ];
    case 'fraud-discovered':
      return [
        { orderInSequence: 1, action: 'Freeze affected accounts; preserve evidence', owner: 'accounting-manager', slaHours: 1 },
        { orderInSequence: 2, action: 'Engage forensic accountant', owner: 'director-ops', slaHours: 4 },
        { orderInSequence: 3, action: 'Notify insurer (crime / fidelity bond)', owner: 'director-ops', slaHours: 24 },
        { orderInSequence: 4, action: 'Legal-counsel engaged for AG/regulator strategy', owner: 'external-counsel', slaHours: 24 },
        { orderInSequence: 5, action: 'Suspected individuals on admin leave', owner: 'director-ops', slaHours: 12 },
      ];
    case 'ransomware':
      return [
        { orderInSequence: 1, action: 'Isolate affected systems from network', owner: 'external-ir-firm', slaHours: 0.5 },
        { orderInSequence: 2, action: 'Engage breach counsel + IR firm', owner: 'external-counsel', slaHours: 2 },
        { orderInSequence: 3, action: 'Backup integrity check + restore plan', owner: 'external-ir-firm', slaHours: 24 },
        { orderInSequence: 4, action: 'Insurer notification (cyber policy clock)', owner: 'director-ops', slaHours: 24 },
        { orderInSequence: 5, action: 'Regulator + data-subject notification analysis', owner: 'external-counsel', slaHours: 48 },
        { orderInSequence: 6, action: 'Ransom-payment decision (counsel + IR firm)', owner: 'external-counsel', slaHours: 48 },
      ];
    case 'employee-misconduct':
      return [
        { orderInSequence: 1, action: 'Suspend with pay pending investigation', owner: 'director-ops', slaHours: 4 },
        { orderInSequence: 2, action: 'Engage HR investigator + counsel', owner: 'external-counsel', slaHours: 24 },
        { orderInSequence: 3, action: 'Document collection + witness interviews', owner: 'external-counsel', slaHours: 48 },
        { orderInSequence: 4, action: 'Communication-hold to internal staff', owner: 'director-ops', slaHours: 12 },
        { orderInSequence: 5, action: 'Initial findings briefing', owner: 'external-counsel', slaHours: 72 },
      ];
    default: {
      const _exhaustive: never = incident;
      void _exhaustive;
      return [];
    }
  }
}
