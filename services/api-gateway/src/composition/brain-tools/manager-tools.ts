/**
 * PT-B — Manager persona tools (T3 module manager).
 *
 * Real-estate retailoring of Borjie's manager-tools.ts. The property
 * manager is the daily operator — handles leasing, maintenance dispatch,
 * staff scheduling, vendor engagement, exception review.
 *
 * Mapping discipline:
 *   - manager.task.assign_worker          -> manager.task.assign_staff
 *   - manager.bid.review                  -> manager.application.review
 *   - manager.task.dispatch               -> manager.maintenance.dispatch
 *   - (new high-value)                    -> manager.contractor.engage
 *   - manager.inspection.generate_narrative is mapped to condition-report
 *
 * Every read defers to the loopback HTTP client. Every WRITE wraps the
 * body with `withChatProvenance(body, ctx)` and attaches `evidenceRefs`.
 *
 * Tier discipline:
 *   - cockpit reads — LOW, isWrite=false
 *   - assign_staff + maintenance dispatch — MEDIUM, isWrite=true
 *   - contractor engagement + escalation raise — HIGH, isWrite=true
 */

import { z } from 'zod';
import type { PersonaToolDescriptor } from './types.js';
import { withChatProvenance } from './provenance-injector.js';

const MANAGER: ReadonlyArray<'T3_module_manager'> = ['T3_module_manager'];

// ====================================================================
// 1. manager.task.assign_staff (was task.assign_worker)
// ====================================================================
const AssignStaffInput = z.object({
  taskId: z.string().min(1).max(120),
  staffActorId: z.string().min(1).max(120),
  evidenceRef: z.string().min(1).max(500),
});
const AssignStaffOutput = z.object({
  taskId: z.string(),
  staffActorId: z.string(),
  status: z.string(),
});
export const managerAssignStaffTool: PersonaToolDescriptor<
  typeof AssignStaffInput,
  typeof AssignStaffOutput
> = {
  id: 'manager.task.assign_staff',
  name: 'Manager — assign task to staff (en) / Meneja — kabidhi kazi kwa mtu (sw)',
  description:
    'Assign a maintenance / leasing / make-ready task to a maintenance ' +
    'staff member. WRITE — evidence attached.',
  personaSlugs: MANAGER,
  inputSchema: AssignStaffInput,
  outputSchema: AssignStaffOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        taskId: input.taskId,
        staffActorId: input.staffActorId,
        status: 'unavailable',
      };
    }
    const body = withChatProvenance(
      {
        staffActorId: input.staffActorId,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      taskId: string;
      staffActorId: string;
      status: string;
    }>(
      `/manager/tasks/${encodeURIComponent(input.taskId)}/assign`,
      body,
    );
  },
};

// ====================================================================
// 2. manager.incident.investigate (preserved)
// ====================================================================
const InvestigateInput = z.object({
  incidentId: z.string().min(1).max(120),
  findings: z.string().min(1).max(2000),
  evidenceRef: z.string().min(1).max(500),
});
const InvestigateOutput = z.object({
  incidentId: z.string(),
  investigationId: z.string(),
  status: z.string(),
});
export const managerIncidentInvestigateTool: PersonaToolDescriptor<
  typeof InvestigateInput,
  typeof InvestigateOutput
> = {
  id: 'manager.incident.investigate',
  name: 'Manager — investigate incident (en) / Meneja — chunguza tukio (sw)',
  description:
    'Open an investigation against a reported incident (vandalism, ' +
    'flood, unauthorised entry). Records findings + evidence.',
  personaSlugs: MANAGER,
  inputSchema: InvestigateInput,
  outputSchema: InvestigateOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        incidentId: input.incidentId,
        investigationId: '',
        status: 'unavailable',
      };
    }
    const body = withChatProvenance(
      {
        findings: input.findings,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      incidentId: string;
      investigationId: string;
      status: string;
    }>(
      `/manager/incidents/${encodeURIComponent(input.incidentId)}/investigate`,
      body,
    );
  },
};

// ====================================================================
// 3. manager.candidate.review (preserved)
// ====================================================================
const CandidateReviewInput = z.object({
  candidateId: z.string().min(1).max(120),
  outcome: z.enum(['advance', 'reject', 'hold']),
  notes: z.string().max(2000).optional(),
  evidenceRef: z.string().min(1).max(500),
});
const CandidateReviewOutput = z.object({
  candidateId: z.string(),
  outcome: z.string(),
  status: z.string(),
});
export const managerCandidateReviewTool: PersonaToolDescriptor<
  typeof CandidateReviewInput,
  typeof CandidateReviewOutput
> = {
  id: 'manager.candidate.review',
  name: 'Manager — review staff candidate (en) / Meneja — pitia mgombea (sw)',
  description: 'Decide on a property-staff candidate (advance/reject/hold).',
  personaSlugs: MANAGER,
  inputSchema: CandidateReviewInput,
  outputSchema: CandidateReviewOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        candidateId: input.candidateId,
        outcome: input.outcome,
        status: 'unavailable',
      };
    }
    const body = withChatProvenance(
      {
        outcome: input.outcome,
        ...(input.notes && { notes: input.notes }),
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      candidateId: string;
      outcome: string;
      status: string;
    }>(
      `/manager/candidates/${encodeURIComponent(input.candidateId)}/review`,
      body,
    );
  },
};

// ====================================================================
// 4. manager.application.review (was bid.review)
// ====================================================================
const ApplicationReviewInput = z.object({
  applicationId: z.string().min(1).max(120),
  outcome: z.enum(['approve', 'reject', 'request_more_info']),
  notes: z.string().max(2000).optional(),
  evidenceRef: z.string().min(1).max(500),
});
const ApplicationReviewOutput = z.object({
  applicationId: z.string(),
  outcome: z.string(),
  status: z.string(),
});
export const managerApplicationReviewTool: PersonaToolDescriptor<
  typeof ApplicationReviewInput,
  typeof ApplicationReviewOutput
> = {
  id: 'manager.application.review',
  name: 'Manager — review tenant application (en) / Meneja — pitia maombi ya mpangaji (sw)',
  description:
    'Decide on a tenant application (approve / reject / request more ' +
    'info). The downstream route attaches the decision to the lease ' +
    'pipeline + emits the applicant a notification.',
  personaSlugs: MANAGER,
  inputSchema: ApplicationReviewInput,
  outputSchema: ApplicationReviewOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        applicationId: input.applicationId,
        outcome: input.outcome,
        status: 'unavailable',
      };
    }
    const body = withChatProvenance(
      {
        outcome: input.outcome,
        ...(input.notes && { notes: input.notes }),
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      applicationId: string;
      outcome: string;
      status: string;
    }>(
      `/manager/applications/${encodeURIComponent(input.applicationId)}/review`,
      body,
    );
  },
};

// ====================================================================
// 5. manager.maintenance.dispatch (was task.dispatch)
// ====================================================================
const MaintenanceDispatchInput = z.object({
  workOrderId: z.string().min(1).max(120),
  staffActorId: z.string().min(1).max(120),
  dueAt: z.string().datetime().optional(),
  evidenceRef: z.string().min(1).max(500),
});
const MaintenanceDispatchOutput = z.object({
  workOrderId: z.string(),
  staffActorId: z.string(),
  status: z.string(),
});
export const managerMaintenanceDispatchTool: PersonaToolDescriptor<
  typeof MaintenanceDispatchInput,
  typeof MaintenanceDispatchOutput
> = {
  id: 'manager.maintenance.dispatch',
  name: 'Manager — dispatch maintenance (en) / Meneja — peleka kazi ya matengenezo (sw)',
  description:
    'Dispatch an open maintenance work order to a maintenance staff ' +
    'member with an optional due date.',
  personaSlugs: MANAGER,
  inputSchema: MaintenanceDispatchInput,
  outputSchema: MaintenanceDispatchOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        workOrderId: input.workOrderId,
        staffActorId: input.staffActorId,
        status: 'unavailable',
      };
    }
    const body = withChatProvenance(
      {
        staffActorId: input.staffActorId,
        ...(input.dueAt && { dueAt: input.dueAt }),
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      workOrderId: string;
      staffActorId: string;
      status: string;
    }>(
      `/manager/maintenance/${encodeURIComponent(input.workOrderId)}/dispatch`,
      body,
    );
  },
};

// ====================================================================
// 6. manager.contractor.engage (NEW — high-value for real estate)
// ====================================================================
const ContractorEngageInput = z.object({
  contractorId: z.string().min(1).max(120),
  workOrderId: z.string().min(1).max(120),
  quoteTzs: z.number().positive(),
  scheduledFor: z.string().datetime(),
  evidenceRef: z.string().min(1).max(500),
});
const ContractorEngageOutput = z.object({
  engagementId: z.string(),
  workOrderId: z.string(),
  status: z.string(),
});
export const managerContractorEngageTool: PersonaToolDescriptor<
  typeof ContractorEngageInput,
  typeof ContractorEngageOutput
> = {
  id: 'manager.contractor.engage',
  name: 'Manager — engage contractor (en) / Meneja — engage fundi (sw)',
  description:
    'Engage an external contractor (plumber, electrician, roofer) for ' +
    'a specific work order with a confirmed quote. HIGH stakes — the ' +
    'commitment flows to the ledger as an accrual.',
  personaSlugs: MANAGER,
  inputSchema: ContractorEngageInput,
  outputSchema: ContractorEngageOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        engagementId: '',
        workOrderId: input.workOrderId,
        status: 'unavailable',
      };
    }
    const body = withChatProvenance(
      {
        contractorId: input.contractorId,
        workOrderId: input.workOrderId,
        quoteTzs: input.quoteTzs,
        scheduledFor: input.scheduledFor,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      engagementId: string;
      workOrderId: string;
      status: string;
    }>('/manager/contractors/engage', body);
  },
};

// ====================================================================
// 7. manager.inspection.generate_narrative (mapped to condition report)
// ====================================================================
const NarrativeGenInput = z.object({
  inspectionId: z.string().min(1).max(120),
  templateKey: z.enum(['move_in', 'move_out', 'periodic']),
  evidenceRef: z.string().min(1).max(500),
});
const NarrativeGenOutput = z.object({
  narrativeId: z.string(),
  inspectionId: z.string(),
  status: z.string(),
});
export const managerInspectionNarrativeTool: PersonaToolDescriptor<
  typeof NarrativeGenInput,
  typeof NarrativeGenOutput
> = {
  id: 'manager.inspection.generate_narrative',
  name: 'Manager — generate condition-report narrative (en) / Meneja — tengeneza maelezo ya hali (sw)',
  description:
    'Produce a structured condition-report narrative for a move-in / ' +
    'move-out / periodic inspection. Output anchors the canonical PDF ' +
    'the owner signs.',
  personaSlugs: MANAGER,
  inputSchema: NarrativeGenInput,
  outputSchema: NarrativeGenOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        narrativeId: '',
        inspectionId: input.inspectionId,
        status: 'unavailable',
      };
    }
    const body = withChatProvenance(
      {
        templateKey: input.templateKey,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      narrativeId: string;
      inspectionId: string;
      status: string;
    }>(
      `/manager/inspections/${encodeURIComponent(input.inspectionId)}/narratives`,
      body,
    );
  },
};

// ====================================================================
// 8. manager.exception.list (preserved)
// ====================================================================
const ExceptionListInput = z.object({
  limit: z.number().int().positive().max(100).default(20),
});
const ExceptionListOutput = z.object({
  exceptions: z.array(
    z.object({
      exceptionId: z.string(),
      kind: z.string(),
      summary: z.string(),
      raisedAt: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
    }),
  ),
});
export const managerExceptionListTool: PersonaToolDescriptor<
  typeof ExceptionListInput,
  typeof ExceptionListOutput
> = {
  id: 'manager.exception.list',
  name: 'Manager — list exceptions (en) / Meneja — orodha ya makosa (sw)',
  description:
    'List unresolved exceptions: failed lease activations, late ' +
    'condition reports, missing photos, overdue tasks.',
  personaSlugs: MANAGER,
  inputSchema: ExceptionListInput,
  outputSchema: ExceptionListOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { exceptions: [] };
    return client.get<{
      exceptions: Array<{
        exceptionId: string;
        kind: string;
        summary: string;
        raisedAt: string;
        severity: 'low' | 'medium' | 'high';
      }>;
    }>('/manager/exceptions', { query: { limit: input.limit } });
  },
};

// ====================================================================
// 9. manager.approval.list (preserved)
// ====================================================================
const ApprovalListInput = z.object({
  limit: z.number().int().positive().max(100).default(20),
});
const ApprovalListOutput = z.object({
  approvals: z.array(
    z.object({
      approvalId: z.string(),
      kind: z.string(),
      summary: z.string(),
      requiredBy: z.string().nullable(),
    }),
  ),
});
export const managerApprovalListTool: PersonaToolDescriptor<
  typeof ApprovalListInput,
  typeof ApprovalListOutput
> = {
  id: 'manager.approval.list',
  name: 'Manager — list pending approvals (en) / Meneja — orodha ya idhini zinazosubiri (sw)',
  description: 'List approvals waiting on the manager.',
  personaSlugs: MANAGER,
  inputSchema: ApprovalListInput,
  outputSchema: ApprovalListOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { approvals: [] };
    return client.get<{
      approvals: Array<{
        approvalId: string;
        kind: string;
        summary: string;
        requiredBy: string | null;
      }>;
    }>('/manager/approvals', { query: { limit: input.limit } });
  },
};

// ====================================================================
// 10. manager.escalation.raise (preserved)
// ====================================================================
const EscalationInput = z.object({
  topic: z.string().min(1).max(240),
  toOwner: z.boolean().default(true),
  summary: z.string().min(1).max(2000),
  evidenceRef: z.string().min(1).max(500),
});
const EscalationOutput = z.object({
  escalationId: z.string(),
  status: z.string(),
});
export const managerEscalationRaiseTool: PersonaToolDescriptor<
  typeof EscalationInput,
  typeof EscalationOutput
> = {
  id: 'manager.escalation.raise',
  name: 'Manager — raise escalation (en) / Meneja — toa taarifa ya ngazi ya juu (sw)',
  description:
    'Raise an escalation to the owner (or BossNyumba admin) for a topic ' +
    'requiring strategic judgement. HIGH stakes — evidence required.',
  personaSlugs: MANAGER,
  inputSchema: EscalationInput,
  outputSchema: EscalationOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { escalationId: '', status: 'unavailable' };
    const body = withChatProvenance(
      {
        topic: input.topic,
        toOwner: input.toOwner,
        summary: input.summary,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ escalationId: string; status: string }>(
      '/manager/escalations',
      body,
    );
  },
};

// ====================================================================
// 11-12. manager.shift.{schedule,view} (preserved)
// ====================================================================
const ShiftScheduleInput = z.object({
  staffActorId: z.string().min(1).max(120),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  propertyId: z.string().min(1).max(120),
  evidenceRef: z.string().min(1).max(500),
});
const ShiftScheduleOutput = z.object({
  shiftId: z.string(),
  status: z.string(),
});
export const managerShiftScheduleTool: PersonaToolDescriptor<
  typeof ShiftScheduleInput,
  typeof ShiftScheduleOutput
> = {
  id: 'manager.shift.schedule',
  name: 'Manager — schedule shift (en) / Meneja — panga zamu (sw)',
  description:
    'Schedule a property-staff shift (caretaker night cover, weekend ' +
    'rotation).',
  personaSlugs: MANAGER,
  inputSchema: ShiftScheduleInput,
  outputSchema: ShiftScheduleOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { shiftId: '', status: 'unavailable' };
    const body = withChatProvenance(
      {
        staffActorId: input.staffActorId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        propertyId: input.propertyId,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ shiftId: string; status: string }>(
      '/manager/shifts',
      body,
    );
  },
};

const ShiftViewInput = z.object({
  fromDate: z.string(),
  toDate: z.string(),
});
const ShiftViewOutput = z.object({
  shifts: z.array(
    z.object({
      shiftId: z.string(),
      staffActorId: z.string(),
      startsAt: z.string(),
      endsAt: z.string(),
      propertyId: z.string(),
    }),
  ),
});
export const managerShiftViewTool: PersonaToolDescriptor<
  typeof ShiftViewInput,
  typeof ShiftViewOutput
> = {
  id: 'manager.shift.view',
  name: 'Manager — view shifts (en) / Meneja — angalia zamu (sw)',
  description: 'List shifts scheduled in a date window.',
  personaSlugs: MANAGER,
  inputSchema: ShiftViewInput,
  outputSchema: ShiftViewOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { shifts: [] };
    return client.get<{
      shifts: Array<{
        shiftId: string;
        staffActorId: string;
        startsAt: string;
        endsAt: string;
        propertyId: string;
      }>;
    }>('/manager/shifts', {
      query: { from: input.fromDate, to: input.toDate },
    });
  },
};

// ====================================================================
// 13. manager.decisions.affecting_me (preserved)
// ====================================================================
const DecisionsAffectingInput = z.object({
  limit: z.number().int().positive().max(50).default(10),
});
const DecisionsAffectingOutput = z.object({
  decisions: z.array(
    z.object({
      decisionId: z.string(),
      summary: z.string(),
      recordedAt: z.string(),
      directive: z.string(),
    }),
  ),
});
export const managerDecisionsAffectingTool: PersonaToolDescriptor<
  typeof DecisionsAffectingInput,
  typeof DecisionsAffectingOutput
> = {
  id: 'manager.decisions.affecting_me',
  name: 'Manager — decisions affecting me (en) / Meneja — maamuzi yanayonihusu (sw)',
  description:
    'Recently-recorded owner decisions that change what the manager has ' +
    'to do (new pricing tier, new vendor allowlist, new policy).',
  personaSlugs: MANAGER,
  inputSchema: DecisionsAffectingInput,
  outputSchema: DecisionsAffectingOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { decisions: [] };
    return client.get<{
      decisions: Array<{
        decisionId: string;
        summary: string;
        recordedAt: string;
        directive: string;
      }>;
    }>('/manager/decisions/affecting-me', {
      query: { limit: input.limit },
    });
  },
};

// ====================================================================
// 14. manager.work_order.list_open (read)
// ====================================================================
const WoListInput = z.object({
  limit: z.number().int().positive().max(200).default(50),
});
const WoListOutput = z.object({
  workOrders: z.array(
    z.object({
      workOrderId: z.string(),
      unitId: z.string(),
      title: z.string(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']),
      ageDays: z.number().int(),
      assignedTo: z.string().nullable(),
    }),
  ),
});
export const managerWorkOrderListOpenTool: PersonaToolDescriptor<
  typeof WoListInput,
  typeof WoListOutput
> = {
  id: 'manager.work_order.list_open',
  name: 'Manager — list open work orders (en) / Meneja — orodha ya kazi zilizo wazi (sw)',
  description: 'List open maintenance work orders across the manager scope.',
  personaSlugs: MANAGER,
  inputSchema: WoListInput,
  outputSchema: WoListOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { workOrders: [] };
    return client.get<{
      workOrders: Array<{
        workOrderId: string;
        unitId: string;
        title: string;
        priority: 'low' | 'medium' | 'high' | 'urgent';
        ageDays: number;
        assignedTo: string | null;
      }>;
    }>('/manager/work-orders/open', { query: { limit: input.limit } });
  },
};

// ====================================================================
// 15. manager.vacancy.list (read)
// ====================================================================
const VacancyListInput = z.object({
  limit: z.number().int().positive().max(100).default(30),
});
const VacancyListOutput = z.object({
  vacancies: z.array(
    z.object({
      unitId: z.string(),
      address: z.string(),
      vacantSince: z.string(),
      askingRentTzs: z.number(),
    }),
  ),
});
export const managerVacancyListTool: PersonaToolDescriptor<
  typeof VacancyListInput,
  typeof VacancyListOutput
> = {
  id: 'manager.vacancy.list',
  name: 'Manager — list vacancies (en) / Meneja — orodha ya nyumba wazi (sw)',
  description: 'List vacant units across the manager scope.',
  personaSlugs: MANAGER,
  inputSchema: VacancyListInput,
  outputSchema: VacancyListOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { vacancies: [] };
    return client.get<{
      vacancies: Array<{
        unitId: string;
        address: string;
        vacantSince: string;
        askingRentTzs: number;
      }>;
    }>('/manager/vacancies', { query: { limit: input.limit } });
  },
};

// ====================================================================
// 16. manager.showing.schedule (WRITE)
// ====================================================================
const ShowingScheduleInput = z.object({
  unitId: z.string().min(1).max(120),
  applicantId: z.string().min(1).max(120),
  scheduledFor: z.string().datetime(),
  evidenceRef: z.string().min(1).max(500),
});
const ShowingScheduleOutput = z.object({
  showingId: z.string(),
  status: z.string(),
});
export const managerShowingScheduleTool: PersonaToolDescriptor<
  typeof ShowingScheduleInput,
  typeof ShowingScheduleOutput
> = {
  id: 'manager.showing.schedule',
  name: 'Manager — schedule showing (en) / Meneja — panga ziara (sw)',
  description: 'Schedule a property showing for an applicant.',
  personaSlugs: MANAGER,
  inputSchema: ShowingScheduleInput,
  outputSchema: ShowingScheduleOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { showingId: '', status: 'unavailable' };
    const body = withChatProvenance(
      {
        unitId: input.unitId,
        applicantId: input.applicantId,
        scheduledFor: input.scheduledFor,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ showingId: string; status: string }>(
      '/manager/showings',
      body,
    );
  },
};

// ====================================================================
// 17. manager.lease.draft (WRITE)
// ====================================================================
const LeaseDraftInput = z.object({
  unitId: z.string().min(1).max(120),
  applicantId: z.string().min(1).max(120),
  monthlyRentTzs: z.number().positive(),
  startsOn: z.string(),
  endsOn: z.string(),
  evidenceRef: z.string().min(1).max(500),
});
const LeaseDraftOutput = z.object({
  draftLeaseId: z.string(),
  status: z.string(),
});
export const managerLeaseDraftTool: PersonaToolDescriptor<
  typeof LeaseDraftInput,
  typeof LeaseDraftOutput
> = {
  id: 'manager.lease.draft',
  name: 'Manager — draft lease (en) / Meneja — andika rasimu ya mkataba (sw)',
  description:
    'Draft a new lease for owner approval. Returns the draft lease id; ' +
    'the owner activates via owner.lease.start_renewal-style routes.',
  personaSlugs: MANAGER,
  inputSchema: LeaseDraftInput,
  outputSchema: LeaseDraftOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { draftLeaseId: '', status: 'unavailable' };
    const body = withChatProvenance(
      {
        unitId: input.unitId,
        applicantId: input.applicantId,
        monthlyRentTzs: input.monthlyRentTzs,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ draftLeaseId: string; status: string }>(
      '/manager/leases/draft',
      body,
    );
  },
};

// ====================================================================
// 18. manager.tenant.notice (WRITE)
// ====================================================================
const TenantNoticeInput = z.object({
  tenantId: z.string().min(1).max(120),
  noticeKind: z.enum([
    'rent_due',
    'late_fee',
    'maintenance_window',
    'lease_violation',
    'inspection_scheduled',
  ]),
  summary: z.string().min(1).max(2000),
  evidenceRef: z.string().min(1).max(500),
});
const TenantNoticeOutput = z.object({
  noticeId: z.string(),
  status: z.string(),
});
export const managerTenantNoticeTool: PersonaToolDescriptor<
  typeof TenantNoticeInput,
  typeof TenantNoticeOutput
> = {
  id: 'manager.tenant.notice',
  name: 'Manager — send tenant notice (en) / Meneja — tuma ilani kwa mpangaji (sw)',
  description:
    'Send a structured tenant notice (rent due, late fee, maintenance, ' +
    'lease violation, scheduled inspection). Auditable.',
  personaSlugs: MANAGER,
  inputSchema: TenantNoticeInput,
  outputSchema: TenantNoticeOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { noticeId: '', status: 'unavailable' };
    const body = withChatProvenance(
      {
        noticeKind: input.noticeKind,
        summary: input.summary,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ noticeId: string; status: string }>(
      `/manager/tenants/${encodeURIComponent(input.tenantId)}/notices`,
      body,
    );
  },
};

// ====================================================================
// 19. manager.vendor.list (read)
// ====================================================================
const VendorListInput = z.object({
  trade: z
    .enum(['plumbing', 'electrical', 'roofing', 'hvac', 'cleaning', 'pest'])
    .optional(),
});
const VendorListOutput = z.object({
  vendors: z.array(
    z.object({
      vendorId: z.string(),
      name: z.string(),
      trade: z.string(),
      rating: z.number(),
    }),
  ),
});
export const managerVendorListTool: PersonaToolDescriptor<
  typeof VendorListInput,
  typeof VendorListOutput
> = {
  id: 'manager.vendor.list',
  name: 'Manager — list vendors (en) / Meneja — orodha ya wauzaji (sw)',
  description: 'List approved vendors, optionally filtered by trade.',
  personaSlugs: MANAGER,
  inputSchema: VendorListInput,
  outputSchema: VendorListOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { vendors: [] };
    return client.get<{
      vendors: Array<{
        vendorId: string;
        name: string;
        trade: string;
        rating: number;
      }>;
    }>('/manager/vendors', {
      query: { ...(input.trade && { trade: input.trade }) },
    });
  },
};

// ====================================================================
// 20. manager.daily_report.submit (WRITE)
// ====================================================================
const DailyReportInput = z.object({
  forDate: z.string(),
  summary: z.string().min(1).max(4000),
  evidenceRef: z.string().min(1).max(500),
});
const DailyReportOutput = z.object({
  reportId: z.string(),
  status: z.string(),
});
export const managerDailyReportTool: PersonaToolDescriptor<
  typeof DailyReportInput,
  typeof DailyReportOutput
> = {
  id: 'manager.daily_report.submit',
  name: 'Manager — submit daily report (en) / Meneja — wasilisha ripoti ya kila siku (sw)',
  description:
    'Submit the day-end manager report (move-ins, move-outs, incidents, ' +
    'collections, maintenance completed).',
  personaSlugs: MANAGER,
  inputSchema: DailyReportInput,
  outputSchema: DailyReportOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { reportId: '', status: 'unavailable' };
    const body = withChatProvenance(
      {
        forDate: input.forDate,
        summary: input.summary,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ reportId: string; status: string }>(
      '/manager/daily-reports',
      body,
    );
  },
};

// ====================================================================
// 21. manager.move_out.schedule (WRITE)
// ====================================================================
const MoveOutInput = z.object({
  leaseId: z.string().min(1).max(120),
  moveOutDate: z.string(),
  reason: z.enum(['expiry', 'tenant_terminate', 'owner_terminate']),
  evidenceRef: z.string().min(1).max(500),
});
const MoveOutOutput = z.object({
  moveOutId: z.string(),
  status: z.string(),
});
export const managerMoveOutScheduleTool: PersonaToolDescriptor<
  typeof MoveOutInput,
  typeof MoveOutOutput
> = {
  id: 'manager.move_out.schedule',
  name: 'Manager — schedule move-out (en) / Meneja — panga kuondoka (sw)',
  description: 'Schedule a tenant move-out with the reason code.',
  personaSlugs: MANAGER,
  inputSchema: MoveOutInput,
  outputSchema: MoveOutOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { moveOutId: '', status: 'unavailable' };
    const body = withChatProvenance(
      {
        leaseId: input.leaseId,
        moveOutDate: input.moveOutDate,
        reason: input.reason,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ moveOutId: string; status: string }>(
      '/manager/move-outs',
      body,
    );
  },
};

// ====================================================================
// 22. manager.security_deposit.assess (WRITE — HIGH)
// ====================================================================
const SecDepositAssessInput = z.object({
  moveOutId: z.string().min(1).max(120),
  deductionsTzs: z.number().nonnegative(),
  refundTzs: z.number().nonnegative(),
  rationale: z.string().min(1).max(4000),
  evidenceRef: z.string().min(1).max(500),
});
const SecDepositAssessOutput = z.object({
  assessmentId: z.string(),
  status: z.string(),
});
export const managerSecurityDepositAssessTool: PersonaToolDescriptor<
  typeof SecDepositAssessInput,
  typeof SecDepositAssessOutput
> = {
  id: 'manager.security_deposit.assess',
  name: 'Manager — assess security deposit (en) / Meneja — tathmini dhamana (sw)',
  description:
    'Assess the security-deposit deductions and refund for a move-out. ' +
    'HIGH stakes — anchors the financial settlement and is hash-chained.',
  personaSlugs: MANAGER,
  inputSchema: SecDepositAssessInput,
  outputSchema: SecDepositAssessOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { assessmentId: '', status: 'unavailable' };
    const body = withChatProvenance(
      {
        moveOutId: input.moveOutId,
        deductionsTzs: input.deductionsTzs,
        refundTzs: input.refundTzs,
        rationale: input.rationale,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ assessmentId: string; status: string }>(
      '/manager/security-deposits/assess',
      body,
    );
  },
};

// ====================================================================
// 23. manager.make_ready.checklist (read)
// ====================================================================
const MakeReadyInput = z.object({
  unitId: z.string().min(1).max(120),
});
const MakeReadyOutput = z.object({
  unitId: z.string(),
  items: z.array(
    z.object({
      itemKey: z.string(),
      label: z.string(),
      done: z.boolean(),
    }),
  ),
});
export const managerMakeReadyChecklistTool: PersonaToolDescriptor<
  typeof MakeReadyInput,
  typeof MakeReadyOutput
> = {
  id: 'manager.make_ready.checklist',
  name: 'Manager — make-ready checklist (en) / Meneja — orodha ya maandalizi ya unit (sw)',
  description: 'Show the make-ready checklist for a unit pending occupancy.',
  personaSlugs: MANAGER,
  inputSchema: MakeReadyInput,
  outputSchema: MakeReadyOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { unitId: input.unitId, items: [] };
    return client.get<{
      unitId: string;
      items: Array<{
        itemKey: string;
        label: string;
        done: boolean;
      }>;
    }>(`/manager/units/${encodeURIComponent(input.unitId)}/make-ready`);
  },
};

// ====================================================================
// 24. manager.handoff.note (WRITE)
// ====================================================================
const HandoffNoteInput = z.object({
  summary: z.string().min(1).max(4000),
  evidenceRef: z.string().min(1).max(500),
});
const HandoffNoteOutput = z.object({
  handoffNoteId: z.string(),
  status: z.string(),
});
export const managerHandoffNoteTool: PersonaToolDescriptor<
  typeof HandoffNoteInput,
  typeof HandoffNoteOutput
> = {
  id: 'manager.handoff.note',
  name: 'Manager — handoff note (en) / Meneja — barua ya makabidhiano (sw)',
  description:
    'Record a handoff note for the next shift / for the owner returning ' +
    'from leave.',
  personaSlugs: MANAGER,
  inputSchema: HandoffNoteInput,
  outputSchema: HandoffNoteOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { handoffNoteId: '', status: 'unavailable' };
    const body = withChatProvenance(
      {
        summary: input.summary,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ handoffNoteId: string; status: string }>(
      '/manager/handoff-notes',
      body,
    );
  },
};

// ====================================================================
// 25. manager.notification.list (read)
// ====================================================================
const NotifListInput = z.object({
  limit: z.number().int().positive().max(100).default(20),
});
const NotifListOutput = z.object({
  notifications: z.array(
    z.object({
      notificationId: z.string(),
      kind: z.string(),
      summary: z.string(),
      createdAt: z.string(),
      read: z.boolean(),
    }),
  ),
});
export const managerNotificationListTool: PersonaToolDescriptor<
  typeof NotifListInput,
  typeof NotifListOutput
> = {
  id: 'manager.notification.list',
  name: 'Manager — list notifications (en) / Meneja — orodha ya ujumbe (sw)',
  description: 'List manager notifications.',
  personaSlugs: MANAGER,
  inputSchema: NotifListInput,
  outputSchema: NotifListOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { notifications: [] };
    return client.get<{
      notifications: Array<{
        notificationId: string;
        kind: string;
        summary: string;
        createdAt: string;
        read: boolean;
      }>;
    }>('/manager/notifications', { query: { limit: input.limit } });
  },
};

// ====================================================================
// Catalog export
// ====================================================================
export const MANAGER_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  managerAssignStaffTool,
  managerIncidentInvestigateTool,
  managerCandidateReviewTool,
  managerApplicationReviewTool,
  managerMaintenanceDispatchTool,
  managerContractorEngageTool,
  managerInspectionNarrativeTool,
  managerExceptionListTool,
  managerApprovalListTool,
  managerEscalationRaiseTool,
  managerShiftScheduleTool,
  managerShiftViewTool,
  managerDecisionsAffectingTool,
  managerWorkOrderListOpenTool,
  managerVacancyListTool,
  managerShowingScheduleTool,
  managerLeaseDraftTool,
  managerTenantNoticeTool,
  managerVendorListTool,
  managerDailyReportTool,
  managerMoveOutScheduleTool,
  managerSecurityDepositAssessTool,
  managerMakeReadyChecklistTool,
  managerHandoffNoteTool,
  managerNotificationListTool,
] as unknown as readonly PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>[]);
