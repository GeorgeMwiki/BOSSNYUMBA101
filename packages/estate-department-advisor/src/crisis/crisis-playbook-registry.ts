/**
 * crisis-playbook-registry — central registry of 8 incident playbooks.
 *
 * Per PRSA crisis-comm + BOMA Emergency Preparedness 2023 + NIMS ICS
 * adapted to property events.
 */

import type {
  CrisisIncident,
  CrisisPlaybook,
  TriageEntry,
} from '../types.js';
import { firstSeventyTwoHours } from './72hr-triage.js';
import { thirtyDayRecovery } from './30day-recovery.js';
import { POSTMORTEM_TEMPLATE } from './post-mortem-template.js';

const INCIDENTS: ReadonlyArray<CrisisIncident> = [
  'fire',
  'flood',
  'eviction-mass',
  'lawsuit-served',
  'loan-default',
  'fraud-discovered',
  'ransomware',
  'employee-misconduct',
];

function triageFor(incident: CrisisIncident): ReadonlyArray<TriageEntry> {
  const base: TriageEntry[] = [];
  switch (incident) {
    case 'fire':
      base.push(
        { conditionLabel: 'Active fire / smoke', severity: 'critical', immediateOwner: 'director-ops', notifyWithinHours: 0.25 },
        { conditionLabel: 'Tenant displacement > 24h', severity: 'high', immediateOwner: 'director-ops', notifyWithinHours: 2 },
        { conditionLabel: 'Post-incident damage assessment', severity: 'medium', immediateOwner: 'asset-manager', notifyWithinHours: 24 },
      );
      break;
    case 'flood':
      base.push(
        { conditionLabel: 'Active water intrusion', severity: 'critical', immediateOwner: 'maintenance-supervisor', notifyWithinHours: 0.5 },
        { conditionLabel: 'Mold-risk window (24-48h)', severity: 'high', immediateOwner: 'maintenance-supervisor', notifyWithinHours: 6 },
      );
      break;
    case 'eviction-mass':
      base.push(
        { conditionLabel: '> 5 units in single complex', severity: 'high', immediateOwner: 'director-ops', notifyWithinHours: 4 },
        { conditionLabel: '> 10 units cluster', severity: 'critical', immediateOwner: 'director-ops', notifyWithinHours: 1 },
      );
      break;
    case 'lawsuit-served':
      base.push(
        { conditionLabel: 'Complaint served', severity: 'high', immediateOwner: 'external-counsel', notifyWithinHours: 4 },
        { conditionLabel: 'Class-action / certified', severity: 'critical', immediateOwner: 'external-counsel', notifyWithinHours: 1 },
      );
      break;
    case 'loan-default':
      base.push(
        { conditionLabel: 'Missed payment 1', severity: 'medium', immediateOwner: 'director-ops', notifyWithinHours: 24 },
        { conditionLabel: 'Notice of default served', severity: 'critical', immediateOwner: 'external-counsel', notifyWithinHours: 4 },
      );
      break;
    case 'fraud-discovered':
      base.push(
        { conditionLabel: 'Suspected anomaly', severity: 'high', immediateOwner: 'accounting-manager', notifyWithinHours: 8 },
        { conditionLabel: 'Confirmed fraud', severity: 'critical', immediateOwner: 'external-counsel', notifyWithinHours: 1 },
      );
      break;
    case 'ransomware':
      base.push(
        { conditionLabel: 'Encryption detected', severity: 'critical', immediateOwner: 'external-ir-firm', notifyWithinHours: 0.5 },
        { conditionLabel: 'PII exfiltration confirmed', severity: 'critical', immediateOwner: 'external-counsel', notifyWithinHours: 2 },
      );
      break;
    case 'employee-misconduct':
      base.push(
        { conditionLabel: 'Allegation received', severity: 'medium', immediateOwner: 'director-ops', notifyWithinHours: 8 },
        { conditionLabel: 'Substantiated misconduct', severity: 'high', immediateOwner: 'external-counsel', notifyWithinHours: 4 },
      );
      break;
    default: {
      const _exhaustive: never = incident;
      void _exhaustive;
    }
  }
  return base;
}

function citationFor(incident: CrisisIncident): string {
  switch (incident) {
    case 'fire':
    case 'flood':
      return 'BOMA Emergency Preparedness Guide 2023 + NIMS ICS';
    case 'eviction-mass':
      return 'IREM Tenant Relations Best-Practices 2023';
    case 'lawsuit-served':
      return 'ABA Model Rules + NAREIM litigation playbook';
    case 'loan-default':
      return 'NAREIM workout playbook 2023';
    case 'fraud-discovered':
      return 'AICPA forensic accounting standards 2024';
    case 'ransomware':
      return 'NIST IR-3 (Cybersecurity Framework 2.0) + GDPR/POPIA notification rules';
    case 'employee-misconduct':
      return 'SHRM employee-misconduct playbook 2024';
    default:
      return 'PRSA crisis-comm playbook';
  }
}

export function getCrisisPlaybook(incident: CrisisIncident): CrisisPlaybook {
  return {
    incident,
    triageMatrix: triageFor(incident),
    first72Hours: firstSeventyTwoHours(incident),
    day30Recovery: thirtyDayRecovery(incident),
    postMortemTemplate: POSTMORTEM_TEMPLATE,
    citation: citationFor(incident),
  };
}

export function listCrisisIncidents(): ReadonlyArray<CrisisIncident> {
  return INCIDENTS;
}

export const __test__ = { triageFor, citationFor, INCIDENTS };
