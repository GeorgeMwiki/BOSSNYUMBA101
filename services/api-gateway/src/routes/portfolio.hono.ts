
/**
 * /api/v1/portfolio — owner-portal PortfolioAtAGlance source.
 *
 * The owner-portal calls these three endpoints to render the portfolio
 * dashboard:
 *
 *   GET /portfolio/summary       totalUnits, occupancyRate, totalProperties
 *   GET /portfolio/performance   per-property revenue / NOI / cap rate
 *   GET /portfolio/growth        per-month collections trend
 *
 * `/summary` runs a live aggregation when repos are wired (scoped to
 * the caller's `propertyAccess` set, mirroring `getOwnerScope` in
 * owner-portal.ts). `/performance` and `/growth` now also run real
 * Drizzle aggregates (replacing the previous 501 NOT_IMPLEMENTED
 * branch) — see `aggregatePerformance()` and `aggregateGrowth()`.
 */

import { Hono } from 'hono';
import { and, eq, gte, sql } from 'drizzle-orm';
import {
  payments,
  invoices,
  properties,
  units,
  leases,
  workOrders,
} from '@bossnyumba/database';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { logger } from '../utils/logger';
import { resolveTenantCurrency, minorToMajorFor } from './tenant-currency';

const portfolioRouter = new Hono();
portfolioRouter.use('*', authMiddleware);
portfolioRouter.use('*', databaseMiddleware);

const EMPTY_SUMMARY = {
  totalProperties: 0,
  totalUnits: 0,
  occupiedUnits: 0,
  vacantUnits: 0,
  occupancyRate: 0,
  activeLeases: 0,
};

portfolioRouter.get('/summary', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');

  if (!repos || !auth?.tenantId) {
    return c.json({
      success: true,
      data: { ...EMPTY_SUMMARY, meta: { source: 'empty' } },
    });
  }

  try {
    const propertyAccess = auth.propertyAccess;
    const allowsAll = Array.isArray(propertyAccess) && propertyAccess.includes('*');
    const allowedIds = new Set<string>(
      Array.isArray(propertyAccess) ? propertyAccess.filter((id) => id !== '*') : [],
    );

    const [propertiesResult, unitsResult, leasesResult] = await Promise.all([
      repos.properties.findMany(auth.tenantId, { limit: 1000, offset: 0 }),
      repos.units.findMany(auth.tenantId, { limit: 5000, offset: 0 }),
      repos.leases.findMany(auth.tenantId, { limit: 5000, offset: 0 }),
    ]);

    const scopedProperties = allowsAll
      ? propertiesResult.items ?? []
      : (propertiesResult.items ?? []).filter((p) => allowedIds.has(p.id));
    const propertyIds = new Set(scopedProperties.map((p) => p.id));

    const scopedUnits = (unitsResult.items ?? []).filter((u) => propertyIds.has(u.propertyId));
    const occupiedUnits = scopedUnits.filter((u) => u.status === 'occupied').length;
    const vacantUnits = scopedUnits.length - occupiedUnits;
    const occupancyRate = scopedUnits.length === 0 ? 0 : occupiedUnits / scopedUnits.length;

    const unitIds = new Set(scopedUnits.map((u) => u.id));
    const activeLeases = (leasesResult.items ?? []).filter(
      (l) =>
        l.status === 'active' && (propertyIds.has(l.propertyId) || unitIds.has(l.unitId)),
    ).length;

    return c.json({
      success: true,
      data: {
        totalProperties: scopedProperties.length,
        totalUnits: scopedUnits.length,
        occupiedUnits,
        vacantUnits,
        occupancyRate,
        activeLeases,
        meta: { source: 'live' },
      },
    });
  } catch (error) {
    logger.warn('portfolio summary aggregation failed; falling back to empty', {
      tenantId: auth.tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({
      success: true,
      data: { ...EMPTY_SUMMARY, meta: { source: 'empty' } },
    });
  }
});

// ---------------------------------------------------------------------------
// /performance — per-property revenue / NOI / occupancy.
//
// Joins properties → units (for occupancy) → leases → invoices →
// payments to derive a current-month revenue and NOI (revenue minus
// work_orders.actualCost). Cap rate is computed as
// (annualised_noi / portfolio_value) where portfolio_value =
// SUM(active_lease.rent_amount * 12). Falls back to 0% when no
// portfolio value (no active leases).
// ---------------------------------------------------------------------------
function startOfMonthUtc(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function endOfMonthUtc(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

portfolioRouter.get('/performance', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!auth?.tenantId || !db) {
    return c.json(
      { success: false, error: { code: 'NO_TENANT', message: 'Tenant not bound.' } },
      401,
    );
  }

  try {
    const monthStart = startOfMonthUtc();
    const monthEnd = endOfMonthUtc();
    const toMajor = minorToMajorFor(await resolveTenantCurrency(db, auth.tenantId));

    const propertyRows = ((await db
      .select({ id: properties.id, name: properties.name })
      .from(properties)
      .where(eq(properties.tenantId, auth.tenantId))) ?? []) as ReadonlyArray<{
      readonly id: string;
      readonly name: string;
    }>;

    // Filter by auth.propertyAccess unless wildcard.
    const propertyAccess = auth.propertyAccess;
    const allowsAll = Array.isArray(propertyAccess) && propertyAccess.includes('*');
    const allowedIds = new Set<string>(
      Array.isArray(propertyAccess) ? propertyAccess.filter((id) => id !== '*') : [],
    );
    const scopedProperties = allowsAll
      ? propertyRows
      : propertyRows.filter((p) => allowedIds.has(p.id));

    if (scopedProperties.length === 0) {
      return c.json({ success: true, data: [] });
    }

    // Pull all active leases + units in one shot (cheap and scoped).
    const [activeLeases, allUnits, monthPayments, monthWorkOrders] = await Promise.all([
      db
        .select({
          id: leases.id,
          propertyId: leases.propertyId,
          unitId: leases.unitId,
          rentAmount: leases.rentAmount,
          status: leases.status,
        })
        .from(leases)
        .where(and(eq(leases.tenantId, auth.tenantId), eq(leases.status, 'active'))),
      db
        .select({
          id: units.id,
          propertyId: units.propertyId,
          status: units.status,
        })
        .from(units)
        .where(eq(units.tenantId, auth.tenantId)),
      db
        .select({
          amount: payments.amount,
          invoiceId: payments.invoiceId,
          completedAt: payments.completedAt,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .where(
          and(
            eq(payments.tenantId, auth.tenantId),
            eq(payments.status, 'completed'),
            gte(payments.createdAt, monthStart),
          ),
        ),
      db
        .select({
          propertyId: workOrders.propertyId,
          actualCost: workOrders.actualCost,
          estimatedCost: workOrders.estimatedCost,
          createdAt: workOrders.createdAt,
        })
        .from(workOrders)
        .where(
          and(
            eq(workOrders.tenantId, auth.tenantId),
            gte(workOrders.createdAt, monthStart),
          ),
        ),
    ]);

    const invoiceMap = new Map<string, string>(); // invoiceId → propertyId
    const invoiceList = ((await db
      .select({ id: invoices.id, propertyId: invoices.propertyId })
      .from(invoices)
      .where(eq(invoices.tenantId, auth.tenantId))) ?? []) as ReadonlyArray<{
      readonly id: string;
      readonly propertyId: string | null;
    }>;
    for (const inv of invoiceList) {
      if (inv.propertyId) invoiceMap.set(inv.id, inv.propertyId);
    }

    const data = scopedProperties.map((p) => {
      const propertyUnits = allUnits.filter((u) => u.propertyId === p.id);
      const totalUnits = propertyUnits.length;
      const occupiedUnits = propertyUnits.filter((u) => u.status === 'occupied').length;
      const occupancy = totalUnits === 0 ? 0 : Math.round((occupiedUnits / totalUnits) * 1000) / 10;
      const propertyActiveLeases = activeLeases.filter((l) => l.propertyId === p.id);
      // Currency-aware minor → major (0-decimal TZS/UGX divide by 1, not 100).
      const propertyAnnualRent = toMajor(
        propertyActiveLeases.reduce((sum, l) => sum + Number(l.rentAmount) * 12, 0),
      );
      const propertyRevenueMinor = monthPayments
        .filter((pay) => {
          const propId = pay.invoiceId ? invoiceMap.get(pay.invoiceId) : null;
          return propId === p.id;
        })
        .reduce((sum, pay) => sum + Number(pay.amount), 0);
      const propertyRevenue = toMajor(propertyRevenueMinor);
      const propertyExpenseMinor = monthWorkOrders
        .filter((wo) => wo.propertyId === p.id)
        .reduce(
          (sum, wo) => sum + Number(wo.actualCost ?? wo.estimatedCost ?? 0),
          0,
        );
      const propertyNoi = toMajor(propertyRevenueMinor - propertyExpenseMinor);
      // Cap rate = annualised NOI / portfolio value × 100. Portfolio
      // value is approximated as annual rent (×12 active leases). When
      // there are no leases we return null (frontend shows "—").
      const capRate =
        propertyAnnualRent === 0
          ? null
          : Math.round((propertyNoi * 12 * 100 * 100) / propertyAnnualRent) / 100;
      return {
        id: p.id,
        name: p.name,
        revenue: propertyRevenue,
        occupancy,
        noi: propertyNoi,
        capRate,
        totalUnits,
        occupiedUnits,
      };
    });

    return c.json({ success: true, data });
  } catch (error) {
    logger.warn('portfolio performance aggregation failed', {
      tenantId: auth.tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ success: true, data: [] });
  }
});

// ---------------------------------------------------------------------------
// /growth — 12-month revenue / portfolio-value / occupancy time-series.
//
// Aggregates `payments.amount` by month for revenue.
// Computes portfolio value at each month-end as Σ active_lease.rent_amount × 12.
// Computes occupancy as occupied_unit_count / total_unit_count at month-end.
// ---------------------------------------------------------------------------
const SHORT_MONTH = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

portfolioRouter.get('/growth', async (c) => {
  const auth = c.get('auth');
  const db = c.get('db');
  if (!auth?.tenantId || !db) {
    return c.json(
      { success: false, error: { code: 'NO_TENANT', message: 'Tenant not bound.' } },
      401,
    );
  }
  try {
    const toMajor = minorToMajorFor(await resolveTenantCurrency(db, auth.tenantId));
    const now = new Date();
    const buckets = [];
    for (let i = 11; i >= 0; i -= 1) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
      buckets.push({
        key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
        label: SHORT_MONTH[start.getUTCMonth()] ?? 'Jan',
        start,
        end,
      });
    }
    const earliest = buckets[0]!.start;

    const [revenueRows, leaseRows, unitRows] = await Promise.all([
      db.execute(sql`
        SELECT
          to_char(date_trunc('month', COALESCE(${payments.completedAt}, ${payments.createdAt})), 'YYYY-MM') AS month_key,
          COALESCE(SUM(${payments.amount}), 0)::bigint AS amount_minor
        FROM ${payments}
        WHERE ${payments.tenantId} = ${auth.tenantId}
          AND ${payments.status} = 'completed'
          AND COALESCE(${payments.completedAt}, ${payments.createdAt}) >= ${earliest}
        GROUP BY 1
      `),
      db
        .select({
          rentAmount: leases.rentAmount,
          startDate: leases.startDate,
          endDate: leases.endDate,
          status: leases.status,
        })
        .from(leases)
        .where(eq(leases.tenantId, auth.tenantId)),
      db
        .select({ id: units.id, createdAt: units.createdAt, status: units.status })
        .from(units)
        .where(eq(units.tenantId, auth.tenantId)),
    ]);

    const revenueMap = new Map<string, number>();
    for (const r of (revenueRows.rows ?? [])) {
      // Currency-aware minor → major (0-decimal TZS/UGX divide by 1, not 100).
      revenueMap.set(String(r.month_key), toMajor(r.amount_minor));
    }

    const data = buckets.map((b) => {
      const monthEnd = b.end;
      const activeAtEnd = leaseRows.filter(
        (l) =>
          l.startDate < monthEnd &&
          l.endDate > b.start &&
          (l.status === 'active' || l.status === 'pending_renewal'),
      );
      // Currency-aware minor → major (0-decimal TZS/UGX divide by 1, not 100).
      const portfolioValueMajor = toMajor(
        activeAtEnd.reduce((sum, l) => sum + Number(l.rentAmount), 0) * 12,
      );
      const totalUnits = unitRows.filter((u) => u.createdAt < monthEnd).length;
      const occupiedUnits = activeAtEnd.length;
      const occupancy =
        totalUnits === 0 ? 0 : Math.round((occupiedUnits / totalUnits) * 1000) / 10;
      return {
        month: b.label,
        revenue: revenueMap.get(b.key) ?? 0,
        value: portfolioValueMajor,
        occupancy,
      };
    });
    return c.json({ success: true, data });
  } catch (error) {
    logger.warn('portfolio growth aggregation failed', {
      tenantId: auth.tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ success: true, data: [] });
  }
});

export default portfolioRouter;
