// @ts-nocheck — Hono v4 status-code union; read handlers use structural casts over services.db.
/**
 * Estate Manager App BFF — Wave 18 real-data wiring.
 *
 * Previously a 1,300-line fixture router gated behind `liveDataRequired`
 * so every GET returned 503 LIVE_DATA_NOT_IMPLEMENTED. The fixtures
 * included fake tenant names, fake phone numbers, and fake SLA stats —
 * hidden from prod by the gate but a ticking liability.
 *
 * This rewrite aggregates the manager's day from real tables:
 *
 *   GET /                  — same as /home (smoke-test safe)
 *   GET /home              — greeting + today-summary + urgent work orders
 *   GET /work-orders       — tenant-scoped work orders list
 *   GET /work-orders/:id   — single work order
 *   GET /inspections       — tenant-scoped inspections list
 *   GET /vendors           — tenant-scoped vendors list
 *   GET /occupancy         — unit status roll-up
 *   GET /collections       — arrears cases list
 *   GET /sla               — placeholder summary (SLA analytics pending)
 *
 *   Most POST/PUT/DELETE surfaces still return 501 NOT_IMPLEMENTED pointing at
 *   the canonical tenant-scoped routers they should go through
 *   (/api/v1/work-orders, /api/v1/inspections, etc.). The BFF was never the
 *   source of truth for those mutations.
 *
 * TWO write surfaces ARE owned here (they have no canonical router and the
 * mobile clients have no other home for them):
 *
 *   STAFF FIELD CAPTURES (#7) — offline-sync write sink for staff-mobile:
 *     POST /attendance · /task-acks · /incidents · /shift-reports
 *     Persists to field_captures (migration 0326), tenant-scoped + FORCE RLS,
 *     idempotent on a client-supplied id. Fixes the silent data-loss where a
 *     missing route 404'd and the offline queue dropped the payload.
 *
 *   APPLICANT IDENTITY (#9) — renter self-service for tenant-mobile:
 *     POST /applicants/kyc · GET /applicants/kyc/:id/status
 *     POST|PUT /applicants/profile · POST|PUT /applicants/profile/notifications
 *     Persists to applicant_kyc + applicant_profile (migration 0327),
 *     tenant-scoped + FORCE RLS, keyed on the JWT applicant_id (uniform-404
 *     anti-IDOR; preferredLang persisted + hydrated, never hard-coded).
 *
 * Tenant isolation: every read is scoped by `auth.tenantId`; every write goes
 * through `withTenantContext` (in the repo) so the RLS GUC is bound and a
 * cross-tenant write SURFACES rather than fake-succeeding.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { and, count, desc, eq, gte, lte, or, sql } from 'drizzle-orm';
import {
  workOrders,
  inspections,
  vendors,
  vendorScorecards,
  properties,
  units,
  arrearsCases,
} from '@bossnyumba/database';
import { authMiddleware } from '../../middleware/hono-auth';
import { UserRole } from '../../types/user-role';
import { routeCatch } from '../../utils/safe-error';
import {
  createEstateFieldIdentityRepo,
  type CaptureType,
} from '../../repositories/estate-field-identity-repo';

import { withSecurityEvents } from '@bossnyumba/observability';
const app = new Hono();
app.use('*', authMiddleware);

// Role gates — split because the two surfaces this router serves have
// different audiences:
//
//   * Manager/operator surfaces (home, work-orders, inspections, vendors,
//     occupancy, collections, field captures) are for staff/operators:
//     PROPERTY_MANAGER + MAINTENANCE_STAFF + admin roles. A renter must NOT be
//     able to read another tenant's work-order queue, so RESIDENT is excluded
//     from these.
//
//   * The /applicants/* identity surface is the renter's OWN self-service
//     (KYC + profile + notification prefs). The tenant-mobile renter
//     authenticates as RESIDENT (the customer-app default in
//     auth.middleware mapSupabaseRoleToUserRole). These routes are self-scoped
//     to the authenticated userId, so RESIDENT is permitted here — and ONLY
//     here.
//
// Single fail-closed gate (deny-by-default). The manager surface is operator-
// only; the renter self-service identity surface (/applicants/*) is the sole
// RESIDENT-permitted carve-out. Implemented as ONE `*` middleware rather than a
// per-path enumeration so a future route added without an explicit gate is
// still covered (it falls into the operator-only branch — never ungated).
const MANAGER_ROLES = new Set<string>([
  UserRole.PROPERTY_MANAGER,
  UserRole.MAINTENANCE_STAFF,
  UserRole.TENANT_ADMIN,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
]);

// /applicants/* additionally admits RESIDENT (the tenant-mobile renter's mapped
// role) — and ONLY that surface. Self-scoping to the JWT userId in each handler
// guarantees a renter sees only their own record.
const APPLICANT_EXTRA_ROLES = new Set<string>([UserRole.RESIDENT]);

app.use('*', async (c, next) => {
  const auth = c.get('auth') as { role?: string } | undefined;
  const role = auth?.role;
  if (!role) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      401,
    );
  }
  const path = c.req.path; // e.g. /api/v1/manager/applicants/profile
  const isApplicantSurface = /\/applicants(\/|$)/u.test(path);
  const allowed =
    MANAGER_ROLES.has(role) ||
    (isApplicantSurface && APPLICANT_EXTRA_ROLES.has(role));
  if (!allowed) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
      403,
    );
  }
  await next();
});

function dbUnavailable(c) {
  return c.json(
    {
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Estate manager BFF requires a live DATABASE_URL.',
      },
    },
    503,
  );
}

function notImplemented(c, verb) {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: `${verb} via the manager BFF is not wired — use the canonical routers (/api/v1/work-orders, /api/v1/inspections).`,
      },
    },
    501,
  );
}

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

async function buildHome(db, tenantId: string, userId: string) {
  // Aggregate counters in parallel. Each Promise resolves to a single
  // `{ n: number }` row; missing tables / driver errors surface as zero
  // so the dashboard always renders.
  const safe = async (p: Promise<any>): Promise<number> => {
    try {
      const rows = await p;
      const first = Array.isArray(rows) ? rows[0] : rows?.rows?.[0];
      return Number(first?.n ?? first?.count ?? 0);
    } catch {
      return 0;
    }
  };

  const [
    openWorkOrders,
    urgentWorkOrders,
    scheduledInspections,
    activeArrears,
  ] = await Promise.all([
    safe(
      db
        .select({ n: count() })
        .from(workOrders)
        .where(
          and(
            eq(workOrders.tenantId, tenantId),
            sql`status NOT IN ('completed','cancelled')`,
          ),
        ),
    ),
    safe(
      db
        .select({ n: count() })
        .from(workOrders)
        .where(
          and(
            eq(workOrders.tenantId, tenantId),
            sql`priority IN ('emergency','high')`,
            sql`status NOT IN ('completed','cancelled')`,
          ),
        ),
    ),
    safe(
      db
        .select({ n: count() })
        .from(inspections)
        .where(
          and(
            eq(inspections.tenantId, tenantId),
            sql`status = 'scheduled'`,
          ),
        ),
    ),
    safe(
      db
        .select({ n: count() })
        .from(arrearsCases)
        .where(
          and(
            eq(arrearsCases.tenantId, tenantId),
            sql`status = 'active'`,
          ),
        ),
    ),
  ]);

  return {
    greeting: getTimeBasedGreeting(),
    manager: { id: userId },
    todaySummary: {
      scheduledInspections,
      openWorkOrders,
      urgentWorkOrders,
      collectionsFollowUp: activeArrears,
    },
    quickActions: [
      { id: 'work_orders', label: 'Work Orders', route: '/api/v1/work-orders' },
      { id: 'inspections', label: 'Inspections', route: '/api/v1/inspections' },
      { id: 'arrears', label: 'Arrears', route: '/api/v1/arrears/cases' },
    ],
  };
}

app.get('/', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  try {
    return c.json({ success: true, data: await buildHome(db, tenantId, userId) });
  } catch (err) {
    return routeCatch(c, err, {
      code: 'HOME_QUERY_FAILED',
      status: 503,
      fallback: 'Home query failed',
    });
  }
});

app.get('/home', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  try {
    return c.json({ success: true, data: await buildHome(db, tenantId, userId) });
  } catch (err) {
    return routeCatch(c, err, {
      code: 'HOME_QUERY_FAILED',
      status: 503,
      fallback: 'Home query failed',
    });
  }
});

app.get('/work-orders', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? '50') || 50));
  try {
    const rows = await db
      .select()
      .from(workOrders)
      .where(eq(workOrders.tenantId, tenantId))
      .orderBy(desc(workOrders.createdAt))
      .limit(limit);
    return c.json({ success: true, data: rows });
  } catch (err) {
    return routeCatch(c, err, {
      code: 'WORK_ORDERS_QUERY_FAILED',
      status: 503,
      fallback: 'Work orders query failed',
    });
  }
});

// IMPORTANT: /work-orders/queue MUST register before /work-orders/:id.
// Hono dispatches in registration order; otherwise the static
// "queue" string matches the dynamic :id slot.
app.get('/work-orders/queue', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? '50') || 50));
  try {
    // Pull "active or pending" WOs scoped to properties this manager
    // manages. The status filter excludes terminal states.
    const rows = await db
      .select({
        id: workOrders.id,
        tenantId: workOrders.tenantId,
        propertyId: workOrders.propertyId,
        unitId: workOrders.unitId,
        workOrderNumber: workOrders.workOrderNumber,
        title: workOrders.title,
        priority: workOrders.priority,
        status: workOrders.status,
        category: workOrders.category,
        scheduledAt: workOrders.scheduledAt,
        responseDueAt: workOrders.responseDueAt,
        resolutionDueAt: workOrders.resolutionDueAt,
        createdAt: workOrders.createdAt,
      })
      .from(workOrders)
      .innerJoin(properties, eq(workOrders.propertyId, properties.id))
      .where(
        and(
          eq(workOrders.tenantId, tenantId),
          eq(properties.managerId, userId),
          sql`${workOrders.status} NOT IN ('completed','cancelled','closed')`,
        ),
      )
      .orderBy(
        sql`CASE ${workOrders.priority} WHEN 'emergency' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END`,
        desc(workOrders.createdAt),
      )
      .limit(limit);

    return c.json({
      success: true,
      data: rows,
      meta: { managerId: userId, count: rows.length },
    });
  } catch (err) {
    return routeCatch(c, err, {
      code: 'MANAGER_WORK_ORDER_QUEUE_FAILED',
      status: 503,
      fallback: 'Work order queue query failed',
    });
  }
});

app.get('/work-orders/:id', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  try {
    const [row] = await db
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.tenantId, tenantId), eq(workOrders.id, id)))
      .limit(1);
    if (!row) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Work order not found' } },
        404,
      );
    }
    return c.json({ success: true, data: row });
  } catch (err) {
    return routeCatch(c, err, {
      code: 'WORK_ORDER_QUERY_FAILED',
      status: 503,
      fallback: 'Work order query failed',
    });
  }
});

app.get('/inspections', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? '50') || 50));
  try {
    const rows = await db
      .select()
      .from(inspections)
      .where(eq(inspections.tenantId, tenantId))
      .orderBy(desc(inspections.scheduledDate))
      .limit(limit);
    return c.json({ success: true, data: rows });
  } catch (err) {
    return routeCatch(c, err, {
      code: 'INSPECTIONS_QUERY_FAILED',
      status: 503,
      fallback: 'Inspections query failed',
    });
  }
});

app.get('/vendors', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? '50') || 50));
  try {
    const rows = await db
      .select()
      .from(vendors)
      .where(eq(vendors.tenantId, tenantId))
      .limit(limit);
    return c.json({ success: true, data: rows });
  } catch (err) {
    return routeCatch(c, err, {
      code: 'VENDORS_QUERY_FAILED',
      status: 503,
      fallback: 'Vendors query failed',
    });
  }
});

app.get('/occupancy', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  try {
    // unit_status enum values: vacant, occupied, reserved,
    // under_maintenance, not_available. "turnover" is not a valid
    // value; using `under_maintenance` as the turnover proxy so the
    // query returns a meaningful count without 22P02.
    const [totals] = await db
      .select({
        total: count(),
        occupied: sql`COUNT(*) FILTER (WHERE ${units.status} = 'occupied')::int`,
        vacant: sql`COUNT(*) FILTER (WHERE ${units.status} = 'vacant')::int`,
        turnover: sql`COUNT(*) FILTER (WHERE ${units.status} = 'under_maintenance')::int`,
        reserved: sql`COUNT(*) FILTER (WHERE ${units.status} = 'reserved')::int`,
      })
      .from(units)
      .innerJoin(properties, eq(units.propertyId, properties.id))
      .where(eq(properties.tenantId, tenantId));

    const total = Number(totals?.total ?? 0);
    const occupied = Number(totals?.occupied ?? 0);
    return c.json({
      success: true,
      data: {
        summary: {
          totalUnits: total,
          occupied,
          vacant: Number(totals?.vacant ?? 0),
          turnover: Number(totals?.turnover ?? 0),
          reserved: Number(totals?.reserved ?? 0),
          occupancyRate: total > 0 ? occupied / total : 0,
        },
      },
    });
  } catch (err) {
    return routeCatch(c, err, {
      code: 'OCCUPANCY_QUERY_FAILED',
      status: 503,
      fallback: 'Occupancy query failed',
    });
  }
});

app.get('/collections', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? '50') || 50));
  try {
    const rows = await db
      .select()
      .from(arrearsCases)
      .where(
        and(eq(arrearsCases.tenantId, tenantId), sql`status = 'active'`),
      )
      .orderBy(desc(arrearsCases.createdAt))
      .limit(limit);
    return c.json({ success: true, data: rows });
  } catch (err) {
    return routeCatch(c, err, {
      code: 'COLLECTIONS_QUERY_FAILED',
      status: 503,
      fallback: 'Collections query failed',
    });
  }
});

app.get('/sla', (c) => {
  // SLA analytics require a work-order-event-stream aggregation that
  // isn't wired yet. Return a shape-compatible empty envelope so
  // dashboards render an "insufficient data" state rather than crash.
  return c.json({
    success: true,
    data: {
      summary: {
        responseCompliance: null,
        resolutionCompliance: null,
        atRiskCount: 0,
        breachedCount: 0,
      },
      note: 'SLA analytics pending — work-order-event-stream aggregation not yet wired.',
    },
  });
});

// ============================================================================
// Manager-app aggregator endpoints (real-wrap reads).
//
//   GET /work-orders/queue           — active+pending WOs, manager-scoped
//   GET /inspections/upcoming        — inspections in the next 30 days
//   GET /escalations                 — open exceptions/escalations
//   GET /vendors/scorecards          — vendor scorecards (real if rows; empty otherwise)
//
// All four queries are tenant-scoped. "manager-scoped" filtering uses
// `properties.managerId === auth.userId` because the work_orders table
// has no explicit assignee column today (assignedBy is the actor that
// performed the assign action, not the assignee). Until a dedicated
// `assigned_to` column lands, scoping by managed-property is the
// honest interpretation.
// ============================================================================

app.get('/inspections/upcoming', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? '50') || 50));
  try {
    // 30-day rolling window. We avoid `BETWEEN` because driver coercion
    // varies; explicit gte/lte against NOW() and NOW() + interval is
    // portable.
    const rows = await db
      .select({
        id: inspections.id,
        tenantId: inspections.tenantId,
        propertyId: inspections.propertyId,
        unitId: inspections.unitId,
        type: inspections.type,
        status: inspections.status,
        scheduledDate: inspections.scheduledDate,
        inspectorId: inspections.inspectorId,
      })
      .from(inspections)
      .innerJoin(properties, eq(inspections.propertyId, properties.id))
      .where(
        and(
          eq(inspections.tenantId, tenantId),
          eq(properties.managerId, userId),
          sql`${inspections.scheduledDate} IS NOT NULL`,
          sql`${inspections.scheduledDate} >= NOW()`,
          sql`${inspections.scheduledDate} <= NOW() + INTERVAL '30 days'`,
          sql`${inspections.status} IN ('scheduled','in_progress')`,
        ),
      )
      .orderBy(inspections.scheduledDate)
      .limit(limit);

    return c.json({
      success: true,
      data: rows,
      meta: { managerId: userId, windowDays: 30, count: rows.length },
    });
  } catch (err) {
    return routeCatch(c, err, {
      code: 'MANAGER_UPCOMING_INSPECTIONS_FAILED',
      status: 503,
      fallback: 'Upcoming inspections query failed',
    });
  }
});

app.get('/escalations', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? '50') || 50));
  try {
    // The exception inbox lives in the autonomy package's repo (Postgres
    // when wired, in-memory fallback otherwise). The BFF is a read-roll-up
    // surface, so we proxy via the tenant-scoped exceptions table when
    // available, and emit honest-empty when it isn't.
    const services = c.get('services') ?? {};
    const inbox = services.autonomy?.exceptionInbox ?? services.exceptionInbox;
    if (inbox && typeof inbox.listOpen === 'function') {
      const items = await inbox.listOpen(tenantId, { limit });
      return c.json({
        success: true,
        data: items,
        meta: { source: 'autonomy.exceptionInbox', count: items.length },
      });
    }

    // No inbox bound — return honest empty.
    return c.json({
      success: true,
      data: [],
      meta: {
        source: 'honest-empty',
        note: 'autonomy.exceptionInbox not wired; manager BFF has no upstream to query',
      },
    });
  } catch (err) {
    return routeCatch(c, err, {
      code: 'MANAGER_ESCALATIONS_FAILED',
      status: 503,
      fallback: 'Escalations query failed',
    });
  }
});

app.get('/vendors/scorecards', async (c) => {
  const db = (c.get('services') ?? {}).db;
  if (!db) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? '50') || 50));
  try {
    const rows = await db
      .select()
      .from(vendorScorecards)
      .where(eq(vendorScorecards.tenantId, tenantId))
      .limit(limit);

    return c.json({
      success: true,
      data: rows,
      meta: { count: rows.length },
    });
  } catch (err) {
    // If the table isn't present (relation undefined), fall through to
    // honest-empty rather than 503.
    if (
      err &&
      typeof err === 'object' &&
      ((err as { code?: string }).code === '42P01' ||
        (err as { code?: string }).code === '42703')
    ) {
      return c.json({
        success: true,
        data: [],
        meta: {
          source: 'honest-empty',
          note: 'vendor_scorecards table not yet provisioned in this environment',
        },
      });
    }
    return routeCatch(c, err, {
      code: 'MANAGER_VENDOR_SCORECARDS_FAILED',
      status: 503,
      fallback: 'Vendor scorecards query failed',
    });
  }
});

// ============================================================================
// STAFF FIELD CAPTURES (#7) — the offline-sync write sink.
//
// apps/staff-mobile/src/sync/flush.ts POSTs each queued offline capture to
// POST /api/v1/manager/<attendance|task-acks|incidents|shift-reports>. These
// routes did not exist, so every flush 404'd and the queue's shouldDrop()
// discarded the payload as poisoned — silent, permanent field-data loss. We
// persist into the tenant-scoped `field_captures` table (migration 0326) via a
// repo that binds the RLS tenant GUC (withTenantContext) so a cross-tenant
// write SURFACES rather than fake-succeeding. Idempotent on a client-supplied
// id so an at-least-once flush re-POST absorbs into the same row.
//
// NOTE on what is intentionally NOT built: the staff-app endpoint map also
// registers mining-residue keys (drill_hole→inspections, fuel_log→
// materials-logs, excavator_count, ppe_receipt, fingerprint_sign). Those are
// NOT real-estate entities; only attendance / task_ack / incident /
// shift_report are wired here. The residue keys remain 404 (their queue entries
// are not produced by the real-estate staff app).
// ============================================================================

// Each capture carries a client-supplied id (the offline-queue entry id) used
// as the idempotency key, plus optional property/unit scoping, an optional
// device-reported timestamp, and a type-specific body. The body is kept open
// (passthrough) per type but the envelope is strictly validated.
const FieldCaptureBodySchema = z.object({
  clientId: z.string().min(1).max(200),
  propertyId: z.string().min(1).max(200).optional().nullable(),
  unitId: z.string().min(1).max(200).optional().nullable(),
  // Device-reported event time. Kept as a permissive bounded string (NOT a
  // strict ISO datetime) so a minor client timestamp-format variance never
  // 422-drops an otherwise-valid offline capture — the DB column is TIMESTAMPTZ
  // and Postgres parses the common forms; a truly unparseable value surfaces as
  // a 22P02 → 400 (mapped), still retained-and-fixable rather than silent loss.
  capturedAt: z.string().min(1).max(64).optional().nullable(),
  // Some queue payloads nest the typed fields under `body`; others send them
  // flat. We accept both: an explicit `body` object wins, otherwise the
  // remaining fields are folded into the body below.
  body: z.record(z.unknown()).optional(),
}).passthrough();

function fieldRepo(c) {
  const db = (c.get('services') ?? {}).db;
  return db ? createEstateFieldIdentityRepo(db) : null;
}

function captureHandler(captureType: CaptureType) {
  return async (c) => {
    const repo = fieldRepo(c);
    if (!repo) return dbUnavailable(c);
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');

    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json(
        {
          success: false,
          error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
        },
        400,
      );
    }

    const parsed = FieldCaptureBodySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Field capture payload failed validation.',
            details: parsed.error.flatten(),
          },
        },
        422,
      );
    }

    const { clientId, propertyId, unitId, capturedAt, body, ...rest } = parsed.data;
    // Fold flat fields into the body when no explicit `body` object was sent,
    // so the typed payload is preserved either way. The envelope keys are
    // stripped from `rest` by the destructure above.
    const effectiveBody =
      body && typeof body === 'object'
        ? (body as Record<string, unknown>)
        : (rest as Record<string, unknown>);

    try {
      const record = await repo.saveFieldCapture({
        tenantId,
        staffId: userId,
        clientId,
        captureType,
        propertyId: propertyId ?? null,
        unitId: unitId ?? null,
        capturedAt: capturedAt ?? null,
        body: effectiveBody,
      });
      // 200 (not 201) on a deduped replay; 201 on a fresh insert. Either way
      // the client gets the durable record id so the optimistic "synced" badge
      // is now backed by real persistence.
      return c.json(
        { success: true, data: record },
        record.deduped ? 200 : 201,
      );
    } catch (err) {
      return routeCatch(c, err, {
        code: 'FIELD_CAPTURE_WRITE_FAILED',
        status: 503,
        fallback: 'Field capture write failed',
      });
    }
  };
}

app.post('/attendance', withSecurityEvents({ action: 'estate-manager-app.field-capture', resource: 'field-captures', severity: 'info' }, captureHandler('attendance')));
app.post('/task-acks', withSecurityEvents({ action: 'estate-manager-app.field-capture', resource: 'field-captures', severity: 'info' }, captureHandler('task_ack')));
app.post('/incidents', withSecurityEvents({ action: 'estate-manager-app.field-capture', resource: 'field-captures', severity: 'info' }, captureHandler('incident')));
app.post('/shift-reports', withSecurityEvents({ action: 'estate-manager-app.field-capture', resource: 'field-captures', severity: 'info' }, captureHandler('shift_report')));

// ============================================================================
// TENANT KYC + APPLICANT IDENTITY (#9) — renter-applicant self-service.
//
// apps/tenant-mobile/src/api/applicants.ts drives a renter's own identity:
//   POST /applicants/kyc                    submit KYC
//   GET  /applicants/kyc/:id/status         poll one KYC record (own only)
//   PUT/POST /applicants/profile            update profile (preferredLang persisted)
//   PUT  /applicants/profile/notifications  update notification prefs
// Backed by applicant_kyc + applicant_profile (migration 0327), tenant-scoped,
// keyed on the authenticated applicant_id from the JWT (never the body) so a
// renter can only ever read/write their own record. A KYC poll for a record
// that is not theirs returns a uniform 404 (anti-IDOR).
// ============================================================================

const KycSubmissionSchema = z.object({
  personal: z.object({
    fullName: z.string().min(1).max(300),
    phone: z.string().min(1).max(40),
    email: z.string().email(),
  }),
  nida: z.object({
    frontImageUri: z.string().min(1),
    backImageUri: z.string().min(1),
  }),
  company: z.object({
    tin: z.string().min(1).max(60),
    registrationDocUri: z.string().min(1),
    registrationDocName: z.string().min(1).max(300),
  }),
  aml: z.object({
    sourceOfFunds: z.string().min(1).max(2000),
    isPep: z.boolean(),
    sanctionsConsent: z.boolean(),
  }),
});

const ProfileUpdateSchema = z.object({
  companyName: z.string().min(1).max(300).optional(),
  preferredLang: z.enum(['sw', 'en']).optional(),
  phone: z.string().min(1).max(40).optional(),
});

const NotificationPrefsSchema = z.object({
  newListings: z.boolean(),
  bidUpdates: z.boolean(),
  documentReady: z.boolean(),
  priceAlerts: z.boolean(),
});

async function parseJsonBody(c): Promise<{ ok: true; value: unknown } | { ok: false; res: Response }> {
  try {
    return { ok: true, value: await c.req.json() };
  } catch {
    return {
      ok: false,
      res: c.json(
        {
          success: false,
          error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
        },
        400,
      ),
    };
  }
}

function validationError(c, error): Response {
  return c.json(
    {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload failed validation.',
        details: error.flatten(),
      },
    },
    422,
  );
}

app.post('/applicants/kyc', withSecurityEvents({ action: 'estate-manager-app.kyc-submit', resource: 'applicant-kyc', severity: 'info' }, async (c) => {
  const repo = fieldRepo(c);
  if (!repo) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const applicantId = c.get('userId');

  const bodyResult = await parseJsonBody(c);
  if (!bodyResult.ok) return bodyResult.res;
  const parsed = KycSubmissionSchema.safeParse(bodyResult.value);
  if (!parsed.success) return validationError(c, parsed.error);

  try {
    const record = await repo.submitKyc({
      tenantId,
      applicantId,
      personal: parsed.data.personal,
      nida: parsed.data.nida,
      company: parsed.data.company,
      aml: parsed.data.aml,
    });
    return c.json({ success: true, data: record }, 201);
  } catch (err) {
    return routeCatch(c, err, {
      code: 'KYC_SUBMIT_FAILED',
      status: 503,
      fallback: 'KYC submission failed',
    });
  }
}));

app.get('/applicants/kyc/:id/status', async (c) => {
  const repo = fieldRepo(c);
  if (!repo) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const applicantId = c.get('userId');
  const id = c.req.param('id');

  try {
    const record = await repo.getKycStatus(tenantId, applicantId, id);
    if (!record) {
      // Uniform 404 — a record that exists but belongs to another applicant is
      // indistinguishable from one that does not exist (anti-IDOR).
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'KYC record not found' } },
        404,
      );
    }
    return c.json({ success: true, data: record });
  } catch (err) {
    return routeCatch(c, err, {
      code: 'KYC_STATUS_FAILED',
      status: 503,
      fallback: 'KYC status query failed',
    });
  }
});

const profileUpsertHandler = async (c) => {
  const repo = fieldRepo(c);
  if (!repo) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const applicantId = c.get('userId');

  const bodyResult = await parseJsonBody(c);
  if (!bodyResult.ok) return bodyResult.res;
  const parsed = ProfileUpdateSchema.safeParse(bodyResult.value);
  if (!parsed.success) return validationError(c, parsed.error);

  try {
    const record = await repo.upsertProfile({
      tenantId,
      applicantId,
      companyName: parsed.data.companyName ?? null,
      phone: parsed.data.phone ?? null,
      preferredLang: parsed.data.preferredLang,
    });
    return c.json({ success: true, data: record });
  } catch (err) {
    return routeCatch(c, err, {
      code: 'PROFILE_UPDATE_FAILED',
      status: 503,
      fallback: 'Profile update failed',
    });
  }
};

// The tenant app calls POST today (applicants.ts) but the canonical verb for an
// idempotent full-object upsert is PUT — both are wired to the same handler.
app.post('/applicants/profile', withSecurityEvents({ action: 'estate-manager-app.profile-update', resource: 'applicant-profile', severity: 'info' }, profileUpsertHandler));
app.put('/applicants/profile', withSecurityEvents({ action: 'estate-manager-app.profile-update', resource: 'applicant-profile', severity: 'info' }, profileUpsertHandler));

const notificationPrefsHandler = async (c) => {
  const repo = fieldRepo(c);
  if (!repo) return dbUnavailable(c);
  const tenantId = c.get('tenantId');
  const applicantId = c.get('userId');

  const bodyResult = await parseJsonBody(c);
  if (!bodyResult.ok) return bodyResult.res;
  const parsed = NotificationPrefsSchema.safeParse(bodyResult.value);
  if (!parsed.success) return validationError(c, parsed.error);

  try {
    const record = await repo.updateNotificationPrefs({
      tenantId,
      applicantId,
      newListings: parsed.data.newListings,
      bidUpdates: parsed.data.bidUpdates,
      documentReady: parsed.data.documentReady,
      priceAlerts: parsed.data.priceAlerts,
    });
    // The tenant app's updateNotificationPrefs expects `data` to be the prefs
    // object; return the hydrated notification block.
    return c.json({ success: true, data: record.notifications });
  } catch (err) {
    return routeCatch(c, err, {
      code: 'NOTIFICATION_PREFS_FAILED',
      status: 503,
      fallback: 'Notification preferences update failed',
    });
  }
};

app.put('/applicants/profile/notifications', withSecurityEvents({ action: 'estate-manager-app.notif-prefs', resource: 'applicant-profile', severity: 'info' }, notificationPrefsHandler));
app.post('/applicants/profile/notifications', withSecurityEvents({ action: 'estate-manager-app.notif-prefs', resource: 'applicant-profile', severity: 'info' }, notificationPrefsHandler));

// Mutations route through the canonical tenant-scoped routers. The BFF
// never owned writes; these 501s make that explicit.
app.post('/work-orders/:id/triage', withSecurityEvents({ action: 'estate-manager-app.create', resource: 'estate-manager-app', severity: 'info' }, (c) => notImplemented(c, 'Triaging work orders')));
app.post('/work-orders/:id/approve', withSecurityEvents({ action: 'estate-manager-app.create', resource: 'estate-manager-app', severity: 'info' }, (c) => notImplemented(c, 'Approving work orders')));
app.post('/work-orders/:id/assign', withSecurityEvents({ action: 'estate-manager-app.create', resource: 'estate-manager-app', severity: 'info' }, (c) => notImplemented(c, 'Assigning vendors')));
app.post('/work-orders/:id/schedule', withSecurityEvents({ action: 'estate-manager-app.create', resource: 'estate-manager-app', severity: 'info' }, (c) => notImplemented(c, 'Scheduling work orders')));
app.post('/work-orders/:id/complete', withSecurityEvents({ action: 'estate-manager-app.create', resource: 'estate-manager-app', severity: 'info' }, (c) => notImplemented(c, 'Completing work orders')));
app.post('/work-orders/:id/verify', withSecurityEvents({ action: 'estate-manager-app.create', resource: 'estate-manager-app', severity: 'info' }, (c) => notImplemented(c, 'Verifying work orders')));
app.post('/inspections', withSecurityEvents({ action: 'estate-manager-app.create', resource: 'estate-manager-app', severity: 'info' }, (c) => notImplemented(c, 'Scheduling inspections')));
app.post('/inspections/:id/items', withSecurityEvents({ action: 'estate-manager-app.create', resource: 'estate-manager-app', severity: 'info' }, (c) => notImplemented(c, 'Recording inspection items')));
app.post('/inspections/:id/complete', withSecurityEvents({ action: 'estate-manager-app.create', resource: 'estate-manager-app', severity: 'info' }, (c) => notImplemented(c, 'Completing inspections')));
app.put('/units/:id/status', withSecurityEvents({ action: 'estate-manager-app.update', resource: 'estate-manager-app', severity: 'info' }, (c) => notImplemented(c, 'Updating unit status')));
app.post('/collections/action', withSecurityEvents({ action: 'estate-manager-app.create', resource: 'estate-manager-app', severity: 'info' }, (c) => notImplemented(c, 'Collection actions')));
app.post('/vendors/:id/flag', withSecurityEvents({ action: 'estate-manager-app.create', resource: 'estate-manager-app', severity: 'info' }, (c) => notImplemented(c, 'Flagging vendors')));
app.post('/vendors/:id/invoices/:invoiceId/approve', withSecurityEvents({ action: 'estate-manager-app.create', resource: 'estate-manager-app', severity: 'info' }, (c) => notImplemented(c, 'Approving vendor invoices')));

export const estateManagerAppRouter = app;
export default estateManagerAppRouter;
