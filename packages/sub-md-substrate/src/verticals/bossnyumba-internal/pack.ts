/**
 * bossnyumba-internal vertical pack — the substrate that powers
 * BOSSNYUMBA's internal-admin chat.
 *
 * Six sub-MDs, all running on the SAME substrate as the owner-customer
 * property-management pack. The scope guard keys on tenantId =
 * "bossnyumba-org" and `scopeIds` = departmentId / teamId.
 */

import type { VerticalPack } from '../../vertical-pack/contract.js';
import { INTERNAL_ENTITY_TYPES } from './entities.js';

export const BOSSNYUMBA_INTERNAL_PACK: VerticalPack = Object.freeze({
  name: 'bossnyumba-internal',
  displayName: 'BOSSNYUMBA Internal (running the org itself)',
  description:
    "Sub-MDs for running BOSSNYUMBA-the-org. Powers the internal-admin chat: hire flows, churn surfacing + chase, monthly payroll, vendor reconciliation, ops incident triage. Same substrate, separate scope.",
  version: '0.1.0',
  entityTypes: INTERNAL_ENTITY_TYPES,
  subMds: Object.freeze([
    Object.freeze({
      name: 'hr.dispatch',
      description:
        'Triage<CandidateSubmission, RecruiterPick> + Dispatch<RecruiterPick, InterviewInvite>. Routes inbound CVs to the right recruiter based on role-family + bandwidth.',
      primitives: Object.freeze([
        Object.freeze({
          kind: 'triage' as const,
          name: 'hr.dispatch.triage',
          notes: 'Role-family + bandwidth ranker.',
        }),
        Object.freeze({
          kind: 'dispatch' as const,
          name: 'hr.dispatch.send',
          notes: 'Interview invite via ATS.',
        }),
      ]),
      entityTypes: Object.freeze(['candidate', 'recruiter', 'interview-slot']),
      connectorsRequired: Object.freeze(['ats-transport', 'email-transport']),
      defaultPermissionMode: 'act-on-yes' as const,
    }),
    Object.freeze({
      name: 'sales.chase',
      description:
        'Chase<ChurnRiskOwner, EscalationRung>. Five-rung ladder: product-tip → walkthrough → AM call → saver-offer → exec handoff.',
      primitives: Object.freeze([
        Object.freeze({
          kind: 'chase' as const,
          name: 'sales.chase.next-touch',
          notes: '5-rung escalation with monotonic severity.',
        }),
      ]),
      entityTypes: Object.freeze(['owner-account', 'churn-signal']),
      connectorsRequired: Object.freeze(['email-transport', 'voice-transport']),
      defaultPermissionMode: 'act-on-yes' as const,
    }),
    Object.freeze({
      name: 'customer-success.compile',
      description:
        'Compile<OrgChurnSignals, CsBrief>. THE PROACTIVE CHURN SURFACER. Daily brief: RED owners, AMBER owners, recent wins, cohort anomalies. Reads signals + touchpoints, recommends sales.chase triggers.',
      primitives: Object.freeze([
        Object.freeze({
          kind: 'compile' as const,
          name: 'customer-success.compile.brief',
          notes:
            'Composite-risk score, banding (R/A/G), cohort anomaly detection, recommended actions.',
        }),
      ]),
      entityTypes: Object.freeze(['owner-account', 'churn-signal', 'cs-touchpoint']),
      connectorsRequired: Object.freeze([]),
      defaultPermissionMode: 'propose' as const,
    }),
    Object.freeze({
      name: 'payroll.compile',
      description:
        'Compile<PayrollLedger, PayRun>. Aggregates a period of salary rows into a four-eyes-ready pay-run. Flags negative-net, period-jumps, mixed currencies. Does NOT pay.',
      primitives: Object.freeze([
        Object.freeze({
          kind: 'compile' as const,
          name: 'payroll.compile.pay-run',
          notes: 'Period totals + per-employee + anomalies (rich).',
        }),
      ]),
      entityTypes: Object.freeze(['employee', 'payroll-run']),
      connectorsRequired: Object.freeze([]),
      defaultPermissionMode: 'propose' as const,
    }),
    Object.freeze({
      name: 'vendor.reconcile',
      description:
        'Reconcile<InvoicesVsPayments, Matches>. Exact match on invoiceRef, then fuzzy match on (vendor, amount, time). Surfaces unpaid invoices and orphan payments.',
      primitives: Object.freeze([
        Object.freeze({
          kind: 'reconcile' as const,
          name: 'vendor.reconcile.match',
          notes: 'Two-phase match: exact → fuzzy (±2% amount, ±14d time).',
        }),
      ]),
      entityTypes: Object.freeze([
        'internal-vendor',
        'internal-invoice',
        'internal-payment',
      ]),
      connectorsRequired: Object.freeze(['accounting-transport']),
      defaultPermissionMode: 'propose' as const,
    }),
    Object.freeze({
      name: 'incident.triage',
      description:
        'Triage<OpsIncident, OncallTeam>. Severity laddering on error-rate + affected-tenant-count. Picks the on-call with bandwidth on the right surface.',
      primitives: Object.freeze([
        Object.freeze({
          kind: 'triage' as const,
          name: 'incident.triage.classify',
          notes: 'SEV0..SEV3 severity ladder + on-call routing.',
        }),
      ]),
      entityTypes: Object.freeze(['ops-incident', 'oncall-team']),
      connectorsRequired: Object.freeze(['pagerduty-transport']),
      defaultPermissionMode: 'auto' as const,
    }),
  ]),
  jurisdictionRules: Object.freeze([
    Object.freeze({
      countryCode: 'TZ',
      currency: 'TZS',
      defaultLanguageTag: 'en-TZ',
      requiresEReceipts: false,
      maxUnattendedChaseRungs: 3,
    }),
  ]),
  connectors: Object.freeze([
    Object.freeze({
      name: 'ats-transport',
      kind: 'ats' as const,
      portType: 'DispatchTransportPort<string>',
      required: true,
    }),
    Object.freeze({
      name: 'email-transport',
      kind: 'email' as const,
      portType: 'DispatchTransportPort<string>',
      required: true,
    }),
    Object.freeze({
      name: 'voice-transport',
      kind: 'voice' as const,
      portType: 'DispatchTransportPort<string>',
      required: false,
    }),
    Object.freeze({
      name: 'accounting-transport',
      kind: 'accounting' as const,
      portType: 'DispatchTransportPort<string>',
      required: true,
    }),
    Object.freeze({
      name: 'pagerduty-transport',
      kind: 'webhook' as const,
      portType: 'DispatchTransportPort<string>',
      required: true,
    }),
  ]),
});
