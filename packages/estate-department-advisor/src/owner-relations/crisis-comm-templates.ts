/**
 * crisis-comm-templates — 6 incident-type owner communications.
 *
 * Per PRSA crisis-comm playbook + NAREIM RE-specific templates.
 * Templates are structured (subject + body sections) so a downstream
 * channel can render to email/SMS/webhook without re-parsing.
 */

export type CrisisIncidentType =
  | 'default-foreclosure'
  | 'lawsuit'
  | 'major-repair'
  | 'tenant-incident'
  | 'fraud-embezzlement'
  | 'regulatory-action';

export interface CrisisCommTemplate {
  readonly incidentType: CrisisIncidentType;
  readonly subject: string;
  readonly bodySections: ReadonlyArray<{ heading: string; body: string }>;
  readonly tone: 'factual' | 'empathetic' | 'legal-cautious' | 'workout';
  readonly authorityFirst: 'counsel' | 'auditor' | 'broker' | 'forensic' | 'self';
  readonly avoidLanguage: ReadonlyArray<string>;
  readonly citation: string;
}

export const CRISIS_COMM_TEMPLATES: Readonly<Record<CrisisIncidentType, CrisisCommTemplate>> = {
  'default-foreclosure': {
    incidentType: 'default-foreclosure',
    subject: '[Action Required] Loan workout in progress — [Property Name]',
    bodySections: [
      { heading: 'Situation', body: 'Lender has notified us of [breach type]. Workout discussions begin [date].' },
      { heading: 'Plan', body: 'Engaging workout counsel. Initial proposal: [forbearance/restructure/equity-call].' },
      { heading: 'Timeline', body: '[milestone 1 — date] · [milestone 2 — date].' },
      { heading: 'Capital ask', body: 'If equity call required, expected size $[amount]; binding answer needed by [date].' },
    ],
    tone: 'workout',
    authorityFirst: 'counsel',
    avoidLanguage: ['guaranteed outcome', 'risk-free', 'easy'],
    citation: 'PRSA crisis-comm + NAREIM workout playbook',
  },
  lawsuit: {
    incidentType: 'lawsuit',
    subject: '[Confidential] Litigation notification — [Property Name]',
    bodySections: [
      { heading: 'Notice received', body: 'On [date] we received a complaint alleging [counsel-vetted summary].' },
      { heading: 'Counsel engaged', body: '[Firm] retained; insurer notified per policy.' },
      { heading: 'Privilege reminder', body: 'Treat as attorney-client privileged; do not forward.' },
      { heading: 'Next update', body: 'After initial response filed (typical 30 days).' },
    ],
    tone: 'legal-cautious',
    authorityFirst: 'counsel',
    avoidLanguage: ['admit', 'liable', 'guilty', 'should have'],
    citation: 'PRSA + ABA Model Rule 1.6 confidentiality',
  },
  'major-repair': {
    incidentType: 'major-repair',
    subject: 'Major repair — [Property Name] — $[amount] estimate',
    bodySections: [
      { heading: 'Incident', body: '[What happened, when, what failed].' },
      { heading: 'Cost', body: 'Estimate $[amount]; insurance recovery expected $[amount] net of deductible.' },
      { heading: 'Timeline', body: 'Repair window [date range]; tenant impact [description].' },
      { heading: 'Recommendation', body: '[Approve as-quoted / get 2nd bid / defer to capex cycle].' },
    ],
    tone: 'factual',
    authorityFirst: 'self',
    avoidLanguage: ['could have prevented', 'shouldn\'t have happened'],
    citation: 'BOMA Emergency Preparedness Guide 2023',
  },
  'tenant-incident': {
    incidentType: 'tenant-incident',
    subject: '[Sensitive] Tenant incident — [Property Name]',
    bodySections: [
      { heading: 'Our condolences', body: 'We are deeply sorry to share that [empathetic summary].' },
      { heading: 'Family / first-responder coordination', body: '[As applicable, redacted as required].' },
      { heading: 'Property operations', body: 'No operational disruption expected; access restricted as needed.' },
      { heading: 'Counsel briefed', body: 'Outside counsel reviewing; no statement to press without coordination.' },
    ],
    tone: 'empathetic',
    authorityFirst: 'counsel',
    avoidLanguage: ['cause of death', 'fault', 'they brought it on'],
    citation: 'PRSA crisis-comm + NAREIM sensitive-incident playbook',
  },
  'fraud-embezzlement': {
    incidentType: 'fraud-embezzlement',
    subject: '[Confidential] Suspected financial irregularity — [Entity]',
    bodySections: [
      { heading: 'Discovery', body: '[Forensic-accountant-vetted summary of pattern detected].' },
      { heading: 'Containment', body: 'Accounts frozen; suspected individuals on administrative leave.' },
      { heading: 'External engagement', body: 'Forensic accountant + insurer + counsel engaged; disclosure decision pending forensic completion.' },
      { heading: 'Owner direction', body: 'Awaiting your guidance on press / law-enforcement notification timing.' },
    ],
    tone: 'legal-cautious',
    authorityFirst: 'forensic',
    avoidLanguage: ['stole', 'embezzled', 'guilty', 'criminal'],
    citation: 'PRSA + AICPA forensic-accounting standards',
  },
  'regulatory-action': {
    incidentType: 'regulatory-action',
    subject: 'Regulatory notice — [Authority] — [Property Name]',
    bodySections: [
      { heading: 'Notice received', body: '[Authority] issued [notice type] on [date]; alleges [counsel-vetted summary].' },
      { heading: 'Timeline', body: 'Response due [date]; hearing [if applicable].' },
      { heading: 'Remediation plan', body: '[Steps already taken / proposed].' },
      { heading: 'Counsel coordination', body: '[Firm] retained; regulator engagement strategy agreed.' },
    ],
    tone: 'factual',
    authorityFirst: 'counsel',
    avoidLanguage: ['admit', 'violation occurred', 'we were wrong'],
    citation: 'PRSA + NAREIM regulatory-action playbook',
  },
};

export function templateFor(incident: CrisisIncidentType): CrisisCommTemplate {
  return CRISIS_COMM_TEMPLATES[incident];
}
