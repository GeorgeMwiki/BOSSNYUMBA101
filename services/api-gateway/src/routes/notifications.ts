// @ts-nocheck — Hono v4 MiddlewareHandler status-code literal union widens
//   across multiple c.json branches; tracked with other routers already on nocheck.

/**
 * Notifications router — TWO surfaces under /api/v1/notifications.
 *
 * 1. APPLICANT INBOX (the tenant-mobile counterparty contract — primary).
 *    Backs apps/tenant-mobile/src/api/notifications.ts:
 *      GET  /                 — applicant-scoped inbox, FE shape
 *                               { data: { notifications, nextCursor } }
 *      POST /:id/read         — mark one notification read (read_at = now())
 *    Rows live in `applicant_notifications` (migration 0338), DOUBLE-scoped:
 *    tenant_id (RLS) AND applicant_user_id (the route filters every read /
 *    mark-read by the JWT subject so one renter can never see/mark another's
 *    notification — uniform 404 on others' rows; anti-IDOR on top of RLS).
 *    Bilingual title_sw/title_en/body_sw/body_en (single-locale render at the
 *    client per the active language).
 *
 *    Previously this surface read the OPERATOR `notification_dispatch_log`
 *    (no applicant_user_id, no read_at, a bare-array body) so the inbox was
 *    permanently empty and every POST /:id/read 404'd.
 *
 * 2. OPERATOR DISPATCH LOG (preserved, moved to an explicit sub-path).
 *      GET  /dispatch-log     — recent dispatch records (tenant-scoped)
 *      GET  /dispatch-log/:id — a single dispatch record
 *      GET  /unread/count     — flag-gated placeholder (in-app inbox count)
 */

import { Hono } from 'hono';
import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { applicantNotifications, notificationDispatchLog } from '@bossnyumba/database';
import { authMiddleware } from '../middleware/hono-auth';
import { getSharedPerTenantRateBudget } from '../middleware/per-tenant-rate-budget';
import { routeCatch } from '../utils/safe-error';

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', getSharedPerTenantRateBudget({ surface: 'api' }).handler);

function notConfigured(c) {
  return c.json(
    {
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Notifications database not configured — DATABASE_URL unset',
      },
    },
    503,
  );
}

function clampLimit(raw, fallback, max) {
  const n = raw ? Number(raw) : fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(n)));
}

/** Project an applicant_notifications row into the FE `TenantNotificationRow`. */
function toApplicantNotification(row) {
  const iso = (v) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
  return {
    id: String(row.id),
    applicant_tenant_id: String(row.applicant_tenant_id),
    applicant_user_id: String(row.applicant_user_id),
    landlord_tenant_id: row.landlord_tenant_id == null ? null : String(row.landlord_tenant_id),
    rfb_id: row.rfb_id == null ? null : String(row.rfb_id),
    response_id: row.response_id == null ? null : String(row.response_id),
    task_id: row.task_id == null ? null : String(row.task_id),
    kind: String(row.kind),
    title_sw: String(row.title_sw),
    title_en: String(row.title_en),
    body_sw: String(row.body_sw),
    body_en: String(row.body_en),
    payload: row.payload ?? {},
    read_at: iso(row.read_at),
    created_at: iso(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// 1. APPLICANT INBOX — the tenant-mobile counterparty contract.
// ---------------------------------------------------------------------------

// GET / — applicant-scoped inbox in the FE shape. Cursor is the created_at of
// the last row on the prior page (descending keyset pagination).
app.get('/', async (c) => {
  const services = c.get('services') ?? {};
  const db = services.db;
  if (!db) return notConfigured(c);
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const limit = clampLimit(c.req.query('limit'), 50, 200);
  const unreadOnly = c.req.query('unreadOnly') === 'true';
  const cursor = c.req.query('cursor');
  try {
    // Anti-IDOR: filter by applicant_user_id (the JWT subject) as well as the
    // tenant predicate RLS enforces. Fetch limit+1 to derive nextCursor.
    const predicates = [
      eq(applicantNotifications.tenantId, tenantId),
      eq(applicantNotifications.applicantUserId, userId),
    ];
    if (unreadOnly) predicates.push(isNull(applicantNotifications.readAt));
    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!Number.isNaN(cursorDate.getTime())) {
        predicates.push(lt(applicantNotifications.createdAt, cursorDate));
      }
    }
    const rows = await db
      .select()
      .from(applicantNotifications)
      .where(and(...predicates))
      .orderBy(desc(applicantNotifications.createdAt))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? last.createdAt instanceof Date
          ? last.createdAt.toISOString()
          : String(last.createdAt)
        : null;
    return c.json({
      success: true,
      data: {
        notifications: page.map(toApplicantNotification),
        nextCursor,
      },
    });
  } catch (error) {
    return routeCatch(c, error, {
      code: 'NOTIFICATIONS_UNAVAILABLE',
      status: 503,
      fallback: 'Query failed',
    });
  }
});

// POST /:id/read — mark one applicant notification read. The UPDATE carries the
// tenant + applicant predicate so a renter can only mark their OWN rows; zero
// rows affected (wrong owner / missing) returns a uniform 404 (never leaks
// which). Idempotent: re-reading an already-read row still returns success.
app.post('/:id/read', async (c) => {
  const services = c.get('services') ?? {};
  const db = services.db;
  if (!db) return notConfigured(c);
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const id = c.req.param('id');
  try {
    const updated = await db
      .update(applicantNotifications)
      .set({ readAt: sql`COALESCE(${applicantNotifications.readAt}, now())` })
      .where(
        and(
          eq(applicantNotifications.id, id),
          eq(applicantNotifications.tenantId, tenantId),
          eq(applicantNotifications.applicantUserId, userId),
        ),
      )
      .returning({ id: applicantNotifications.id, readAt: applicantNotifications.readAt });
    const row = updated[0];
    if (!row) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } },
        404,
      );
    }
    return c.json({
      success: true,
      data: {
        id: String(row.id),
        read_at:
          row.readAt instanceof Date ? row.readAt.toISOString() : String(row.readAt ?? ''),
      },
    });
  } catch (error) {
    return routeCatch(c, error, {
      code: 'NOTIFICATIONS_UNAVAILABLE',
      status: 503,
      fallback: 'Mark-read failed',
    });
  }
});

// ---------------------------------------------------------------------------
// 2. OPERATOR DISPATCH LOG — preserved on an explicit sub-path.
// ---------------------------------------------------------------------------

app.get('/dispatch-log', async (c) => {
  const services = c.get('services') ?? {};
  const db = services.db;
  if (!db) return notConfigured(c);
  const tenantId = c.get('tenantId');
  const limit = clampLimit(c.req.query('limit'), 50, 500);
  try {
    const rows = await db
      .select()
      .from(notificationDispatchLog)
      .where(eq(notificationDispatchLog.tenantId, tenantId))
      .orderBy(desc(notificationDispatchLog.createdAt))
      .limit(limit);
    return c.json({ success: true, data: rows });
  } catch (error) {
    return routeCatch(c, error, {
      code: 'NOTIFICATIONS_UNAVAILABLE',
      status: 503,
      fallback: 'Query failed',
    });
  }
});

app.get('/unread/count', async (c) => {
  const services = c.get('services') ?? {};
  const db = services.db;
  if (!db) return notConfigured(c);
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  try {
    // Now that the applicant inbox is landed, unread-count is a live query over
    // applicant_notifications scoped to the JWT subject (anti-IDOR).
    const [row] = await db
      .select({ unread: sql`count(*)::int` })
      .from(applicantNotifications)
      .where(
        and(
          eq(applicantNotifications.tenantId, tenantId),
          eq(applicantNotifications.applicantUserId, userId),
          isNull(applicantNotifications.readAt),
        ),
      );
    return c.json({ success: true, data: { unread: Number(row?.unread ?? 0) } });
  } catch (error) {
    return routeCatch(c, error, {
      code: 'NOTIFICATIONS_UNAVAILABLE',
      status: 503,
      fallback: 'Query failed',
    });
  }
});

export const notificationsRouter = app;
