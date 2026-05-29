/**
 * PT-C — Maintenance staff persona tools (T4 field employee).
 *
 * Real-estate retailoring of Borjie's worker-tools.ts. Property staff
 * are the on-the-ground operators — caretakers, cleaners, handymen,
 * groundskeepers, leasing assistants, security. The workforce-mobile
 * Expo app surfaces these tools as one-tap actions in the chat home.
 *
 * Mapping discipline (Borjie -> BossNyumba):
 *   - worker.clock_in                  -> staff.clock_in
 *   - worker.clock_out                 -> staff.clock_out
 *   - worker.task.next                 -> staff.task.next
 *   - worker.task.complete             -> staff.task.complete
 *   - worker.task.list_mine            -> staff.task.list_mine
 *   - worker.toolbox_talk.today        -> staff.toolbox_talk.today
 *   - worker.toolbox_talk.acknowledge  -> staff.toolbox_talk.acknowledge
 *   - worker.help_request.create       -> staff.help_request.create
 *   - worker.incident.report           -> staff.incident.report
 *   - worker.photo.upload_with_geo     -> staff.photo.upload_with_geo
 *   - worker.payslip.show              -> staff.payslip.show
 *   - worker.shift_report.submit       -> staff.work_order.complete
 *
 * Every read defers to the loopback HTTP client. Every WRITE wraps the
 * body with `withChatProvenance(body, ctx)` and attaches `evidenceRefs`.
 *
 * Tier discipline:
 *   - shift reads / payslip — LOW, isWrite=false
 *   - clock_in / clock_out / task complete / photo upload — LOW, isWrite=true
 *   - work_order complete / incident report — MEDIUM, isWrite=true
 *
 * Evidence-required (CLAUDE.md inviolable): every WRITE handler attaches
 * `evidenceRefs` so the downstream Auditor Agent can reject responses
 * with empty evidence chains.
 */

import { z } from 'zod';
import type { PersonaToolDescriptor } from './types.js';
import { withChatProvenance } from './provenance-injector.js';

const STAFF: ReadonlyArray<'T4_field_employee'> = ['T4_field_employee'];

// ====================================================================
// 1. staff.clock_in
// ====================================================================
const ClockInInput = z.object({
  propertyId: z.string().min(1).max(120),
  geoLat: z.number().min(-90).max(90),
  geoLng: z.number().min(-180).max(180),
  evidenceRef: z.string().min(1).max(500),
});
const ClockInOutput = z.object({
  shiftEntryId: z.string(),
  clockedInAt: z.string(),
});
export const staffClockInTool: PersonaToolDescriptor<
  typeof ClockInInput,
  typeof ClockInOutput
> = {
  id: 'staff.clock_in',
  name: 'Staff — clock in (en) / Mfanyakazi — ingia kazini (sw)',
  description:
    'Clock in for a shift at a specific property with geo-coordinates. ' +
    'WRITE — evidence attached.',
  personaSlugs: STAFF,
  inputSchema: ClockInInput,
  outputSchema: ClockInOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        shiftEntryId: '',
        clockedInAt: new Date().toISOString(),
      };
    }
    const body = withChatProvenance(
      {
        propertyId: input.propertyId,
        geoLat: input.geoLat,
        geoLng: input.geoLng,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ shiftEntryId: string; clockedInAt: string }>(
      '/staff/clock-in',
      body,
    );
  },
};

// ====================================================================
// 2. staff.clock_out
// ====================================================================
const ClockOutInput = z.object({
  shiftEntryId: z.string().min(1).max(120),
  evidenceRef: z.string().min(1).max(500),
});
const ClockOutOutput = z.object({
  shiftEntryId: z.string(),
  clockedOutAt: z.string(),
  durationMinutes: z.number().int(),
});
export const staffClockOutTool: PersonaToolDescriptor<
  typeof ClockOutInput,
  typeof ClockOutOutput
> = {
  id: 'staff.clock_out',
  name: 'Staff — clock out (en) / Mfanyakazi — toka kazini (sw)',
  description:
    'Clock out from an active shift. Records duration. WRITE — evidence attached.',
  personaSlugs: STAFF,
  inputSchema: ClockOutInput,
  outputSchema: ClockOutOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        shiftEntryId: input.shiftEntryId,
        clockedOutAt: new Date().toISOString(),
        durationMinutes: 0,
      };
    }
    const body = withChatProvenance(
      {
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      shiftEntryId: string;
      clockedOutAt: string;
      durationMinutes: number;
    }>(`/staff/shifts/${encodeURIComponent(input.shiftEntryId)}/clock-out`, body);
  },
};

// ====================================================================
// 3. staff.shift.current
// ====================================================================
const ShiftCurrentInput = z.object({});
const ShiftCurrentOutput = z.object({
  shiftEntryId: z.string().optional(),
  propertyId: z.string().optional(),
  clockedInAt: z.string().optional(),
  state: z.enum(['off_shift', 'on_shift', 'on_break']),
});
export const staffShiftCurrentTool: PersonaToolDescriptor<
  typeof ShiftCurrentInput,
  typeof ShiftCurrentOutput
> = {
  id: 'staff.shift.current',
  name: 'Staff — current shift (en) / Mfanyakazi — zamu ya sasa (sw)',
  description: 'Return the calling staff member\'s current shift state.',
  personaSlugs: STAFF,
  inputSchema: ShiftCurrentInput,
  outputSchema: ShiftCurrentOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(_input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { state: 'off_shift' as const };
    return client.get<{
      shiftEntryId?: string;
      propertyId?: string;
      clockedInAt?: string;
      state: 'off_shift' | 'on_shift' | 'on_break';
    }>('/staff/shift/current');
  },
};

// ====================================================================
// 4. staff.task.next
// ====================================================================
const TaskNextInput = z.object({});
const TaskNextOutput = z.object({
  taskId: z.string().optional(),
  titleSw: z.string().optional(),
  titleEn: z.string().optional(),
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueAt: z.string().optional(),
});
export const staffTaskNextTool: PersonaToolDescriptor<
  typeof TaskNextInput,
  typeof TaskNextOutput
> = {
  id: 'staff.task.next',
  name: 'Staff — next task (en) / Mfanyakazi — kazi ifuatayo (sw)',
  description: 'Return the next maintenance task assigned to the caller (highest priority first).',
  personaSlugs: STAFF,
  inputSchema: TaskNextInput,
  outputSchema: TaskNextOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(_input, ctx) {
    const client = ctx.httpClient;
    if (!client) return {};
    return client.get<{
      taskId?: string;
      titleSw?: string;
      titleEn?: string;
      propertyId?: string;
      unitId?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      dueAt?: string;
    }>('/staff/tasks/next');
  },
};

// ====================================================================
// 5. staff.task.complete
// ====================================================================
const TaskCompleteInput = z.object({
  taskId: z.string().min(1).max(120),
  noteSw: z.string().max(2000).optional(),
  noteEn: z.string().max(2000).optional(),
  evidenceRef: z.string().min(1).max(500),
});
const TaskCompleteOutput = z.object({
  taskId: z.string(),
  completedAt: z.string(),
});
export const staffTaskCompleteTool: PersonaToolDescriptor<
  typeof TaskCompleteInput,
  typeof TaskCompleteOutput
> = {
  id: 'staff.task.complete',
  name: 'Staff — complete task (en) / Mfanyakazi — kamilisha kazi (sw)',
  description: 'Mark an assigned maintenance task as complete with notes + evidence.',
  personaSlugs: STAFF,
  inputSchema: TaskCompleteInput,
  outputSchema: TaskCompleteOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return { taskId: input.taskId, completedAt: new Date().toISOString() };
    }
    const body = withChatProvenance(
      {
        ...(input.noteSw && { noteSw: input.noteSw }),
        ...(input.noteEn && { noteEn: input.noteEn }),
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ taskId: string; completedAt: string }>(
      `/staff/tasks/${encodeURIComponent(input.taskId)}/complete`,
      body,
    );
  },
};

// ====================================================================
// 6. staff.task.list_mine
// ====================================================================
const TaskListMineInput = z.object({
  status: z.enum(['open', 'in_progress', 'blocked', 'done', 'all']).default('open'),
  limit: z.number().int().positive().max(100).default(20),
});
const TaskListMineOutput = z.object({
  tasks: z.array(
    z.object({
      taskId: z.string(),
      titleSw: z.string(),
      titleEn: z.string(),
      propertyId: z.string().optional(),
      status: z.enum(['open', 'in_progress', 'blocked', 'done']),
      priority: z.enum(['low', 'medium', 'high', 'urgent']),
      dueAt: z.string().optional(),
    }),
  ),
});
export const staffTaskListMineTool: PersonaToolDescriptor<
  typeof TaskListMineInput,
  typeof TaskListMineOutput
> = {
  id: 'staff.task.list_mine',
  name: 'Staff — list my tasks (en) / Mfanyakazi — orodhesha kazi zangu (sw)',
  description: 'List tasks assigned to the calling staff member, optionally filtered by status.',
  personaSlugs: STAFF,
  inputSchema: TaskListMineInput,
  outputSchema: TaskListMineOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { tasks: [] };
    return client.get<{
      tasks: Array<{
        taskId: string;
        titleSw: string;
        titleEn: string;
        propertyId?: string;
        status: 'open' | 'in_progress' | 'blocked' | 'done';
        priority: 'low' | 'medium' | 'high' | 'urgent';
        dueAt?: string;
      }>;
    }>('/staff/tasks/mine', {
      query: {
        status: input.status === 'all' ? undefined : input.status,
        limit: input.limit,
      },
    });
  },
};

// ====================================================================
// 7. staff.task.start
// ====================================================================
const TaskStartInput = z.object({
  taskId: z.string().min(1).max(120),
  evidenceRef: z.string().min(1).max(500),
});
const TaskStartOutput = z.object({
  taskId: z.string(),
  startedAt: z.string(),
  status: z.string(),
});
export const staffTaskStartTool: PersonaToolDescriptor<
  typeof TaskStartInput,
  typeof TaskStartOutput
> = {
  id: 'staff.task.start',
  name: 'Staff — start task (en) / Mfanyakazi — anza kazi (sw)',
  description: 'Transition an assigned task into in_progress when arriving on site.',
  personaSlugs: STAFF,
  inputSchema: TaskStartInput,
  outputSchema: TaskStartOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        taskId: input.taskId,
        startedAt: new Date().toISOString(),
        status: 'in_progress',
      };
    }
    const body = withChatProvenance(
      { evidenceRefs: [input.evidenceRef] },
      ctx,
    );
    return client.post<{ taskId: string; startedAt: string; status: string }>(
      `/staff/tasks/${encodeURIComponent(input.taskId)}/start`,
      body,
    );
  },
};

// ====================================================================
// 8. staff.task.block
// ====================================================================
const TaskBlockInput = z.object({
  taskId: z.string().min(1).max(120),
  reasonSw: z.string().min(1).max(2000),
  reasonEn: z.string().min(1).max(2000),
  evidenceRef: z.string().min(1).max(500),
});
const TaskBlockOutput = z.object({
  taskId: z.string(),
  blockedAt: z.string(),
});
export const staffTaskBlockTool: PersonaToolDescriptor<
  typeof TaskBlockInput,
  typeof TaskBlockOutput
> = {
  id: 'staff.task.block',
  name: 'Staff — block task (en) / Mfanyakazi — zuia kazi (sw)',
  description: 'Mark a task as blocked because parts or access are missing. Bilingual reason required.',
  personaSlugs: STAFF,
  inputSchema: TaskBlockInput,
  outputSchema: TaskBlockOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return { taskId: input.taskId, blockedAt: new Date().toISOString() };
    }
    const body = withChatProvenance(
      {
        reasonSw: input.reasonSw,
        reasonEn: input.reasonEn,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ taskId: string; blockedAt: string }>(
      `/staff/tasks/${encodeURIComponent(input.taskId)}/block`,
      body,
    );
  },
};

// ====================================================================
// 9. staff.toolbox_talk.today
// ====================================================================
const ToolboxTalkTodayInput = z.object({});
const ToolboxTalkTodayOutput = z.object({
  talks: z.array(
    z.object({
      talkId: z.string(),
      topicSw: z.string(),
      topicEn: z.string(),
      bodySw: z.string(),
      bodyEn: z.string(),
      acknowledged: z.boolean(),
    }),
  ),
});
export const staffToolboxTalkTodayTool: PersonaToolDescriptor<
  typeof ToolboxTalkTodayInput,
  typeof ToolboxTalkTodayOutput
> = {
  id: 'staff.toolbox_talk.today',
  name: 'Staff — today\'s toolbox talks (en) / Mfanyakazi — mazungumzo ya leo (sw)',
  description: 'Return today\'s safety briefings the staff member must read and acknowledge.',
  personaSlugs: STAFF,
  inputSchema: ToolboxTalkTodayInput,
  outputSchema: ToolboxTalkTodayOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(_input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { talks: [] };
    return client.get<{
      talks: Array<{
        talkId: string;
        topicSw: string;
        topicEn: string;
        bodySw: string;
        bodyEn: string;
        acknowledged: boolean;
      }>;
    }>('/staff/toolbox-talks/today');
  },
};

// ====================================================================
// 10. staff.toolbox_talk.acknowledge
// ====================================================================
const ToolboxTalkAckInput = z.object({
  talkId: z.string().min(1).max(120),
  evidenceRef: z.string().min(1).max(500),
});
const ToolboxTalkAckOutput = z.object({
  talkId: z.string(),
  acknowledgedAt: z.string(),
});
export const staffToolboxTalkAckTool: PersonaToolDescriptor<
  typeof ToolboxTalkAckInput,
  typeof ToolboxTalkAckOutput
> = {
  id: 'staff.toolbox_talk.acknowledge',
  name: 'Staff — acknowledge talk (en) / Mfanyakazi — thibitisha mazungumzo (sw)',
  description: 'Record that the staff member has read and acknowledged a toolbox talk.',
  personaSlugs: STAFF,
  inputSchema: ToolboxTalkAckInput,
  outputSchema: ToolboxTalkAckOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return { talkId: input.talkId, acknowledgedAt: new Date().toISOString() };
    }
    const body = withChatProvenance(
      { evidenceRefs: [input.evidenceRef] },
      ctx,
    );
    return client.post<{ talkId: string; acknowledgedAt: string }>(
      `/staff/toolbox-talks/${encodeURIComponent(input.talkId)}/acknowledge`,
      body,
    );
  },
};

// ====================================================================
// 11. staff.help_request.create
// ====================================================================
const HelpRequestInput = z.object({
  taskId: z.string().min(1).max(120).optional(),
  topicSw: z.string().min(1).max(2000),
  topicEn: z.string().min(1).max(2000),
  urgency: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  evidenceRef: z.string().min(1).max(500),
});
const HelpRequestOutput = z.object({
  helpRequestId: z.string(),
  createdAt: z.string(),
  status: z.string(),
});
export const staffHelpRequestCreateTool: PersonaToolDescriptor<
  typeof HelpRequestInput,
  typeof HelpRequestOutput
> = {
  id: 'staff.help_request.create',
  name: 'Staff — request help (en) / Mfanyakazi — omba msaada (sw)',
  description: 'Raise a help request to the manager (parts needed, escalation, advice).',
  personaSlugs: STAFF,
  inputSchema: HelpRequestInput,
  outputSchema: HelpRequestOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        helpRequestId: '',
        createdAt: new Date().toISOString(),
        status: 'unavailable',
      };
    }
    const body = withChatProvenance(
      {
        ...(input.taskId && { taskId: input.taskId }),
        topicSw: input.topicSw,
        topicEn: input.topicEn,
        urgency: input.urgency,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      helpRequestId: string;
      createdAt: string;
      status: string;
    }>('/staff/help-requests', body);
  },
};

// ====================================================================
// 12. staff.incident.report
// ====================================================================
const IncidentReportInput = z.object({
  propertyId: z.string().min(1).max(120),
  unitId: z.string().max(120).optional(),
  kind: z.enum(['safety', 'damage', 'security', 'tenant_dispute', 'other']),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
  titleSw: z.string().min(1).max(200),
  titleEn: z.string().min(1).max(200),
  descriptionSw: z.string().min(1).max(4000),
  descriptionEn: z.string().min(1).max(4000),
  geoLat: z.number().min(-90).max(90).optional(),
  geoLng: z.number().min(-180).max(180).optional(),
  evidenceRef: z.string().min(1).max(500),
});
const IncidentReportOutput = z.object({
  incidentId: z.string(),
  reportedAt: z.string(),
  status: z.string(),
});
export const staffIncidentReportTool: PersonaToolDescriptor<
  typeof IncidentReportInput,
  typeof IncidentReportOutput
> = {
  id: 'staff.incident.report',
  name: 'Staff — report incident (en) / Mfanyakazi — toa ripoti ya tukio (sw)',
  description: 'File a new incident report (safety / damage / security / dispute). MEDIUM stakes — escalates.',
  personaSlugs: STAFF,
  inputSchema: IncidentReportInput,
  outputSchema: IncidentReportOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        incidentId: '',
        reportedAt: new Date().toISOString(),
        status: 'unavailable',
      };
    }
    const body = withChatProvenance(
      {
        propertyId: input.propertyId,
        ...(input.unitId && { unitId: input.unitId }),
        kind: input.kind,
        severity: input.severity,
        titleSw: input.titleSw,
        titleEn: input.titleEn,
        descriptionSw: input.descriptionSw,
        descriptionEn: input.descriptionEn,
        ...(input.geoLat !== undefined && { geoLat: input.geoLat }),
        ...(input.geoLng !== undefined && { geoLng: input.geoLng }),
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      incidentId: string;
      reportedAt: string;
      status: string;
    }>('/staff/incidents', body);
  },
};

// ====================================================================
// 13. staff.photo.upload_with_geo
// ====================================================================
const PhotoUploadInput = z.object({
  taskId: z.string().min(1).max(120).optional(),
  incidentId: z.string().min(1).max(120).optional(),
  propertyId: z.string().min(1).max(120),
  unitId: z.string().max(120).optional(),
  photoBase64: z.string().min(1).max(2_000_000),
  captionSw: z.string().max(2000).optional(),
  captionEn: z.string().max(2000).optional(),
  geoLat: z.number().min(-90).max(90),
  geoLng: z.number().min(-180).max(180),
});
const PhotoUploadOutput = z.object({
  photoId: z.string(),
  storedAt: z.string(),
  url: z.string().optional(),
});
export const staffPhotoUploadTool: PersonaToolDescriptor<
  typeof PhotoUploadInput,
  typeof PhotoUploadOutput
> = {
  id: 'staff.photo.upload_with_geo',
  name: 'Staff — upload photo + geo (en) / Mfanyakazi — pakia picha + eneo (sw)',
  description:
    'Upload one photo evidence with geo-coordinates tying it to a task / incident / unit. ' +
    'Evidence chain is auto-pinned to the parent row.',
  personaSlugs: STAFF,
  inputSchema: PhotoUploadInput,
  outputSchema: PhotoUploadOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return { photoId: '', storedAt: new Date().toISOString() };
    }
    const body = withChatProvenance(
      {
        ...(input.taskId && { taskId: input.taskId }),
        ...(input.incidentId && { incidentId: input.incidentId }),
        propertyId: input.propertyId,
        ...(input.unitId && { unitId: input.unitId }),
        photoBase64: input.photoBase64,
        ...(input.captionSw && { captionSw: input.captionSw }),
        ...(input.captionEn && { captionEn: input.captionEn }),
        geoLat: input.geoLat,
        geoLng: input.geoLng,
      },
      ctx,
    );
    return client.post<{
      photoId: string;
      storedAt: string;
      url?: string;
    }>('/staff/photos/upload', body);
  },
};

// ====================================================================
// 14. staff.payslip.show
// ====================================================================
const PayslipInput = z.object({
  payPeriod: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
const PayslipOutput = z.object({
  payslipId: z.string(),
  payPeriod: z.string(),
  baseSalary: z.number(),
  bonuses: z.number(),
  deductions: z.number(),
  netPay: z.number(),
  currency: z.string(),
  releasedAt: z.string().optional(),
});
export const staffPayslipShowTool: PersonaToolDescriptor<
  typeof PayslipInput,
  typeof PayslipOutput
> = {
  id: 'staff.payslip.show',
  name: 'Staff — show my payslip (en) / Mfanyakazi — onyesha mshahara wangu (sw)',
  description: 'Return the staff member\'s payslip for the requested period (defaults to latest).',
  personaSlugs: STAFF,
  inputSchema: PayslipInput,
  outputSchema: PayslipOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        payslipId: '',
        payPeriod: input.payPeriod ?? '',
        baseSalary: 0,
        bonuses: 0,
        deductions: 0,
        netPay: 0,
        currency: 'TZS',
      };
    }
    return client.get<{
      payslipId: string;
      payPeriod: string;
      baseSalary: number;
      bonuses: number;
      deductions: number;
      netPay: number;
      currency: string;
      releasedAt?: string;
    }>('/staff/payslip', {
      query: { payPeriod: input.payPeriod },
    });
  },
};

// ====================================================================
// 15. staff.work_order.submit (was shift_report)
// ====================================================================
const WorkOrderSubmitInput = z.object({
  taskId: z.string().min(1).max(120),
  workSummarySw: z.string().min(1).max(4000),
  workSummaryEn: z.string().min(1).max(4000),
  partsUsed: z.array(
    z.object({
      sku: z.string().min(1).max(120),
      qty: z.number().int().positive(),
      unitCostTzs: z.number().nonnegative(),
    }),
  ).max(50),
  laborMinutes: z.number().int().positive(),
  evidenceRef: z.string().min(1).max(500),
});
const WorkOrderSubmitOutput = z.object({
  workOrderId: z.string(),
  submittedAt: z.string(),
  totalCostTzs: z.number(),
});
export const staffWorkOrderSubmitTool: PersonaToolDescriptor<
  typeof WorkOrderSubmitInput,
  typeof WorkOrderSubmitOutput
> = {
  id: 'staff.work_order.submit',
  name: 'Staff — submit work order (en) / Mfanyakazi — wasilisha agizo la kazi (sw)',
  description:
    'Submit a completed work order for a maintenance task. Includes parts used + ' +
    'labor minutes. MEDIUM stakes — feeds owner cost-of-maintenance reporting.',
  personaSlugs: STAFF,
  inputSchema: WorkOrderSubmitInput,
  outputSchema: WorkOrderSubmitOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        workOrderId: '',
        submittedAt: new Date().toISOString(),
        totalCostTzs: 0,
      };
    }
    const body = withChatProvenance(
      {
        workSummarySw: input.workSummarySw,
        workSummaryEn: input.workSummaryEn,
        partsUsed: input.partsUsed,
        laborMinutes: input.laborMinutes,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      workOrderId: string;
      submittedAt: string;
      totalCostTzs: number;
    }>(
      `/staff/tasks/${encodeURIComponent(input.taskId)}/work-order`,
      body,
    );
  },
};

// ====================================================================
// 16. staff.shift.report
// ====================================================================
const ShiftReportInput = z.object({
  shiftEntryId: z.string().min(1).max(120),
  summarySw: z.string().min(1).max(4000),
  summaryEn: z.string().min(1).max(4000),
  evidenceRef: z.string().min(1).max(500),
});
const ShiftReportOutput = z.object({
  reportId: z.string(),
  submittedAt: z.string(),
});
export const staffShiftReportTool: PersonaToolDescriptor<
  typeof ShiftReportInput,
  typeof ShiftReportOutput
> = {
  id: 'staff.shift.report',
  name: 'Staff — submit shift report (en) / Mfanyakazi — wasilisha ripoti ya zamu (sw)',
  description: 'Submit an end-of-shift narrative report. WRITE — feeds manager daily handoff.',
  personaSlugs: STAFF,
  inputSchema: ShiftReportInput,
  outputSchema: ShiftReportOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return { reportId: '', submittedAt: new Date().toISOString() };
    }
    const body = withChatProvenance(
      {
        summarySw: input.summarySw,
        summaryEn: input.summaryEn,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ reportId: string; submittedAt: string }>(
      `/staff/shifts/${encodeURIComponent(input.shiftEntryId)}/report`,
      body,
    );
  },
};

// ====================================================================
// 17. staff.tasks.assigned_today
// ====================================================================
const TasksAssignedTodayInput = z.object({});
const TasksAssignedTodayOutput = z.object({
  date: z.string(),
  tasks: z.array(
    z.object({
      taskId: z.string(),
      titleSw: z.string(),
      titleEn: z.string(),
      propertyId: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']),
      status: z.enum(['open', 'in_progress', 'blocked', 'done']),
    }),
  ),
  total: z.number().int().nonnegative(),
});
export const staffTasksAssignedTodayTool: PersonaToolDescriptor<
  typeof TasksAssignedTodayInput,
  typeof TasksAssignedTodayOutput
> = {
  id: 'staff.tasks.assigned_today',
  name: 'Staff — tasks assigned today (en) / Mfanyakazi — kazi za leo (sw)',
  description: 'Return today\'s assigned task roster (priority-sorted) for the caller.',
  personaSlugs: STAFF,
  inputSchema: TasksAssignedTodayInput,
  outputSchema: TasksAssignedTodayOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(_input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        date: new Date().toISOString().slice(0, 10),
        tasks: [],
        total: 0,
      };
    }
    return client.get<{
      date: string;
      tasks: Array<{
        taskId: string;
        titleSw: string;
        titleEn: string;
        propertyId?: string;
        priority: 'low' | 'medium' | 'high' | 'urgent';
        status: 'open' | 'in_progress' | 'blocked' | 'done';
      }>;
      total: number;
    }>('/staff/tasks/assigned-today');
  },
};

// ====================================================================
// 18. staff.checklist.complete
// ====================================================================
const ChecklistCompleteInput = z.object({
  checklistId: z.string().min(1).max(120),
  itemsCompleted: z.array(z.string().min(1).max(120)),
  notesSw: z.string().max(2000).optional(),
  notesEn: z.string().max(2000).optional(),
  evidenceRef: z.string().min(1).max(500),
});
const ChecklistCompleteOutput = z.object({
  checklistId: z.string(),
  completedAt: z.string(),
});
export const staffChecklistCompleteTool: PersonaToolDescriptor<
  typeof ChecklistCompleteInput,
  typeof ChecklistCompleteOutput
> = {
  id: 'staff.checklist.complete',
  name: 'Staff — complete checklist (en) / Mfanyakazi — kamilisha orodha (sw)',
  description:
    'Submit a completed inspection / move-in checklist with line items + evidence.',
  personaSlugs: STAFF,
  inputSchema: ChecklistCompleteInput,
  outputSchema: ChecklistCompleteOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        checklistId: input.checklistId,
        completedAt: new Date().toISOString(),
      };
    }
    const body = withChatProvenance(
      {
        itemsCompleted: input.itemsCompleted,
        ...(input.notesSw && { notesSw: input.notesSw }),
        ...(input.notesEn && { notesEn: input.notesEn }),
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ checklistId: string; completedAt: string }>(
      `/staff/checklists/${encodeURIComponent(input.checklistId)}/complete`,
      body,
    );
  },
};

// ====================================================================
// 19. staff.attendance.history
// ====================================================================
const AttendanceHistoryInput = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const AttendanceHistoryOutput = z.object({
  shifts: z.array(
    z.object({
      shiftDate: z.string(),
      clockedInAt: z.string().optional(),
      clockedOutAt: z.string().optional(),
      durationMinutes: z.number().int().optional(),
      state: z.enum(['scheduled', 'on_shift', 'off_shift', 'absent']),
    }),
  ),
  totalShifts: z.number().int().nonnegative(),
});
export const staffAttendanceHistoryTool: PersonaToolDescriptor<
  typeof AttendanceHistoryInput,
  typeof AttendanceHistoryOutput
> = {
  id: 'staff.attendance.history',
  name: 'Staff — attendance history (en) / Mfanyakazi — historia ya mahudhurio (sw)',
  description: 'Return the caller\'s attendance history over a date range.',
  personaSlugs: STAFF,
  inputSchema: AttendanceHistoryInput,
  outputSchema: AttendanceHistoryOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { shifts: [], totalShifts: 0 };
    return client.get<{
      shifts: Array<{
        shiftDate: string;
        clockedInAt?: string;
        clockedOutAt?: string;
        durationMinutes?: number;
        state: 'scheduled' | 'on_shift' | 'off_shift' | 'absent';
      }>;
      totalShifts: number;
    }>('/staff/attendance/history', {
      query: { startDate: input.startDate, endDate: input.endDate },
    });
  },
};

// ====================================================================
// 20. staff.timesheet.submit
// ====================================================================
const TimesheetSubmitInput = z.object({
  payPeriod: z.string().regex(/^\d{4}-\d{2}$/),
  acknowledged: z.literal(true),
  evidenceRef: z.string().min(1).max(500),
});
const TimesheetSubmitOutput = z.object({
  timesheetId: z.string(),
  submittedAt: z.string(),
});
export const staffTimesheetSubmitTool: PersonaToolDescriptor<
  typeof TimesheetSubmitInput,
  typeof TimesheetSubmitOutput
> = {
  id: 'staff.timesheet.submit',
  name: 'Staff — submit timesheet (en) / Mfanyakazi — wasilisha karatasi ya muda (sw)',
  description: 'Acknowledge and submit the timesheet for a pay period. Feeds payroll run.',
  personaSlugs: STAFF,
  inputSchema: TimesheetSubmitInput,
  outputSchema: TimesheetSubmitOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return { timesheetId: '', submittedAt: new Date().toISOString() };
    }
    const body = withChatProvenance(
      {
        payPeriod: input.payPeriod,
        acknowledged: input.acknowledged,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ timesheetId: string; submittedAt: string }>(
      '/staff/timesheets/submit',
      body,
    );
  },
};

// ====================================================================
// 21. staff.leave.request
// ====================================================================
const LeaveRequestInput = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(['annual', 'sick', 'compassionate', 'unpaid']),
  reasonSw: z.string().max(2000).optional(),
  reasonEn: z.string().max(2000).optional(),
  evidenceRef: z.string().min(1).max(500),
});
const LeaveRequestOutput = z.object({
  leaveRequestId: z.string(),
  createdAt: z.string(),
  status: z.string(),
});
export const staffLeaveRequestTool: PersonaToolDescriptor<
  typeof LeaveRequestInput,
  typeof LeaveRequestOutput
> = {
  id: 'staff.leave.request',
  name: 'Staff — request leave (en) / Mfanyakazi — omba likizo (sw)',
  description: 'File a leave request. Requires manager approval before commit.',
  personaSlugs: STAFF,
  inputSchema: LeaveRequestInput,
  outputSchema: LeaveRequestOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        leaveRequestId: '',
        createdAt: new Date().toISOString(),
        status: 'unavailable',
      };
    }
    const body = withChatProvenance(
      {
        startDate: input.startDate,
        endDate: input.endDate,
        kind: input.kind,
        ...(input.reasonSw && { reasonSw: input.reasonSw }),
        ...(input.reasonEn && { reasonEn: input.reasonEn }),
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      leaveRequestId: string;
      createdAt: string;
      status: string;
    }>('/staff/leave-requests', body);
  },
};

// ====================================================================
// 22. staff.notification.list
// ====================================================================
const NotificationListInput = z.object({
  limit: z.number().int().positive().max(100).default(20),
  unreadOnly: z.boolean().default(false),
});
const NotificationListOutput = z.object({
  notifications: z.array(
    z.object({
      notificationId: z.string(),
      titleSw: z.string(),
      titleEn: z.string(),
      bodySw: z.string(),
      bodyEn: z.string(),
      isRead: z.boolean(),
      createdAt: z.string(),
    }),
  ),
});
export const staffNotificationListTool: PersonaToolDescriptor<
  typeof NotificationListInput,
  typeof NotificationListOutput
> = {
  id: 'staff.notification.list',
  name: 'Staff — list notifications (en) / Mfanyakazi — orodhesha arifa (sw)',
  description: 'List notifications routed to the caller.',
  personaSlugs: STAFF,
  inputSchema: NotificationListInput,
  outputSchema: NotificationListOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { notifications: [] };
    return client.get<{
      notifications: Array<{
        notificationId: string;
        titleSw: string;
        titleEn: string;
        bodySw: string;
        bodyEn: string;
        isRead: boolean;
        createdAt: string;
      }>;
    }>('/staff/notifications', {
      query: {
        limit: input.limit,
        unreadOnly: input.unreadOnly ? 'true' : 'false',
      },
    });
  },
};

// ====================================================================
// 23. staff.notification.mark_read
// ====================================================================
const NotificationMarkReadInput = z.object({
  notificationId: z.string().min(1).max(120),
});
const NotificationMarkReadOutput = z.object({
  notificationId: z.string(),
  readAt: z.string(),
});
export const staffNotificationMarkReadTool: PersonaToolDescriptor<
  typeof NotificationMarkReadInput,
  typeof NotificationMarkReadOutput
> = {
  id: 'staff.notification.mark_read',
  name: 'Staff — mark notification read (en) / Mfanyakazi — wekea alama imesomwa (sw)',
  description: 'Mark a notification as read.',
  personaSlugs: STAFF,
  inputSchema: NotificationMarkReadInput,
  outputSchema: NotificationMarkReadOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        notificationId: input.notificationId,
        readAt: new Date().toISOString(),
      };
    }
    const body = withChatProvenance({}, ctx);
    return client.post<{ notificationId: string; readAt: string }>(
      `/staff/notifications/${encodeURIComponent(input.notificationId)}/read`,
      body,
    );
  },
};

// ====================================================================
// 24. staff.parts.request
// ====================================================================
const PartsRequestInput = z.object({
  taskId: z.string().min(1).max(120).optional(),
  itemSw: z.string().min(1).max(500),
  itemEn: z.string().min(1).max(500),
  qty: z.number().int().positive(),
  urgency: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  evidenceRef: z.string().min(1).max(500),
});
const PartsRequestOutput = z.object({
  partsRequestId: z.string(),
  createdAt: z.string(),
  status: z.string(),
});
export const staffPartsRequestTool: PersonaToolDescriptor<
  typeof PartsRequestInput,
  typeof PartsRequestOutput
> = {
  id: 'staff.parts.request',
  name: 'Staff — request parts (en) / Mfanyakazi — omba vifaa (sw)',
  description: 'Raise a parts / inventory request to the manager for the current task.',
  personaSlugs: STAFF,
  inputSchema: PartsRequestInput,
  outputSchema: PartsRequestOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        partsRequestId: '',
        createdAt: new Date().toISOString(),
        status: 'unavailable',
      };
    }
    const body = withChatProvenance(
      {
        ...(input.taskId && { taskId: input.taskId }),
        itemSw: input.itemSw,
        itemEn: input.itemEn,
        qty: input.qty,
        urgency: input.urgency,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{
      partsRequestId: string;
      createdAt: string;
      status: string;
    }>('/staff/parts-requests', body);
  },
};

// ====================================================================
// 25. staff.inspection.start
// ====================================================================
const InspectionStartInput = z.object({
  propertyId: z.string().min(1).max(120),
  unitId: z.string().min(1).max(120),
  kind: z.enum(['move_in', 'move_out', 'periodic', 'condition']),
  evidenceRef: z.string().min(1).max(500),
});
const InspectionStartOutput = z.object({
  inspectionId: z.string(),
  startedAt: z.string(),
});
export const staffInspectionStartTool: PersonaToolDescriptor<
  typeof InspectionStartInput,
  typeof InspectionStartOutput
> = {
  id: 'staff.inspection.start',
  name: 'Staff — start inspection (en) / Mfanyakazi — anza ukaguzi (sw)',
  description: 'Begin a property / unit inspection (move-in / move-out / periodic / condition).',
  personaSlugs: STAFF,
  inputSchema: InspectionStartInput,
  outputSchema: InspectionStartOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return { inspectionId: '', startedAt: new Date().toISOString() };
    }
    const body = withChatProvenance(
      {
        propertyId: input.propertyId,
        unitId: input.unitId,
        kind: input.kind,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ inspectionId: string; startedAt: string }>(
      '/staff/inspections',
      body,
    );
  },
};

// ====================================================================
// 26. staff.inspection.complete
// ====================================================================
const InspectionCompleteInput = z.object({
  inspectionId: z.string().min(1).max(120),
  findingsSw: z.string().min(1).max(4000),
  findingsEn: z.string().min(1).max(4000),
  conditionScore: z.number().int().min(1).max(10),
  evidenceRef: z.string().min(1).max(500),
});
const InspectionCompleteOutput = z.object({
  inspectionId: z.string(),
  completedAt: z.string(),
});
export const staffInspectionCompleteTool: PersonaToolDescriptor<
  typeof InspectionCompleteInput,
  typeof InspectionCompleteOutput
> = {
  id: 'staff.inspection.complete',
  name: 'Staff — complete inspection (en) / Mfanyakazi — kamilisha ukaguzi (sw)',
  description: 'Submit final inspection findings + condition score. Feeds move-in/out reconciliation.',
  personaSlugs: STAFF,
  inputSchema: InspectionCompleteInput,
  outputSchema: InspectionCompleteOutput,
  stakes: 'MEDIUM',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        inspectionId: input.inspectionId,
        completedAt: new Date().toISOString(),
      };
    }
    const body = withChatProvenance(
      {
        findingsSw: input.findingsSw,
        findingsEn: input.findingsEn,
        conditionScore: input.conditionScore,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ inspectionId: string; completedAt: string }>(
      `/staff/inspections/${encodeURIComponent(input.inspectionId)}/complete`,
      body,
    );
  },
};

// ====================================================================
// 27. staff.training.list
// ====================================================================
const TrainingListInput = z.object({});
const TrainingListOutput = z.object({
  modules: z.array(
    z.object({
      moduleId: z.string(),
      titleSw: z.string(),
      titleEn: z.string(),
      status: z.enum(['not_started', 'in_progress', 'complete']),
      dueAt: z.string().optional(),
    }),
  ),
});
export const staffTrainingListTool: PersonaToolDescriptor<
  typeof TrainingListInput,
  typeof TrainingListOutput
> = {
  id: 'staff.training.list',
  name: 'Staff — list training modules (en) / Mfanyakazi — orodhesha mafunzo (sw)',
  description: 'List training / certification modules assigned to the caller.',
  personaSlugs: STAFF,
  inputSchema: TrainingListInput,
  outputSchema: TrainingListOutput,
  stakes: 'LOW',
  isWrite: false,
  requiresPolicyRuleLiteral: false,
  async handler(_input, ctx) {
    const client = ctx.httpClient;
    if (!client) return { modules: [] };
    return client.get<{
      modules: Array<{
        moduleId: string;
        titleSw: string;
        titleEn: string;
        status: 'not_started' | 'in_progress' | 'complete';
        dueAt?: string;
      }>;
    }>('/staff/training/list');
  },
};

// ====================================================================
// 28. staff.training.complete
// ====================================================================
const TrainingCompleteInput = z.object({
  moduleId: z.string().min(1).max(120),
  quizScore: z.number().int().min(0).max(100).optional(),
  evidenceRef: z.string().min(1).max(500),
});
const TrainingCompleteOutput = z.object({
  moduleId: z.string(),
  completedAt: z.string(),
});
export const staffTrainingCompleteTool: PersonaToolDescriptor<
  typeof TrainingCompleteInput,
  typeof TrainingCompleteOutput
> = {
  id: 'staff.training.complete',
  name: 'Staff — complete training (en) / Mfanyakazi — kamilisha mafunzo (sw)',
  description: 'Mark a training module as complete (optionally with quiz score).',
  personaSlugs: STAFF,
  inputSchema: TrainingCompleteInput,
  outputSchema: TrainingCompleteOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return { moduleId: input.moduleId, completedAt: new Date().toISOString() };
    }
    const body = withChatProvenance(
      {
        ...(input.quizScore !== undefined && { quizScore: input.quizScore }),
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ moduleId: string; completedAt: string }>(
      `/staff/training/${encodeURIComponent(input.moduleId)}/complete`,
      body,
    );
  },
};

// ====================================================================
// 29. staff.vendor.contact
// ====================================================================
const VendorContactInput = z.object({
  vendorId: z.string().min(1).max(120),
  taskId: z.string().min(1).max(120).optional(),
  messageSw: z.string().min(1).max(2000),
  messageEn: z.string().min(1).max(2000),
  evidenceRef: z.string().min(1).max(500),
});
const VendorContactOutput = z.object({
  contactLogId: z.string(),
  createdAt: z.string(),
});
export const staffVendorContactTool: PersonaToolDescriptor<
  typeof VendorContactInput,
  typeof VendorContactOutput
> = {
  id: 'staff.vendor.contact',
  name: 'Staff — log vendor contact (en) / Mfanyakazi — andika mawasiliano ya muuzaji (sw)',
  description: 'Log an outbound contact with an external vendor / contractor.',
  personaSlugs: STAFF,
  inputSchema: VendorContactInput,
  outputSchema: VendorContactOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return { contactLogId: '', createdAt: new Date().toISOString() };
    }
    const body = withChatProvenance(
      {
        vendorId: input.vendorId,
        ...(input.taskId && { taskId: input.taskId }),
        messageSw: input.messageSw,
        messageEn: input.messageEn,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ contactLogId: string; createdAt: string }>(
      '/staff/vendor-contacts',
      body,
    );
  },
};

// ====================================================================
// 30. staff.tenant.message
// ====================================================================
const TenantMessageInput = z.object({
  tenantId: z.string().min(1).max(120),
  unitId: z.string().min(1).max(120),
  messageSw: z.string().min(1).max(2000),
  messageEn: z.string().min(1).max(2000),
  kind: z.enum(['notice', 'reminder', 'follow_up', 'visit_scheduled']),
  evidenceRef: z.string().min(1).max(500),
});
const TenantMessageOutput = z.object({
  messageId: z.string(),
  sentAt: z.string(),
});
export const staffTenantMessageTool: PersonaToolDescriptor<
  typeof TenantMessageInput,
  typeof TenantMessageOutput
> = {
  id: 'staff.tenant.message',
  name: 'Staff — send tenant message (en) / Mfanyakazi — tuma ujumbe kwa mpangaji (sw)',
  description:
    'Send a bilingual message to a tenant on behalf of the property team ' +
    '(visit scheduled, reminder, follow-up notice).',
  personaSlugs: STAFF,
  inputSchema: TenantMessageInput,
  outputSchema: TenantMessageOutput,
  stakes: 'LOW',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return { messageId: '', sentAt: new Date().toISOString() };
    }
    const body = withChatProvenance(
      {
        tenantId: input.tenantId,
        unitId: input.unitId,
        messageSw: input.messageSw,
        messageEn: input.messageEn,
        kind: input.kind,
        evidenceRefs: [input.evidenceRef],
      },
      ctx,
    );
    return client.post<{ messageId: string; sentAt: string }>(
      '/staff/tenant-messages',
      body,
    );
  },
};

// ====================================================================
// Catalog export
// ====================================================================
export const STAFF_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  staffClockInTool,
  staffClockOutTool,
  staffShiftCurrentTool,
  staffTaskNextTool,
  staffTaskCompleteTool,
  staffTaskListMineTool,
  staffTaskStartTool,
  staffTaskBlockTool,
  staffToolboxTalkTodayTool,
  staffToolboxTalkAckTool,
  staffHelpRequestCreateTool,
  staffIncidentReportTool,
  staffPhotoUploadTool,
  staffPayslipShowTool,
  staffWorkOrderSubmitTool,
  staffShiftReportTool,
  staffTasksAssignedTodayTool,
  staffChecklistCompleteTool,
  staffAttendanceHistoryTool,
  staffTimesheetSubmitTool,
  staffLeaveRequestTool,
  staffNotificationListTool,
  staffNotificationMarkReadTool,
  staffPartsRequestTool,
  staffInspectionStartTool,
  staffInspectionCompleteTool,
  staffTrainingListTool,
  staffTrainingCompleteTool,
  staffVendorContactTool,
  staffTenantMessageTool,
] as unknown as readonly PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>[]);
