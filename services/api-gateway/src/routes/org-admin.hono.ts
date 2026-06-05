// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union: multiple
// c.json({...}, status) branches widen the return type and the TypedResponse
// overload rejects the union (hono-dev/hono#3891). Same pragma as the other
// .hono routers in this directory (cases.hono.ts, cooperatives.hono.ts).
/**
 * /api/v1/org-admin — org / team-management write surface (migration 0305).
 *
 * The owner / admin tells Mr. Mwikila "add Asha as the new caretaker",
 * "Asha's quarterly KPI is 12 units leased", "schedule the move-out
 * inspection for unit 4B by Friday", "escalate the smoke-alarm fault as a
 * maintenance incident", or pastes a staff roster CSV. Each becomes a real
 * row through this surface.
 *
 * Routes (all tenant-scoped via JWT + RLS; owner/admin role only):
 *   POST  /staff                 create a staff member
 *   POST  /staff/kpis            assign a KPI to a staff member
 *   POST  /tasks                 schedule an org task
 *   POST  /escalations           raise an escalation
 *   POST  /staff/bulk-csv        bulk-ingest a staff roster CSV
 *
 * The chat-as-OS brain reads / writes via the `staff.*` brain tools
 * (org-admin-tools.ts), which loopback-dispatch to these routes so the
 * SAME auth + RLS + observability guards apply as a browser request.
 *
 * Honest-degrade (CLAUDE.md hard rule): when the database client is not
 * configured the route returns 503 SERVICE_UNAVAILABLE rather than
 * fabricating a row.
 *
 * Multi-currency (CLAUDE.md hard rule): a money-denominated KPI uses
 * `metricUnit:'currency'`; no jurisdiction currency is hard-coded here.
 *
 * Ported from LitFin's iter-27..31 org-management tools and retargeted
 * lending → real estate (employee → staff_member).
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { withSecurityEvents } from '@bossnyumba/observability';
import {
  OrgTeamRepository,
  type ProvenanceLike,
  type RepoFailure,
} from '../composition/org-team-repository.js';
import { parseStaffCsv } from '../composition/org-team-csv.js';

// ── role gate ────────────────────────────────────────────────────────────
// VOCAB / tier-gate (task spec): owner / admin only. Mirrors hr.hono.ts
// `requireManage`. The brain-tool layer also gates on persona
// (T1_owner_strategist / T2_admin_strategist) — this is defense in depth.
const WRITE_ROLES = new Set([
  'OWNER',
  'TENANT_ADMIN',
  'PLATFORM_ADMIN',
  'ADMIN',
]);

// ── shared zod fragments ─────────────────────────────────────────────────

const ProvenanceSchema = z
  .object({
    via: z.string(),
    actorId: z.string().nullable().optional(),
    sessionId: z.string().nullable().optional(),
    turnId: z.string().nullable().optional(),
    requestedAt: z.string().optional(),
  })
  .optional();

const CreateStaffSchema = z.object({
  fullName: z.string().min(1).max(200),
  role: z.string().min(1).max(120),
  hireDate: z.string().optional(),
  managerId: z.string().uuid().optional(),
  contact: z
    .object({
      whatsapp: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  notes: z.string().max(2000).optional(),
  allowDuplicate: z.boolean().optional(),
  provenance: ProvenanceSchema,
});

const AssignKpiSchema = z.object({
  staffMemberId: z.string().uuid().optional(),
  staffMemberName: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  metricUnit: z
    .enum(['count', 'currency', 'percent', 'days', 'hours', 'ratio'])
    .optional(),
  targetValue: z.number().finite().positive(),
  period: z.enum(['week', 'month', 'quarter', 'half', 'year']).optional(),
  periodEnd: z.string().optional(),
  provenance: ProvenanceSchema,
});

const ScheduleTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  assignedToStaffId: z.string().uuid().optional(),
  assignedToStaffName: z.string().min(1).max(200).optional(),
  dueAt: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  provenance: ProvenanceSchema,
});

const EscalateSchema = z.object({
  title: z.string().min(1).max(200),
  reason: z.string().min(1).max(4000),
  category: z
    .enum([
      'compliance_breach',
      'payment_default',
      'maintenance_incident',
      'other',
    ])
    .optional(),
  severity: z.enum(['low', 'normal', 'high', 'critical']).optional(),
  escalatedToStaffId: z.string().uuid().optional(),
  escalatedToStaffName: z.string().min(1).max(200).optional(),
  relatedTaskId: z.string().uuid().optional(),
  relatedSubject: z.string().max(200).optional(),
  provenance: ProvenanceSchema,
});

const BulkCsvSchema = z.object({
  csv: z.string().min(1),
  allowDuplicates: z.boolean().optional(),
  provenance: ProvenanceSchema,
});

// ── helpers ──────────────────────────────────────────────────────────────

function notConfigured(c) {
  return c.json(
    {
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'OrgTeamRepository not configured — DATABASE_URL unset',
      },
    },
    503,
  );
}

function forbidden(c) {
  return c.json(
    {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'org-admin write requires the owner or admin role',
      },
    },
    403,
  );
}

/** Map a repository failure code to an HTTP status. */
function statusForFailure(failure: RepoFailure): number {
  switch (failure.code) {
    case 'NOT_FOUND':
      return 404;
    case 'DUPLICATE':
    case 'AMBIGUOUS':
      return 409;
    case 'INVALID_INPUT':
      return 422;
    default:
      return 500;
  }
}

function provenanceFrom(body, fallbackActor: string): ProvenanceLike {
  const p = body?.provenance;
  return {
    via: typeof p?.via === 'string' ? p.via : 'api',
    actorId: typeof p?.actorId === 'string' ? p.actorId : fallbackActor,
    sessionId: typeof p?.sessionId === 'string' ? p.sessionId : null,
    turnId: typeof p?.turnId === 'string' ? p.turnId : null,
    requestedAt:
      typeof p?.requestedAt === 'string'
        ? p.requestedAt
        : new Date().toISOString(),
  };
}

function sanitizeContact(
  contact: { whatsapp?: string; phone?: string; email?: string } | undefined,
): Record<string, unknown> {
  const PHONE_RE = /^\+?[0-9]{8,15}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const out: Record<string, unknown> = {};
  if (!contact) return out;
  const w = contact.whatsapp?.trim();
  if (w && PHONE_RE.test(w)) out.whatsapp = w;
  const p = contact.phone?.trim();
  if (p && PHONE_RE.test(p)) out.phone = p;
  const e = contact.email?.trim();
  if (e && EMAIL_RE.test(e)) out.email = e;
  return out;
}

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

// Owner/admin role gate on every write in this router.
app.use('*', async (c, next) => {
  const auth = c.get('auth') as { role?: string } | undefined;
  if (!auth || !WRITE_ROLES.has(String(auth.role))) return forbidden(c);
  await next();
});

// ── POST /staff — create a staff member ──────────────────────────────────

app.post(
  '/staff',
  zValidator('json', CreateStaffSchema),
  withSecurityEvents(
    {
      action: 'org-admin.staff.create',
      resource: 'staff_member',
      severity: 'info',
    },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return notConfigured(c);
      const body = c.req.valid('json');

      let hireDateIso = new Date().toISOString();
      if (body.hireDate && body.hireDate.trim().length > 0) {
        const ts = Date.parse(body.hireDate);
        if (Number.isNaN(ts)) {
          return c.json(
            {
              success: false,
              error: {
                code: 'INVALID_INPUT',
                message: `hireDate must be ISO 8601 (got "${body.hireDate}").`,
              },
            },
            422,
          );
        }
        hireDateIso = new Date(ts).toISOString();
      }

      const metadata = sanitizeContact(body.contact);
      if (body.notes && body.notes.trim().length > 0) {
        metadata.notes = body.notes.trim().slice(0, 2_000);
      }

      const repo = new OrgTeamRepository(db);
      const result = await repo.createStaffMember(
        auth.tenantId,
        {
          fullName: body.fullName.trim(),
          role: body.role.trim(),
          hireDateIso,
          managerId: body.managerId ?? null,
          metadata,
          allowDuplicate: body.allowDuplicate === true,
        },
        auth.userId,
        provenanceFrom(body, auth.userId),
      );
      if (!result.ok) {
        return c.json(
          { success: false, error: { code: result.code, message: result.message } },
          statusForFailure(result),
        );
      }
      return c.json({ success: true, data: result.staff }, 201);
    },
  ),
);

// ── POST /staff/kpis — assign a KPI ──────────────────────────────────────

app.post(
  '/staff/kpis',
  zValidator('json', AssignKpiSchema),
  withSecurityEvents(
    {
      action: 'org-admin.staff.assign_kpi',
      resource: 'staff_kpi',
      severity: 'info',
    },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return notConfigured(c);
      const body = c.req.valid('json');

      let periodEndIso: string | null = null;
      if (body.periodEnd && body.periodEnd.trim().length > 0) {
        const ts = Date.parse(body.periodEnd);
        if (Number.isNaN(ts)) {
          return c.json(
            {
              success: false,
              error: {
                code: 'INVALID_INPUT',
                message: `periodEnd must be ISO 8601 (got "${body.periodEnd}").`,
              },
            },
            422,
          );
        }
        periodEndIso = new Date(ts).toISOString();
      }

      const repo = new OrgTeamRepository(db);
      const resolved = await repo.resolveStaff(
        auth.tenantId,
        { id: body.staffMemberId ?? null, name: body.staffMemberName ?? null },
        'staff member',
      );
      if (!resolved.ok) {
        return c.json(
          {
            success: false,
            error: { code: resolved.code, message: resolved.message },
          },
          statusForFailure(resolved),
        );
      }

      const result = await repo.assignKpi(
        auth.tenantId,
        resolved.staff.id,
        {
          name: body.name.trim(),
          description: body.description?.trim().slice(0, 4_000) ?? null,
          metricUnit: body.metricUnit ?? 'count',
          targetValue: body.targetValue,
          period: body.period ?? 'quarter',
          periodEndIso,
        },
        auth.userId,
        provenanceFrom(body, auth.userId).sessionId,
        provenanceFrom(body, auth.userId),
      );
      if (!result.ok) {
        return c.json(
          { success: false, error: { code: result.code, message: result.message } },
          statusForFailure(result),
        );
      }
      return c.json(
        {
          success: true,
          data: { ...result.kpi, staffMemberName: resolved.staff.full_name },
        },
        201,
      );
    },
  ),
);

// ── POST /tasks — schedule an org task ───────────────────────────────────

app.post(
  '/tasks',
  zValidator('json', ScheduleTaskSchema),
  withSecurityEvents(
    {
      action: 'org-admin.task.schedule',
      resource: 'org_task',
      severity: 'info',
    },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return notConfigured(c);
      const body = c.req.valid('json');

      let dueAtIso: string | null = null;
      if (body.dueAt && body.dueAt.trim().length > 0) {
        const ts = Date.parse(body.dueAt);
        if (Number.isNaN(ts)) {
          return c.json(
            {
              success: false,
              error: {
                code: 'INVALID_INPUT',
                message: `dueAt must be ISO 8601 (got "${body.dueAt}").`,
              },
            },
            422,
          );
        }
        if (ts < Date.now() - 5 * 60_000) {
          return c.json(
            {
              success: false,
              error: {
                code: 'INVALID_INPUT',
                message: `dueAt is in the past (${body.dueAt}). Confirm the date.`,
              },
            },
            422,
          );
        }
        dueAtIso = new Date(ts).toISOString();
      }

      const repo = new OrgTeamRepository(db);
      let assignedTo: string | null = null;
      if (body.assignedToStaffId || body.assignedToStaffName) {
        const resolved = await repo.resolveStaff(
          auth.tenantId,
          {
            id: body.assignedToStaffId ?? null,
            name: body.assignedToStaffName ?? null,
          },
          'assignee',
        );
        if (!resolved.ok) {
          return c.json(
            {
              success: false,
              error: { code: resolved.code, message: resolved.message },
            },
            statusForFailure(resolved),
          );
        }
        assignedTo = resolved.staff.id;
      }

      const result = await repo.scheduleTask(
        auth.tenantId,
        {
          title: body.title.trim(),
          description: body.description?.trim().slice(0, 4_000) ?? null,
          assignedTo,
          priority: body.priority ?? 'normal',
          dueAtIso,
        },
        auth.userId,
        provenanceFrom(body, auth.userId).sessionId,
        provenanceFrom(body, auth.userId),
      );
      if (!result.ok) {
        return c.json(
          { success: false, error: { code: result.code, message: result.message } },
          statusForFailure(result),
        );
      }
      return c.json({ success: true, data: result.task }, 201);
    },
  ),
);

// ── POST /escalations — raise an escalation ──────────────────────────────

app.post(
  '/escalations',
  zValidator('json', EscalateSchema),
  withSecurityEvents(
    {
      action: 'org-admin.escalation.raise',
      resource: 'org_escalation',
      severity: 'warning',
    },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return notConfigured(c);
      const body = c.req.valid('json');

      const repo = new OrgTeamRepository(db);

      // Verify related task FK (optional).
      let relatedTaskId: string | null = null;
      if (body.relatedTaskId) {
        const task = await repo.findTaskById(auth.tenantId, body.relatedTaskId);
        if (!task) {
          return c.json(
            {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: `NOT_FOUND: task ${body.relatedTaskId} not in this tenant.`,
              },
            },
            404,
          );
        }
        relatedTaskId = task.id;
      }

      // Resolve escalation target (optional).
      let escalatedToStaffId: string | null = null;
      if (body.escalatedToStaffId || body.escalatedToStaffName) {
        const resolved = await repo.resolveStaff(
          auth.tenantId,
          {
            id: body.escalatedToStaffId ?? null,
            name: body.escalatedToStaffName ?? null,
          },
          'escalation target',
        );
        if (!resolved.ok) {
          return c.json(
            {
              success: false,
              error: { code: resolved.code, message: resolved.message },
            },
            statusForFailure(resolved),
          );
        }
        escalatedToStaffId = resolved.staff.id;
      }

      const result = await repo.raiseEscalation(
        auth.tenantId,
        {
          title: body.title.trim(),
          reason: body.reason.trim().slice(0, 4_000),
          category: body.category ?? 'other',
          severity: body.severity ?? 'normal',
          escalatedToStaffId,
          relatedTaskId,
          relatedSubject: body.relatedSubject?.trim().slice(0, 200) ?? null,
        },
        auth.userId,
        provenanceFrom(body, auth.userId).sessionId,
        provenanceFrom(body, auth.userId),
      );
      if (!result.ok) {
        return c.json(
          { success: false, error: { code: result.code, message: result.message } },
          statusForFailure(result),
        );
      }
      return c.json({ success: true, data: result.escalation }, 201);
    },
  ),
);

// ── POST /staff/bulk-csv — bulk-ingest a staff roster ────────────────────

app.post(
  '/staff/bulk-csv',
  zValidator('json', BulkCsvSchema),
  withSecurityEvents(
    {
      action: 'org-admin.staff.bulk_ingest',
      resource: 'staff_member',
      severity: 'info',
    },
    async (c) => {
      const auth = c.get('auth');
      const db = c.get('db');
      if (!db) return notConfigured(c);
      const body = c.req.valid('json');

      const parsed = parseStaffCsv(body.csv);
      if (!parsed.ok) {
        return c.json(
          {
            success: false,
            error: { code: parsed.code, message: parsed.message },
            ...(parsed.outcomes
              ? { data: { totalRows: parsed.totalDataRows, outcomes: parsed.outcomes } }
              : {}),
          },
          422,
        );
      }

      const repo = new OrgTeamRepository(db);
      const insertOutcomes = await repo.bulkIngestStaff(
        auth.tenantId,
        parsed.parsedRows,
        body.allowDuplicates === true,
        provenanceFrom(body, auth.userId),
      );
      const outcomes = [...parsed.preInsertOutcomes, ...insertOutcomes];
      const inserted = outcomes.filter((o) => o.status === 'inserted').length;
      const skipped = outcomes.filter(
        (o) => o.status === 'skipped_duplicate',
      ).length;
      const rejected = outcomes.filter((o) => o.status === 'rejected').length;

      return c.json(
        {
          success: inserted > 0,
          data: {
            totalRows: parsed.totalDataRows,
            inserted,
            skippedDuplicates: skipped,
            rejected,
            outcomes,
          },
        },
        inserted > 0 ? 201 : 422,
      );
    },
  ),
);

export default app;
