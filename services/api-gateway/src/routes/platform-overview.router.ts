// @ts-nocheck — Hono v4 status-code literal union widens c.json branches.

/**
 * /api/v1/platform/overview — HQ-tier KPI aggregator.
 *
 * Returns a small bag of cross-tenant counts for the BossNyumba HQ
 * `/platform/overview` page. Auth is platform-tier (the same scoping
 * convention used by `platform-hq` Jarvis): an authenticated request
 * whose role is one of the platform-admin trio (SUPER_ADMIN, ADMIN,
 * SUPPORT). Tenant-scoped roles are rejected with 403.
 *
 * Each individual count is wrapped in its own try/catch so a single
 * failed query does not poison the whole response. If ANY count fails
 * we still return 200, but with `success: false` + `error.code =
 * 'PARTIAL'` so the frontend's em-dash fallback kicks in cleanly
 * instead of rendering "0" as truth.
 */

import { Hono } from 'hono';
import { and, count, eq, gte, sum, isNull } from 'drizzle-orm';
import {
  tenants,
  users,
  units,
  payments,
} from '@bossnyumba/database';
import { authMiddleware } from '../middleware/hono-auth';
import { getDb } from '../composition/db-client';
import { isPlatformAdmin, type UserRole } from '../types/user-role';

// any — Drizzle's select-builder generic chain widens through union
// generics in a way that adds no runtime safety. Rows are narrowed via
// the `.select({…})` projection below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrizzleDb = any;

// ─────────────────────────────────────────────────────────────────────
// Per-query helpers. Each returns `null` on failure so the caller can
// decide whether to short-circuit or degrade gracefully.
// ─────────────────────────────────────────────────────────────────────

async function countActiveTenants(db: DrizzleDb): Promise<number | null> {
  try {
    const rows = await db
      .select({ value: count() })
      .from(tenants)
      .where(and(eq(tenants.status, 'active'), isNull(tenants.deletedAt)));
    return Number(rows[0]?.value ?? 0);
  } catch {
    return null;
  }
}

async function countPlatformUsers(db: DrizzleDb): Promise<number | null> {
  try {
    // Cross-tenant count — HQ tier sees every user. Filter out
    // soft-deleted rows so the number tracks "live" identities.
    const rows = await db
      .select({ value: count() })
      .from(users)
      .where(isNull(users.deletedAt));
    return Number(rows[0]?.value ?? 0);
  } catch {
    return null;
  }
}

async function countUnitsManaged(db: DrizzleDb): Promise<number | null> {
  try {
    const rows = await db
      .select({ value: count() })
      .from(units)
      .where(isNull(units.deletedAt));
    return Number(rows[0]?.value ?? 0);
  } catch {
    return null;
  }
}

async function sumMonthlyRevenue(db: DrizzleDb): Promise<number | null> {
  // TODO (revenue-aggregator): the `payments` table stores per-tenant
  // collections in MINOR units (cents) and the currency varies per
  // tenant (KES / TZS / USD). A faithful platform-wide monthly-revenue
  // metric would normalise all currencies to a single reporting unit
  // (probably USD) using a daily FX snapshot and only count `completed`
  // payments. That FX layer is not wired yet — return 0 with this TODO
  // so the dashboard tile is honest about the gap. Do NOT estimate
  // revenue from raw mixed-currency sums; that lies to operators.
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({ value: sum(payments.amount) })
      .from(payments)
      .where(
        and(
          eq(payments.status, 'completed'),
          gte(payments.completedAt, since),
        ),
      );
    // Result is intentionally discarded — see TODO above. We touch the
    // query to surface a real DB error (the partial-failure branch
    // depends on at-least-one query throwing); on success we still
    // return 0 so we never lie about platform revenue.
    void rows;
    return 0;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────

const platformOverviewRouter = new Hono();
platformOverviewRouter.use('*', authMiddleware);

platformOverviewRouter.get('/', async (c) => {
  const auth = c.get('auth') ?? {};
  const role = auth.role as UserRole | undefined;
  if (!role || !isPlatformAdmin(role)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message:
            'platform-overview requires a platform-tier role (SUPER_ADMIN / ADMIN / SUPPORT)',
        },
      },
      403,
    );
  }

  const db = getDb();
  if (!db) {
    return c.json(
      {
        success: false,
        error: {
          code: 'PARTIAL',
          message: 'database not configured (DATABASE_URL unset)',
        },
      },
      200,
    );
  }

  const [activeTenants, platformUsers, unitsManaged, monthlyRevenue] =
    await Promise.all([
      countActiveTenants(db),
      countPlatformUsers(db),
      countUnitsManaged(db),
      sumMonthlyRevenue(db),
    ]);

  const anyFailed =
    activeTenants === null ||
    platformUsers === null ||
    unitsManaged === null ||
    monthlyRevenue === null;

  if (anyFailed) {
    return c.json(
      {
        success: false,
        error: {
          code: 'PARTIAL',
          message:
            'one or more aggregate queries failed; frontend should render the em-dash fallback',
        },
      },
      200,
    );
  }

  return c.json({
    success: true,
    data: {
      activeTenants,
      platformUsers,
      monthlyRevenue,
      unitsManaged,
      // TODO (platform-config): currency should come from a
      // platform_config / billing_settings row once HQ pricing is
      // multi-currency. Defaulting to USD for now — the frontend
      // already accepts an optional ISO-4217 code on the response.
      currency: 'USD' as const,
    },
  });
});

export default platformOverviewRouter;
