/**
 * comm-pattern-playbook — 8 canonical owner archetypes + comm cadence.
 *
 * Sources: NAR IREM owner-comm research, CFA Institute Code §V(A)
 * investor-communication standards.
 */

import type { OwnerArchetype, OwnerCommsPattern } from '../types.js';

export const OWNER_COMM_PATTERNS: Readonly<Record<OwnerArchetype, OwnerCommsPattern>> = {
  'cashflow-first': {
    archetype: 'cashflow-first',
    cadence: 'monthly',
    mustInclude: ['net cash distributed', 'distribution forecast next 3 months', 'arrears summary'],
    avoid: ['lengthy strategy decks', 'multi-year IRR projections'],
    rationale: 'Cashflow-first owners optimise for predictable distributions — hide complexity, lead with the cheque size.',
    citation: 'NAR IREM owner-comm 2024',
  },
  'growth-acquisitive': {
    archetype: 'growth-acquisitive',
    cadence: 'bi-weekly',
    mustInclude: ['acquisition pipeline', 'capital available for deals', 'comp transactions seen this week'],
    avoid: ['hyper-detailed maintenance reports'],
    rationale: 'Growth investors hunt deals; pipeline + cap-available are the only signals that move them.',
    citation: 'NAR IREM owner-comm 2024',
  },
  'exit-prep': {
    archetype: 'exit-prep',
    cadence: 'monthly',
    mustInclude: ['NAV update', 'comp transactions', 'marketing-pack progress', 'broker shortlist'],
    avoid: ['speculation on bidders'],
    rationale: 'Exit-prep owners need an audit-trail of value-realisation steps — NAV + comp + process status.',
    citation: 'NAREIT exit playbooks',
  },
  'preservation-legacy': {
    archetype: 'preservation-legacy',
    cadence: 'quarterly',
    mustInclude: ['compliance status', 'insurance renewal calendar', 'deferred-maintenance log'],
    avoid: ['speculative growth pitches', 'crypto-style alpha narratives'],
    rationale: 'Legacy holders prize stewardship — show that nothing is on fire.',
    citation: 'NAR IREM owner-comm 2024',
  },
  institutional: {
    archetype: 'institutional',
    cadence: 'quarterly',
    mustInclude: [
      'full reporting package',
      'IRR (gross + net)',
      'equity multiple (MOIC)',
      'audited annual',
      'risk-register update',
    ],
    avoid: ['informal text/voice updates'],
    rationale: 'Institutional LPs require auditable cadence per CFA Institute Code §V(A) — formality is the value-add.',
    citation: 'CFA Institute Code of Ethics §V(A)',
  },
  'passive-landlord': {
    archetype: 'passive-landlord',
    cadence: 'monthly',
    mustInclude: ['rent collected', 'arrears', 'occupancy', 'big-ticket items > $1k'],
    avoid: ['portfolio-level analytics'],
    rationale: 'Passive landlords with 1-3 properties want concrete operational facts, not investment-thesis polish.',
    citation: 'NAR IREM owner-comm 2024',
  },
  'active-investor': {
    archetype: 'active-investor',
    cadence: 'weekly',
    mustInclude: ['market trends', 'deal flow', 'leverage / financing market', 'alpha opportunities'],
    avoid: ['retrospective-only reporting'],
    rationale: 'Active investors trade their own portfolios; signal velocity is the value.',
    citation: 'NAR IREM owner-comm 2024',
  },
  'distressed-forced-sale': {
    archetype: 'distressed-forced-sale',
    cadence: 'weekly',
    mustInclude: ['marketing-plan status', 'broker package draft', 'closing-timeline gantt', 'reserve-burn alerts'],
    avoid: ['long-term value-add proposals'],
    rationale: 'Forced-sale stewardship demands transparent, weekly check-ins on the exit path.',
    citation: 'NAREIM crisis-mgmt playbook 2023',
  },
};

export function commPatternFor(archetype: OwnerArchetype): OwnerCommsPattern {
  return OWNER_COMM_PATTERNS[archetype];
}
