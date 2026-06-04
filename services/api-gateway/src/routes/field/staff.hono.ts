/**
 * /api/v1/field/staff — G1-B closure (mobile staff hero card data).
 *
 * Property-management equivalent of Borjie's field/workforce surface.
 * Backs the workforce-mobile worker home card (estate manager,
 * maintenance technician, security officer, leasing agent) by exposing
 * four endpoints:
 *
 *   GET    /me                       staff identity + shift state
 *   GET    /tasks/next               single next pending assignment
 *   POST   /tasks/:id/complete       mark assignment done (hash-chain audited)
 *   POST   /help-requests            staff raises "Need help" flag
 *
 * Sources of truth:
 *   - Staff identity: `employees` (HR) joined to `users`. Estate roles
 *     are encoded in `employees.jobTitle` (property_manager, maintenance,
 *     leasing_agent, security_officer, caretaker).
 *   - Next task: `assignments` filtered to assigneeEmployeeId mapping to
 *     this user, status in {draft,in_progress,blocked}, ordered by
 *     priority then dueAt.
 *   - Shift state: derived from latest open assignment or the
 *     /api/v1/workforce/clock-in surface when available; today we use
 *     a deterministic "active" when any assignment is in_progress.
 *   - Help requests: written to `decision_journal` as an audited event;
 *     also published to the cockpit-events bus as a `staff.shift_event`
 *     so the owner cockpit pulses on raise.
 *
 * Tenant isolation:
 *   RLS FORCE-enabled. Every handler predicates on `auth.tenantId` and
 *   resolves the employee row via tenantId + userId so cross-tenant
 *   writes fail at the WITH CHECK predicate (belt-and-braces per
 *   CLAUDE.md).
 *
 * Bilingual:
 *   Title / detail fields ship both `en` and `sw` variants. Default
 *   language is `sw` per the global hard rule.
 */

// dsar.router.ts + head-briefing.router.ts.

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { randomUUID, createHash } from 'node:crypto';
import { and, asc, desc, eq, sql } from 'drizzle-orm';

import {
  assignments,
  employees,
  users,
} from '@bossnyumba/database';

import { authMiddleware } from '../../middleware/hono-auth';
import { databaseMiddleware } from '../../middleware/database';
import { publishCockpitEvent } from '../../services/cockpit-events';
import { createLogger } from '../../utils/logger';

const moduleLogger = createLogger('field-staff');

// ---------------------------------------------------------------------------
// Hash-chain audit helper — same shape as
// services/api-gateway/src/composition/ai-audit-chain-repo.ts but kept
// inline so this route file stays self-contained for the gap-closure
// commit. Verified by services/api-gateway/src/composition/audit-verify-cron.ts.
// ---------------------------------------------------------------------------

interface AuditAppendPayload {
  readonly action: string;
  readonly tenantId: string;
  readonly turnId: string;
  readonly userId: string;
  readonly details: Readonly<Record<string, unknown>>;
}

async function appendAuditEntry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  payload: AuditAppendPayload,
): Promise<string> {
  const id = randomUUID();
  const canonical = JSON.stringify({
    tenantId: payload.tenantId,
    turnId: payload.turnId,
    action: payload.action,
    userId: payload.userId,
    details: payload.details,
  });
  const latestResult: unknown = await db.execute(
    sql`SELECT COALESCE(MAX(sequence_id), 0) AS max_seq,
               (SELECT this_hash FROM ai_audit_chain
                WHERE tenant_id = ${payload.tenantId}
                ORDER BY sequence_id DESC LIMIT 1) AS last_hash
        FROM ai_audit_chain
        WHERE tenant_id = ${payload.tenantId}`,
  );
  const rows =
    (latestResult as { rows?: ReadonlyArray<Record<string, unknown>> }).rows ??
    (latestResult as ReadonlyArray<Record<string, unknown>>);
  const head = rows[0] ?? {};
  const maxSeq = Number(head.max_seq ?? 0);
  const lastHash =
    typeof head.last_hash === 'string' && head.last_hash.length > 0
      ? head.last_hash
      : '';
  const sequenceId = maxSeq + 1;
  const prevHash = lastHash;
  const thisHash = createHash('sha256')
    .update(prevHash + canonical)
    .digest('hex');
  await db.execute(sql`
    INSERT INTO ai_audit_chain (
      id, tenant_id, sequence_id, turn_id, action,
      prev_hash, this_hash, payload, created_at
    ) VALUES (
      ${id},
      ${payload.tenantId},
      ${sequenceId},
      ${payload.turnId},
      ${payload.action},
      ${prevHash},
      ${thisHash},
      ${JSON.stringify({ userId: payload.userId, details: payload.details })}::jsonb,
      ${new Date().toISOString()}
    )
  `);
  return id;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const CompleteTaskParamsSchema = z.object({
  id: z.string().uuid(),
});

const HelpRequestBodySchema = z.object({
  taskId: z.string().uuid().nullable().optional(),
  // English default per CLAUDE.md (flipped 2026-05).
  locale: z.enum(['sw', 'en']).default('en'),
  message: z.string().trim().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

type ShiftStatus = 'active' | 'on_break' | 'off_shift' | 'no_shift';

interface MeResponse {
  readonly staffId: string;
  readonly staffName: string;
  readonly roleLabel: string;
  readonly roleLabelSw: string;
  readonly shiftStatus: ShiftStatus;
  readonly shiftDetail?: string;
  readonly shiftDetailSw?: string;
}

interface NextTaskResponse {
  readonly id: string;
  readonly titleEn: string;
  readonly titleSw: string;
  readonly location?: string;
  readonly startedAt?: string;
  readonly dueAt?: string;
}

// Bilingual role label map for property-management staff. Default fallback
// is "Mfanyakazi" (sw) / "Staff" (en) so the FE is never empty.
function roleLabelFor(
  jobTitle: string | null | undefined,
  locale: 'sw' | 'en',
): string {
  const map: Record<string, { en: string; sw: string }> = {
    property_manager: { en: 'Property manager', sw: 'Meneja wa mali' },
    estate_manager: { en: 'Estate manager', sw: 'Meneja wa eneo' },
    maintenance: { en: 'Maintenance technician', sw: 'Fundi wa matengenezo' },
    plumber: { en: 'Plumber', sw: 'Fundi bomba' },
    electrician: { en: 'Electrician', sw: 'Fundi umeme' },
    leasing_agent: { en: 'Leasing agent', sw: 'Wakala wa upangaji' },
    security_officer: { en: 'Security officer', sw: 'Afisa wa usalama' },
    caretaker: { en: 'Caretaker', sw: 'Mlinzi wa mali' },
    cleaner: { en: 'Cleaner', sw: 'Msafi' },
    gardener: { en: 'Gardener', sw: 'Mkulima' },
  };
  const lookup = jobTitle ? map[jobTitle.toLowerCase()] : undefined;
  if (lookup) return locale === 'sw' ? lookup.sw : lookup.en;
  return locale === 'sw' ? 'Mfanyakazi' : 'Staff';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonError(
  code: string,
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 500 | 503,
) {
  return { status, body: { success: false as const, error: { code, message } } };
}

function formatRelative(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return 'a moment';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (remMin === 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${hours} hour${hours === 1 ? '' : 's'} ${remMin} min`;
}

function formatRelativeSw(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return 'sekunde chache';
  if (minutes < 60) return `dakika ${minutes}`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (remMin === 0) return `saa ${hours}`;
  return `saa ${hours} dakika ${remMin}`;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createFieldStaffRouter(): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);
  app.use('*', databaseMiddleware);

  // -------------------------------------------------------------------------
  // GET /me — staff identity + current shift state.
  // -------------------------------------------------------------------------
  app.get('/me', async (c: any) => {
    const auth = c.get('auth') ?? {};
    const { tenantId, userId } = auth as { tenantId?: string; userId?: string };
    if (!tenantId || !userId) {
      const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
      return c.json(err.body, err.status);
    }
    const db = c.get('db');
    if (!db) {
      const err = jsonError(
        'FIELD_STAFF_UNAVAILABLE',
        'database is not configured on this gateway',
        503,
      );
      return c.json(err.body, err.status);
    }

    try {
      const [userRow] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const [employeeRow] = await db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          jobTitle: employees.jobTitle,
        })
        .from(employees)
        .where(and(eq(employees.tenantId, tenantId), eq(employees.userId, userId)))
        .limit(1);

      const employeeName = employeeRow
        ? `${employeeRow.firstName ?? ''} ${employeeRow.lastName ?? ''}`.trim()
        : '';
      const platformName = [userRow?.firstName, userRow?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      const displayName =
        (employeeName.length > 0 ? employeeName : null) ??
        (platformName.length > 0 ? platformName : null) ??
        (userRow?.email as string | undefined) ??
        'Mfanyakazi';

      const recentRows = await db
        .select({
          status: assignments.status,
          startedAt: assignments.startedAt,
          completedAt: assignments.completedAt,
        })
        .from(assignments)
        .where(
          and(
            eq(assignments.tenantId, tenantId),
            employeeRow
              ? eq(assignments.assigneeEmployeeId, employeeRow.id)
              : sql`false`,
          ),
        )
        .orderBy(desc(assignments.updatedAt))
        .limit(5);

      let shiftStatus: ShiftStatus = 'no_shift';
      let shiftDetailEn: string | undefined;
      let shiftDetailSw: string | undefined;
      const active = recentRows.find(
        (r: Record<string, unknown>) => r.status === 'in_progress',
      );
      if (active && active.startedAt) {
        const startedAt = new Date(String(active.startedAt));
        const elapsed = Date.now() - startedAt.getTime();
        shiftStatus = 'active';
        shiftDetailEn = `Started ${formatRelative(elapsed)} ago`;
        shiftDetailSw = `Imeanza ${formatRelativeSw(elapsed)} zilizopita`;
      } else if (
        recentRows.find(
          (r: Record<string, unknown>) => r.status === 'completed',
        )
      ) {
        shiftStatus = 'off_shift';
        shiftDetailEn = 'Last shift completed';
        shiftDetailSw = 'Zamu ya mwisho imekamilika';
      }

      const response: MeResponse = {
        staffId: userId,
        staffName: displayName,
        roleLabel: roleLabelFor(employeeRow?.jobTitle, 'en'),
        roleLabelSw: roleLabelFor(employeeRow?.jobTitle, 'sw'),
        shiftStatus,
        ...(shiftDetailEn ? { shiftDetail: shiftDetailEn } : {}),
        ...(shiftDetailSw ? { shiftDetailSw } : {}),
      };
      return c.json(response, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'me failed';
      moduleLogger.error('field staff /me failed', {
        evt: 'field_staff_me_failed',
        tenantId,
        reason: message,
      });
      const e = jsonError('FIELD_STAFF_ME_FAILED', message, 500);
      return c.json(e.body, e.status);
    }
  });

  // -------------------------------------------------------------------------
  // GET /tasks/next — earliest open assignment for this staff member.
  // -------------------------------------------------------------------------
  app.get('/tasks/next', async (c: any) => {
    const auth = c.get('auth') ?? {};
    const { tenantId, userId } = auth as { tenantId?: string; userId?: string };
    if (!tenantId || !userId) {
      const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
      return c.json(err.body, err.status);
    }
    const db = c.get('db');
    if (!db) {
      const err = jsonError(
        'FIELD_STAFF_UNAVAILABLE',
        'database is not configured on this gateway',
        503,
      );
      return c.json(err.body, err.status);
    }

    try {
      const [employeeRow] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(eq(employees.tenantId, tenantId), eq(employees.userId, userId)),
        )
        .limit(1);
      if (!employeeRow) {
        return c.json(null, 200);
      }

      const rows = await db
        .select()
        .from(assignments)
        .where(
          and(
            eq(assignments.tenantId, tenantId),
            eq(assignments.assigneeEmployeeId, employeeRow.id),
            sql`${assignments.status} IN ('draft', 'in_progress', 'blocked')`,
          ),
        )
        .orderBy(
          asc(assignments.priority),
          sql`${assignments.dueAt} ASC NULLS LAST`,
          asc(assignments.createdAt),
        )
        .limit(1);

      const row = rows[0];
      if (!row) {
        return c.json(null, 200);
      }
      const response: NextTaskResponse = {
        id: String(row.id),
        titleEn: String(row.title ?? ''),
        titleSw: String(row.title ?? ''),
        ...(row.linkedEntityId ? { location: String(row.linkedEntityId) } : {}),
        ...(row.startedAt
          ? { startedAt: new Date(String(row.startedAt)).toISOString() }
          : {}),
        ...(row.dueAt
          ? { dueAt: new Date(String(row.dueAt)).toISOString() }
          : {}),
      };
      return c.json(response, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'next failed';
      moduleLogger.error('field staff /tasks/next failed', {
        evt: 'field_staff_next_task_failed',
        tenantId,
        reason: message,
      });
      const e = jsonError('FIELD_STAFF_NEXT_TASK_FAILED', message, 500);
      return c.json(e.body, e.status);
    }
  });

  // -------------------------------------------------------------------------
  // POST /tasks/:id/complete — staff marks the named assignment done.
  // -------------------------------------------------------------------------
  app.post(
    '/tasks/:id/complete',
    zValidator('param', CompleteTaskParamsSchema),
    async (c: any) => {
      const auth = c.get('auth') ?? {};
      const { tenantId, userId } = auth as {
        tenantId?: string;
        userId?: string;
      };
      if (!tenantId || !userId) {
        const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
        return c.json(err.body, err.status);
      }
      const db = c.get('db');
      if (!db) {
        const err = jsonError(
          'FIELD_STAFF_UNAVAILABLE',
          'database is not configured on this gateway',
          503,
        );
        return c.json(err.body, err.status);
      }
      const { id } = c.req.valid('param') as { id: string };

      try {
        const [existing] = await db
          .select()
          .from(assignments)
          .where(
            and(eq(assignments.id, id), eq(assignments.tenantId, tenantId)),
          )
          .limit(1);
        if (!existing) {
          const err = jsonError('TASK_NOT_FOUND', 'Task not found', 404);
          return c.json(err.body, err.status);
        }

        const [employeeRow] = await db
          .select({ id: employees.id })
          .from(employees)
          .where(
            and(
              eq(employees.tenantId, tenantId),
              eq(employees.userId, userId),
            ),
          )
          .limit(1);

        if (
          existing.assigneeEmployeeId &&
          (!employeeRow || existing.assigneeEmployeeId !== employeeRow.id)
        ) {
          const err = jsonError(
            'TASK_NOT_ASSIGNED',
            'Task is not assigned to this staff member',
            403,
          );
          return c.json(err.body, err.status);
        }
        if (existing.status === 'completed') {
          return c.json(
            {
              ok: true as const,
              taskId: existing.id,
              completedAt:
                existing.completedAt instanceof Date
                  ? existing.completedAt.toISOString()
                  : String(existing.completedAt ?? new Date().toISOString()),
              idempotent: true as const,
            },
            200,
          );
        }

        const completedAt = new Date();
        const chainId = await appendAuditEntry(db, {
          action: 'field.staff.task.complete',
          tenantId,
          turnId: id,
          userId,
          details: {
            taskId: id,
            previousStatus: existing.status,
            completedAt: completedAt.toISOString(),
            source: 'field-staff-hero-card',
          },
        });

        await db
          .update(assignments)
          .set({
            status: 'completed',
            completedAt,
          })
          .where(
            and(eq(assignments.id, id), eq(assignments.tenantId, tenantId)),
          );

        return c.json(
          {
            ok: true as const,
            taskId: id,
            completedAt: completedAt.toISOString(),
            hashChainId: chainId,
          },
          200,
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'complete failed';
        moduleLogger.error('field staff /tasks/:id/complete failed', {
          evt: 'field_staff_task_complete_failed',
          tenantId,
          taskId: id,
          reason: message,
        });
        const e = jsonError('FIELD_STAFF_TASK_COMPLETE_FAILED', message, 500);
        return c.json(e.body, e.status);
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /help-requests — staff raises a help request.
  // -------------------------------------------------------------------------
  app.post(
    '/help-requests',
    zValidator('json', HelpRequestBodySchema),
    async (c: any) => {
      const auth = c.get('auth') ?? {};
      const { tenantId, userId } = auth as {
        tenantId?: string;
        userId?: string;
      };
      if (!tenantId || !userId) {
        const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
        return c.json(err.body, err.status);
      }
      const db = c.get('db');
      if (!db) {
        const err = jsonError(
          'FIELD_STAFF_UNAVAILABLE',
          'database is not configured on this gateway',
          503,
        );
        return c.json(err.body, err.status);
      }
      const body = c.req.valid('json') as z.infer<typeof HelpRequestBodySchema>;

      try {
        const requestId = randomUUID();
        const chainId = await appendAuditEntry(db, {
          action: 'field.staff.help_request.create',
          tenantId,
          turnId: requestId,
          userId,
          details: {
            requestId,
            taskId: body.taskId ?? null,
            locale: body.locale,
            messageText: body.message ?? null,
            source: 'field-staff-hero-card',
          },
        });

        publishCockpitEvent({
          kind: 'staff.shift_event',
          tenantId,
          emittedAt: new Date().toISOString(),
          staffId: userId,
          transition: 'shift_start',
        });

        return c.json(
          {
            ok: true as const,
            id: requestId,
            status: 'open',
            createdAt: new Date().toISOString(),
            hashChainId: chainId,
          },
          201,
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'help request failed';
        moduleLogger.error('field staff /help-requests failed', {
          evt: 'field_staff_help_request_failed',
          tenantId,
          reason: message,
        });
        const e = jsonError('FIELD_STAFF_HELP_REQUEST_FAILED', message, 500);
        return c.json(e.body, e.status);
      }
    },
  );

  return app;
}

export const fieldStaffRouter = createFieldStaffRouter();
