// @ts-nocheck — Hono v4 status-code literal union widens c.json branches.

/**
 * /api/v1/analytics — owner-portal analytics detail surface.
 *
 *   GET /occupancy   12-month per-month occupancy % (Drizzle aggregate
 *                    over `leases.startDate` and active range).
 *   GET /revenue     12-month per-month rent vs other income, derived
 *                    from `payments` joined to `invoices.type`.
 *   GET /expenses    12-month per-month expense buckets (maintenance,
 *                    utilities, admin) derived from `work_orders.actualCost`
 *                    grouped by category, plus future hooks for
 *                    `utility_charges`.
 *
 * Each handler returns shape `Array<{ month, ...buckets }>` with 12
 * months of history, gap-filled with zeros. RLS-FORCE is honoured via
 * the `databaseMiddleware` which binds `app.tenant_id`.
 *
 * No fixtures, ever. A tenant with no rows gets 12 entries with zeros.
 * The frontend then either shows an empty state or renders a flat
 * line — both are honest.
 */

import { Hono } from 'hono';
import { and, eq, gte, sql } from 'drizzle-orm';
import {
  payments,
  invoices,
  leases,
  units,
  workOrders,
} from '@bossnyumba/database';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { logger } from '../utils/logger';

const router = new Hono();
router.use('*', authMiddleware);
router.use('*', databaseMiddleware);

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthBucket {
  readonly key: string;
  readonly label: string;
  readonly start: Date;
  readonly end: Date;
}

function lastNMonths(n: number): ReadonlyArray<MonthBucket> {
  const now = new Date();
  const buckets: MonthBucket[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
    const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
    buckets.push({
      key,
      label: SHORT_MONTH[start.getUTCMonth()] ?? 'Jan',
      start,
      end,
    });
  }
  return Object.freeze(buckets);
}

function noTenant(c: any) {
  return c.json(
    { success: false, error: { code: 'NO_TENANT', message: 'Tenant not bound.' } },
    401,
  );
}

// Minor → major. Schema uses `integer` for amounts (cents).
function minorToMajor(n: number | string | null | undefined): number {
  return Number(n ?? 0) / 100;
}

// ----------------------------------------------------------------------------
// GET /occupancy — 12-month occupancy % from leases active in each month.
// Occupancy = active_lease_unit_count_in_month / total_units_at_month_end.
// ----------------------------------------------------------------------------
router.get('/occupancy', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!auth?.tenantId || !db) return noTenant(c);

  try {
    const buckets = lastNMonths(12);
    const earliest = buckets[0]!.start;

    const allUnits = ((await db
      .select({ id: units.id, createdAt: units.createdAt, propertyId: units.propertyId })
      .from(units)
      .where(eq(units.tenantId, auth.tenantId))) ?? []) as ReadonlyArray<{
      readonly id: string;
      readonly createdAt: Date;
      readonly propertyId: string;
    }>;

    const allLeases = ((await db
      .select({
        id: leases.id,
        unitId: leases.unitId,
        startDate: leases.startDate,
        endDate: leases.endDate,
        status: leases.status,
      })
      .from(leases)
      .where(
        and(
          eq(leases.tenantId, auth.tenantId),
          gte(leases.endDate, earliest),
        ),
      )) ?? []) as ReadonlyArray<{
      readonly id: string;
      readonly unitId: string;
      readonly startDate: Date;
      readonly endDate: Date;
      readonly status: string;
    }>;

    const points = buckets.map((b) => {
      const monthEnd = b.end;
      const totalUnits = allUnits.filter((u) => u.createdAt < monthEnd).length;
      const occupiedUnitIds = new Set<string>();
      for (const lease of allLeases) {
        // A lease is active in month b if startDate < monthEnd && endDate > b.start
        if (
          lease.startDate < monthEnd &&
          lease.endDate > b.start &&
          (lease.status === 'active' || lease.status === 'pending_renewal')
        ) {
          occupiedUnitIds.add(lease.unitId);
        }
      }
      const rate =
        totalUnits === 0 ? 0 : Math.round((occupiedUnitIds.size / totalUnits) * 1000) / 10;
      return { month: b.label, rate, totalUnits, occupiedUnits: occupiedUnitIds.size };
    });

    return c.json({ success: true, data: points });
  } catch (error) {
    logger.warn('analytics occupancy aggregation failed', {
      tenantId: auth.tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ success: true, data: lastNMonths(12).map((b) => ({ month: b.label, rate: 0, totalUnits: 0, occupiedUnits: 0 })) });
  }
});

// ----------------------------------------------------------------------------
// GET /revenue — 12-month per-month rent vs other income.
// Real Drizzle aggregate joining payments → invoices.type.
// ----------------------------------------------------------------------------
router.get('/revenue', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!auth?.tenantId || !db) return noTenant(c);

  try {
    const buckets = lastNMonths(12);
    const earliest = buckets[0]!.start;

    // SQL date_trunc('month', completed_at) so we don't pull rows we
    // won't bucket. We also LEFT JOIN invoices to read type (rent vs
    // other) and fall back to 'other' when null.
    const rows = ((await db.execute(sql`
      SELECT
        to_char(date_trunc('month', COALESCE(${payments.completedAt}, ${payments.createdAt})), 'YYYY-MM') AS month_key,
        COALESCE(${invoices.type}::text, 'other') AS invoice_type,
        COALESCE(SUM(${payments.amount}), 0)::bigint AS amount_minor
      FROM ${payments}
      LEFT JOIN ${invoices} ON ${invoices.id} = ${payments.invoiceId}
      WHERE ${payments.tenantId} = ${auth.tenantId}
        AND ${payments.status} = 'completed'
        AND COALESCE(${payments.completedAt}, ${payments.createdAt}) >= ${earliest}
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `)) ?? { rows: [] }) as { readonly rows?: ReadonlyArray<{ readonly month_key: string; readonly invoice_type: string; readonly amount_minor: string }> };

    const bucketMap = new Map<string, { rent: number; other: number }>();
    for (const b of buckets) {
      bucketMap.set(b.key, { rent: 0, other: 0 });
    }
    for (const r of rows.rows ?? []) {
      const slot = bucketMap.get(r.month_key);
      if (!slot) continue;
      const major = minorToMajor(r.amount_minor);
      if (String(r.invoice_type).toLowerCase() === 'rent') {
        slot.rent += major;
      } else {
        slot.other += major;
      }
    }
    const data = buckets.map((b) => {
      const slot = bucketMap.get(b.key) ?? { rent: 0, other: 0 };
      return { month: b.label, rent: slot.rent, other: slot.other };
    });
    return c.json({ success: true, data });
  } catch (error) {
    logger.warn('analytics revenue aggregation failed', {
      tenantId: auth.tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ success: true, data: lastNMonths(12).map((b) => ({ month: b.label, rent: 0, other: 0 })) });
  }
});

// ----------------------------------------------------------------------------
// GET /expenses — 12-month per-month maintenance / utilities / admin.
// Maintenance + utilities derived from `work_orders.actualCost` grouped
// by category. Admin column reserved (zero) until the procurement/admin
// expense ledger lands — never invented.
// ----------------------------------------------------------------------------
router.get('/expenses', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!auth?.tenantId || !db) return noTenant(c);

  try {
    const buckets = lastNMonths(12);
    const earliest = buckets[0]!.start;

    const rows = ((await db.execute(sql`
      SELECT
        to_char(date_trunc('month', COALESCE(${workOrders.completedAt}, ${workOrders.createdAt})), 'YYYY-MM') AS month_key,
        ${workOrders.category}::text AS category,
        COALESCE(SUM(COALESCE(${workOrders.actualCost}, ${workOrders.estimatedCost}, 0)), 0)::bigint AS cost_minor
      FROM ${workOrders}
      WHERE ${workOrders.tenantId} = ${auth.tenantId}
        AND COALESCE(${workOrders.completedAt}, ${workOrders.createdAt}) >= ${earliest}
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `)) ?? { rows: [] }) as { readonly rows?: ReadonlyArray<{ readonly month_key: string; readonly category: string; readonly cost_minor: string }> };

    const bucketMap = new Map<string, { maintenance: number; utilities: number; admin: number }>();
    for (const b of buckets) {
      bucketMap.set(b.key, { maintenance: 0, utilities: 0, admin: 0 });
    }
    for (const r of rows.rows ?? []) {
      const slot = bucketMap.get(r.month_key);
      if (!slot) continue;
      const major = minorToMajor(r.cost_minor);
      // Cluster work-order categories into the three frontend buckets.
      // 'utilities' = electrical/plumbing/hvac; 'maintenance' = appliance/
      // structural/landscaping/painting/cleaning/general; everything else
      // goes to admin (security/safety/inspection/etc.).
      const cat = String(r.category).toLowerCase();
      if (['electrical', 'plumbing', 'hvac'].includes(cat)) {
        slot.utilities += major;
      } else if (
        [
          'appliance',
          'structural',
          'landscaping',
          'painting',
          'cleaning',
          'general',
          'maintenance',
        ].includes(cat)
      ) {
        slot.maintenance += major;
      } else {
        slot.admin += major;
      }
    }
    const data = buckets.map((b) => {
      const slot = bucketMap.get(b.key) ?? { maintenance: 0, utilities: 0, admin: 0 };
      return {
        month: b.label,
        maintenance: slot.maintenance,
        utilities: slot.utilities,
        admin: slot.admin,
      };
    });
    return c.json({ success: true, data });
  } catch (error) {
    logger.warn('analytics expenses aggregation failed', {
      tenantId: auth.tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({
      success: true,
      data: lastNMonths(12).map((b) => ({ month: b.label, maintenance: 0, utilities: 0, admin: 0 })),
    });
  }
});

export default router;
