/**
 * mock-llm.ts — deterministic mock LLM for CI runs of PMS-bench-1.
 *
 * Design: the mock returns canned JSON tool-plans keyed by `taskId`. Each
 * canned plan is hand-authored to score >= 0.8 composite against the
 * corresponding fixture, so `pnpm pms-bench:run --mock` is a stable green
 * CI gate.
 *
 * Coverage: all 10 maintenance-dispatch + 10 complaint-triage fixtures
 * have hand-crafted canned plans. The remaining 30 fixtures (3 scenarios:
 * arrears, kra-filing, lease-renewal) currently fall through to an empty
 * "not-yet-implemented" plan — those Tier-B/C sub-MDs aren't shipped, so
 * the bench correctly reports them as failing-by-design.
 *
 * Why hand-authored vs. fixture-extraction? The mock has to produce plans
 * that look like real LLM output (free-text comm draft, JSON tool calls
 * with arguments). Auto-deriving them from `expected_actions` would
 * collapse the bench into a tautology.
 */

import type { BenchLlmPort, BenchLlmRequest, BenchLlmResponse } from './llm-port.js';

/**
 * A canned sub-MD plan as if produced by the LLM. The bench adapter parses
 * this same shape for both mock and Anthropic outputs.
 */
export interface CannedPlan {
  readonly actions: ReadonlyArray<{
    readonly tool: string;
    readonly args?: Readonly<Record<string, unknown>>;
    readonly tone?: string;
  }>;
  readonly escalated: boolean;
  readonly comm: string;
  /** USD cents charged by the imaginary LLM for this run. */
  readonly costUsdCents: number;
  /** 0..1 — the sub-MD's self-estimated resolution quality. */
  readonly resolutionQuality: number;
}

const PLANS: Readonly<Record<string, CannedPlan>> = Object.freeze({
  // ─── maintenance-dispatch ───────────────────────────────────────
  'maintenance-dispatch-001': {
    actions: [
      { tool: 'maintenance.classify_severity', args: { class: 'P1-urgent' } },
      { tool: 'maintenance.dispatch_vendor', args: { vendor_skill: 'plumbing-emergency', sla_hours: 2 } },
      { tool: 'maintenance.notify_tenant', tone: 'reassuring-with-eta' },
    ],
    escalated: false,
    comm: 'Hi Stella, we have logged your urgent leak and dispatched an emergency plumber. They will be on-site within 2 hours. Please place a bucket under the drip if safe to do so. We will keep you updated.',
    costUsdCents: 6,
    resolutionQuality: 0.92,
  },
  'maintenance-dispatch-002': {
    actions: [
      { tool: 'maintenance.classify_severity', args: { class: 'P3-non-urgent' } },
      { tool: 'maintenance.schedule_routine_visit', args: { sla_business_days: 5 } },
      { tool: 'maintenance.notify_tenant', tone: 'friendly-confirming' },
    ],
    escalated: false,
    comm: 'Hi Kevin, thanks for the report. We have scheduled a routine handyman visit for the door handle within 5 business days. Please reach out if it gets worse before then.',
    costUsdCents: 4,
    resolutionQuality: 0.88,
  },
  'maintenance-dispatch-003': {
    actions: [
      { tool: 'maintenance.classify_severity', args: { class: 'P0-safety' } },
      { tool: 'maintenance.escalate_to_safety_team', args: { requires_approval: false } },
      { tool: 'maintenance.dispatch_emergency_response', args: { sla_minutes: 30 } },
      { tool: 'maintenance.send_safety_advisory', args: { actions: ['ventilate', 'no-electrical', 'evacuate-if-strong'] } },
    ],
    escalated: true,
    comm: 'Anne — safety alert. Please ventilate the kitchen (open windows), do NOT use any electrical switches, and evacuate with the children if the smell gets stronger. Emergency gas team dispatched, ETA 30 minutes. On-call manager has been notified.',
    costUsdCents: 9,
    resolutionQuality: 0.95,
  },
  'maintenance-dispatch-004': {
    actions: [
      { tool: 'maintenance.classify_severity', args: { class: 'P2-recurring' } },
      { tool: 'maintenance.flag_for_root_cause_review' },
      { tool: 'maintenance.dispatch_vendor', args: { vendor_skill: 'hvac-senior', sla_hours: 24 } },
    ],
    escalated: true,
    comm: 'Hi Felix, third aircon failure on this unit — escalating for a root-cause review and dispatching a senior HVAC technician within 24 hours so we get to the bottom of it this time.',
    costUsdCents: 7,
    resolutionQuality: 0.85,
  },
  'maintenance-dispatch-005': {
    actions: [
      { tool: 'maintenance.classify_severity', args: { class: 'P1-urgent' } },
      { tool: 'maintenance.verify_tenant_identity' },
      { tool: 'maintenance.dispatch_locksmith', args: { sla_minutes: 45 } },
      { tool: 'maintenance.notify_tenant', tone: 'reassuring-with-eta' },
    ],
    escalated: false,
    comm: 'We have verified your tenancy and a locksmith is on the way — ETA 45 minutes. Please stay near the unit door; the locksmith will call when nearby.',
    costUsdCents: 7,
    resolutionQuality: 0.9,
  },
  'maintenance-dispatch-006': {
    actions: [
      { tool: 'maintenance.classify_severity', args: { class: 'P3-compliance' } },
      { tool: 'maintenance.schedule_compliance_visit', args: { service: 'fire-extinguisher-annual' } },
      { tool: 'maintenance.notify_owner', tone: 'professional-confirming' },
    ],
    escalated: false,
    comm: 'Annual fire-extinguisher compliance visit scheduled for the block. Owner has been notified with the appointment details and certificate-of-service workflow.',
    costUsdCents: 5,
    resolutionQuality: 0.88,
  },
  'maintenance-dispatch-007': {
    actions: [
      { tool: 'maintenance.request_clarification', args: { questions: ['which appliance', 'how is it broken', 'photo if possible'] } },
    ],
    escalated: false,
    comm: 'Thanks for the report. Could you help us with three quick details: (1) which appliance or fixture is broken, (2) how it is broken (not working, leaking, noisy), and (3) a photo if possible? This will let us send the right specialist.',
    costUsdCents: 3,
    resolutionQuality: 0.85,
  },
  'maintenance-dispatch-008': {
    actions: [
      { tool: 'maintenance.flag_cost_over_cap' },
      { tool: 'maintenance.draft_owner_approval_request', args: { include_quote: true } },
    ],
    escalated: true,
    comm: 'The repair estimate exceeds the auto-approve cap. Drafted an owner-approval request with the vendor quote attached; awaiting owner decision before proceeding.',
    costUsdCents: 5,
    resolutionQuality: 0.85,
  },
  'maintenance-dispatch-009': {
    actions: [
      { tool: 'maintenance.detect_duplicate_ticket' },
      { tool: 'maintenance.acknowledge_duplicate', tone: 'patient-informative', args: { link_to: 'tk-2026-05-17-091' } },
    ],
    escalated: false,
    comm: 'Thanks for following up. We have already opened a ticket on this earlier today (tk-2026-05-17-091) and the assigned technician is en route. We will reach out as soon as there is an update.',
    costUsdCents: 3,
    resolutionQuality: 0.88,
  },
  'maintenance-dispatch-010': {
    actions: [
      { tool: 'maintenance.classify_severity', args: { class: 'P2-shared' } },
      { tool: 'maintenance.dispatch_vendor', args: { vendor_skill: 'pest-control', sla_hours: 24 } },
      { tool: 'maintenance.notify_block_residents', tone: 'transparent-action-oriented' },
    ],
    escalated: false,
    comm: 'Pest infestation reported in the shared corridor. A pest-control specialist has been dispatched (on-site within 24 hours). All block residents have been notified with prep instructions.',
    costUsdCents: 6,
    resolutionQuality: 0.87,
  },

  // ─── complaint-triage ───────────────────────────────────────────
  'complaint-triage-001': {
    actions: [
      { tool: 'complaint.classify_severity', args: { class: 'P2-recurring' } },
      { tool: 'complaint.send_formal_warning_to_subject', tone: 'firm-respectful' },
      { tool: 'complaint.acknowledge_complainant', tone: 'empathetic-confirming' },
    ],
    escalated: false,
    comm: 'Daniel, thanks for raising this — third report of noise from 7B, so we are sending Lisa a formal warning today citing the lease quiet-hours clause. We will follow up after this weekend; if it continues, the next step is mediation.',
    costUsdCents: 5,
    resolutionQuality: 0.88,
  },
  'complaint-triage-002': {
    actions: [
      { tool: 'complaint.classify_severity', args: { class: 'P0-safety' } },
      { tool: 'complaint.escalate_to_safety_officer' },
      { tool: 'complaint.acknowledge_complainant_privately', tone: 'trauma-informed' },
    ],
    escalated: true,
    comm: 'Faith, thank you for trusting us with something this difficult. Your safety is the priority; the on-call safety officer has been alerted and will reach out privately within the hour to plan next steps with you. Nothing will be shared with anyone else without your consent.',
    costUsdCents: 6,
    resolutionQuality: 0.93,
  },
  'complaint-triage-003': {
    actions: [
      { tool: 'complaint.classify_severity', args: { class: 'P3-disputes' } },
      { tool: 'complaint.contact_host_unit', args: { host: '5D' }, tone: 'neutral-factual' },
      { tool: 'complaint.update_complainant', tone: 'informative-supportive' },
    ],
    escalated: false,
    comm: 'We have reached out to the host of 5D regarding the parking obstruction with a neutral, factual reminder of the assigned-bay policy. We will update you once they respond.',
    costUsdCents: 4,
    resolutionQuality: 0.85,
  },
  'complaint-triage-004': {
    actions: [
      { tool: 'complaint.classify_severity', args: { class: 'P2-staff' } },
      { tool: 'complaint.acknowledge_complainant', tone: 'empathetic-confirming' },
      { tool: 'complaint.flag_for_hr_review' },
    ],
    escalated: true,
    comm: 'Thank you for the report. We take staff-conduct concerns seriously — this has been confidentially flagged for HR review and an HR partner will reach out within two business days for a one-on-one.',
    costUsdCents: 5,
    resolutionQuality: 0.86,
  },
  'complaint-triage-005': {
    actions: [
      { tool: 'complaint.log_anonymous_tip' },
      { tool: 'complaint.flag_for_investigation', args: { dispatch: 'compliance-officer' } },
    ],
    escalated: true,
    comm: 'Anonymous tip logged and routed to the compliance officer for confidential investigation.',
    costUsdCents: 4,
    resolutionQuality: 0.83,
  },
  'complaint-triage-006': {
    actions: [
      { tool: 'complaint.classify_severity', args: { class: 'P3-pet' } },
      { tool: 'complaint.send_friendly_advisory_to_subject', tone: 'gentle-policy-reminder' },
      { tool: 'complaint.acknowledge_complainant', tone: 'empathetic' },
    ],
    escalated: false,
    comm: 'Thanks for raising this. We have sent a friendly reminder to the pet-owning neighbour about the building pet-noise policy. Hopefully that resolves it; please let us know if it does not improve.',
    costUsdCents: 4,
    resolutionQuality: 0.86,
  },
  'complaint-triage-007': {
    actions: [
      { tool: 'complaint.log_vendor_quality_event' },
      { tool: 'complaint.dispatch_corrective_task_to_vendor', args: { sla_hours: 4 } },
      { tool: 'complaint.notify_complainant_of_action', tone: 'action-oriented' },
    ],
    escalated: false,
    comm: 'Got it — cleaning vendor has been issued a corrective task with a 4-hour SLA, and this is now logged against their quality record. We will confirm with you once the rework is done.',
    costUsdCents: 5,
    resolutionQuality: 0.85,
  },
  'complaint-triage-008': {
    actions: [
      { tool: 'complaint.classify_severity', args: { class: 'P0-protected' } },
      { tool: 'complaint.escalate_to_compliance_officer' },
      { tool: 'complaint.acknowledge_complainant_privately', tone: 'trauma-informed' },
    ],
    escalated: true,
    comm: 'Thank you for sharing this — discrimination concerns go directly to the compliance officer, who will reach out privately to listen and plan next steps with you. Nothing is shared with other tenants or staff without your consent.',
    costUsdCents: 6,
    resolutionQuality: 0.91,
  },
  'complaint-triage-009': {
    actions: [
      { tool: 'complaint.acknowledge_complainant_with_history', tone: 'patient-firm' },
      { tool: 'complaint.log_pattern_observation' },
      { tool: 'complaint.flag_for_human_review_if_threshold_exceeded' },
    ],
    escalated: true,
    comm: 'Thanks for getting in touch. We have reviewed the history on this complaint thread; given the repeat pattern, a human moderator will take a look and reach out with a considered response.',
    costUsdCents: 5,
    resolutionQuality: 0.82,
  },
  'complaint-triage-010': {
    actions: [
      { tool: 'complaint.reclassify_as_compliment' },
      { tool: 'complaint.relay_compliment_to_staff', args: { recipient: 'caretaker-north' } },
      { tool: 'complaint.acknowledge_submitter', tone: 'warm-grateful' },
    ],
    escalated: false,
    comm: 'This made our day — thank you for the kind words! We have passed the compliment along to the north-block caretaker and noted it on their record.',
    costUsdCents: 3,
    resolutionQuality: 0.94,
  },
});

/**
 * Empty fallback for un-canned (Tier-B/C) scenarios — produces a "not-yet"
 * observation. The bench correctly fails these tasks because the sub-MDs
 * aren't shipped; not the mock's job to fake them.
 */
const EMPTY_PLAN: CannedPlan = Object.freeze({
  actions: [],
  escalated: false,
  comm: '',
  costUsdCents: 1,
  resolutionQuality: 0,
});

export function createMockLlm(): BenchLlmPort {
  return Object.freeze({
    async complete(req: BenchLlmRequest): Promise<BenchLlmResponse> {
      const plan = PLANS[req.taskId] ?? EMPTY_PLAN;
      // Emit as JSON so the adapter's parser path is exercised end-to-end.
      const text = JSON.stringify(plan);
      return Object.freeze({
        text,
        costUsdCents: plan.costUsdCents,
        provider: 'mock',
        model: 'pms-bench-mock-v1',
      });
    },
  });
}

/** Exported for unit tests that want to assert the canned set. */
export function getCannedPlanForTask(taskId: string): CannedPlan | null {
  return PLANS[taskId] ?? null;
}
