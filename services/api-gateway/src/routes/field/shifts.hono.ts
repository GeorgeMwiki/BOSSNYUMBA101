/**
 * /api/v1/field/shifts — worker shift surface (mobile W-M-02).
 *
 * Backs the staff-mobile worker home / shift-report card which polls
 *   GET /api/v1/field/shifts/today
 * via apps/staff-mobile/src/home/worker/useTodayShift.ts. Before this router
 * the route did not exist and the hook returned an HONEST empty state ("no
 * shift / unavailable") rather than fabricating a 06:00–18:00 day shift.
 *
 * Sources of truth:
 *   - The shift itself: `staff_shifts` (migration 0332) — the REAL schedule
 *     source. Resolved by (tenantId, userId, today) ordered so an in-window
 *     shift wins, then the next upcoming one. `site_name` is denormalised on
 *     the row so the card renders without a join.
 *   - The shift's task list: resolved LIVE from `maintenance_tasks`
 *     (assignedToUserId = JWT subject, open status, due today-or-undated) so
 *     the card always reflects the current queue, never a stale snapshot.
 *
 * Honest empty: when this worker has no shift scheduled for today the route
 * returns 200 `null` (NOT 404). The hook maps `null` to the empty surface and
 * 404/501/network-0 to the SAME empty surface, so either behaviour is safe;
 * 200 `null` is the canonical "no shift" signal.
 *
 * Auth: staff only — requireRole(MAINTENANCE_STAFF, PROPERTY_MANAGER,
 * TENANT_ADMIN). The worker resolves THEIR OWN shift from the JWT subject;
 * there is no path to read another worker's shift (anti-IDOR by construction —
 * userId is never client input).
 *
 * Tenant isolation: RLS FORCE-enabled on staff_shifts + maintenance_tasks.
 * Every query predicates on `auth.tenantId` belt-and-braces per CLAUDE.md.
 *
 * Bilingual: task titles ship `titleEn` + `titleSw` (maintenance_tasks stores
 * both). The card honours the absolute locale toggle.
 */

import { Hono } from 'hono';
import { and, asc, eq, gte, lte, or, sql } from 'drizzle-orm';

import { staffShifts, maintenanceTasks } from '@bossnyumba/database';

import { authMiddleware, requireRole } from '../../middleware/hono-auth';
import { databaseMiddleware } from '../../middleware/database';
import { getSharedPerTenantRateBudget } from '../../middleware/per-tenant-rate-budget';
import { UserRole } from '../../types/user-role';
import { createLogger } from '../../utils/logger';

const moduleLogger = createLogger('field-shifts');

// ---------------------------------------------------------------------------
// Response shapes — MUST match apps/staff-mobile/src/home/worker/
// useTodayShift.ts (TodayShift / ShiftTaskLite).
// ---------------------------------------------------------------------------

interface ShiftTaskLite {
  readonly id: string;
  readonly titleEn: string;
  readonly titleSw: string;
  readonly location: string | null;
}

interface TodayShift {
  readonly shiftDate: string;
  readonly shiftKind: 'day' | 'night';
  readonly siteName: string;
  readonly startISO: string;
  readonly endISO: string;
  readonly nextBreakISO: string | null;
  readonly tasks: ReadonlyArray<ShiftTaskLite>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonError(
  code: string,
  message: string,
  status: 401 | 403 | 500 | 503,
) {
  return { status, body: { success: false as const, error: { code, message } } };
}

/**
 * The launch-jurisdiction timezone. Tanzania (Africa/Dar_es_Salaam, UTC+3) is
 * the starting jurisdiction; as East-Africa expansion adds markets this should
 * resolve from the tenant/property config rather than a constant. It lives here
 * as a single documented launch default — not a jurisdiction branch in logic.
 */
const LAUNCH_TIMEZONE = 'Africa/Dar_es_Salaam';

/**
 * Worker-local calendar day as YYYY-MM-DD. Bucketing on the LOCAL day (not the
 * UTC day) fixes the 21:00–24:00 UTC window: a UTC+3 worker is already on the
 * next local day, so a UTC bucket showed them tomorrow's (empty) shift.
 */
function todayDateString(now: Date): string {
  // en-CA renders ISO-style YYYY-MM-DD; timeZone shifts to the local day.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LAUNCH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function toISO(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function toISONullable(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return toISO(value);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export function createFieldShiftsRouter(): Hono {
  const app = new Hono();
  app.use('*', authMiddleware);
  app.use(
    '*',
    requireRole(
      UserRole.MAINTENANCE_STAFF,
      UserRole.PROPERTY_MANAGER,
      UserRole.TENANT_ADMIN,
    ),
  );
  app.use('*', databaseMiddleware);
  app.use('*', getSharedPerTenantRateBudget({ surface: 'api' }).handler);

  // -------------------------------------------------------------------------
  // GET /today — this worker's shift for today (or 200 null if none).
  // -------------------------------------------------------------------------
  app.get('/today', async (c: any) => {
    const auth = c.get('auth') ?? {};
    const { tenantId, userId } = auth as { tenantId?: string; userId?: string };
    if (!tenantId || !userId) {
      const err = jsonError('UNAUTHORIZED', 'Authentication required', 401);
      return c.json(err.body, err.status);
    }
    const db = c.get('db');
    if (!db) {
      const err = jsonError(
        'FIELD_SHIFTS_UNAVAILABLE',
        'database is not configured on this gateway',
        503,
      );
      return c.json(err.body, err.status);
    }

    try {
      const now = new Date();
      const today = todayDateString(now);

      // Resolve THIS worker's shift for today. A worker may hold both a day
      // and a night shift; prefer the one whose window currently contains
      // `now`, otherwise the next upcoming one, otherwise the earliest.
      const shiftRows = await db
        .select({
          shiftDate: staffShifts.shiftDate,
          shiftKind: staffShifts.shiftKind,
          siteName: staffShifts.siteName,
          startsAt: staffShifts.startsAt,
          endsAt: staffShifts.endsAt,
          nextBreakAt: staffShifts.nextBreakAt,
        })
        .from(staffShifts)
        .where(
          and(
            eq(staffShifts.tenantId, tenantId),
            eq(staffShifts.userId, userId),
            eq(staffShifts.shiftDate, today),
          ),
        )
        .orderBy(asc(staffShifts.startsAt));

      if (!Array.isArray(shiftRows) || shiftRows.length === 0) {
        // Honest empty — no shift scheduled today. NOT a 404.
        return c.json(null, 200);
      }

      const nowMs = now.getTime();
      const inWindow = shiftRows.find((r: Record<string, unknown>) => {
        const start = new Date(String(r.startsAt)).getTime();
        const end = new Date(String(r.endsAt)).getTime();
        return start <= nowMs && nowMs <= end;
      });
      const upcoming = shiftRows.find(
        (r: Record<string, unknown>) =>
          new Date(String(r.startsAt)).getTime() >= nowMs,
      );
      const shift = inWindow ?? upcoming ?? shiftRows[0];

      // Resolve the shift's task list LIVE from maintenance_tasks for THIS
      // worker: open status, due today-or-undated. Tenant-predicated.
      const taskRows = await db
        .select({
          id: maintenanceTasks.id,
          titleEn: maintenanceTasks.titleEn,
          titleSw: maintenanceTasks.titleSw,
          buildingId: maintenanceTasks.buildingId,
        })
        .from(maintenanceTasks)
        .where(
          and(
            // maintenance_tasks.tenant_id / assigned_to_user_id are UUID
            // columns, but tenant/user ids on the JWT are free-form TEXT (as
            // on every other tenant-scoped table). Binding a non-uuid id to an
            // `eq` against a uuid column makes Postgres cast the *parameter* to
            // uuid and throw 22P02. Compare via an explicit ::text cast on the
            // column, mirroring the 0283 RLS policy's
            // `tenant_id::text = current_setting(...)` convention, so a real
            // tenant id never 22P02s.
            sql`${maintenanceTasks.tenantId}::text = ${tenantId}`,
            sql`${maintenanceTasks.assignedToUserId}::text = ${userId}`,
            sql`${maintenanceTasks.status} IN ('pending', 'in_progress', 'blocked')`,
            or(
              sql`${maintenanceTasks.dueAt} IS NULL`,
              and(
                gte(
                  maintenanceTasks.dueAt,
                  sql`(${today})::timestamptz`,
                ),
                lte(
                  maintenanceTasks.dueAt,
                  sql`(${today})::timestamptz + interval '1 day'`,
                ),
              ),
            ),
          ),
        )
        .orderBy(
          sql`CASE ${maintenanceTasks.priority}
                WHEN 'urgent' THEN 0
                WHEN 'high'   THEN 1
                WHEN 'normal' THEN 2
                WHEN 'low'    THEN 3
                ELSE 4 END`,
          sql`${maintenanceTasks.dueAt} ASC NULLS LAST`,
          asc(maintenanceTasks.createdAt),
        )
        .limit(50);

      const tasks: ReadonlyArray<ShiftTaskLite> = (
        Array.isArray(taskRows) ? taskRows : []
      ).map((t: Record<string, unknown>) => {
        const sw = String(t.titleSw ?? '');
        const en = t.titleEn ? String(t.titleEn) : sw;
        return {
          id: String(t.id),
          titleEn: en,
          titleSw: sw,
          location: t.buildingId ? String(t.buildingId) : null,
        };
      });

      const response: TodayShift = {
        shiftDate: String(shift.shiftDate),
        shiftKind: (shift.shiftKind === 'night' ? 'night' : 'day') as
          | 'day'
          | 'night',
        siteName: String(shift.siteName ?? ''),
        startISO: toISO(shift.startsAt),
        endISO: toISO(shift.endsAt),
        nextBreakISO: toISONullable(shift.nextBreakAt),
        tasks,
      };
      return c.json(response, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'shifts/today failed';
      moduleLogger.error('field shifts /today failed', {
        evt: 'field_shifts_today_failed',
        tenantId,
        reason: message,
      });
      const e = jsonError('FIELD_SHIFTS_TODAY_FAILED', message, 500);
      return c.json(e.body, e.status);
    }
  });

  return app;
}

export const fieldShiftsRouter = createFieldShiftsRouter();
