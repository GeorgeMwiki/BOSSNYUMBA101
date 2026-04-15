// @ts-nocheck

/**
 * Analytics / KPI routes
 *
 * Returns REAL, DB-backed owner KPIs plus period-over-period deltas.
 * Exposed under `/api/v1/analytics/*`.
 *
 * Endpoints:
 *   GET /summary      -> 4 headline KPIs (collection rate, occupancy, arrears, open tickets)
 *                       each with { value, delta, previous, unit }
 *   GET /occupancy    -> monthly occupancy trend (6 months)
 *   GET /revenue      -> monthly revenue split (rent vs other) (7 months)
 *   GET /expenses     -> monthly expense split by category (7 months)
 *   GET /arrears      -> aging buckets + totals
 *   GET /maintenance  -> work-order KPI summary
 *
 * All endpoints are tenant-scoped via authMiddleware and honour propertyAccess.
 *
 * NOTE: Data is aggregated in JS after fetching via the repository abstraction.
 * When repo query limits are hit (>5000) the numbers may be partial; at that
 * point push aggregation into SQL via SQLKPIDataProvider (see TODO below).
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { UserRole } from '../types/user-role';
import {
  mapInvoiceRow,
  mapPaymentRow,
  mapUnitRow,
  mapWorkOrderRow,
  mapLeaseRow,
  mapPropertyRow,
} from './db-mappers';

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function previousMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

function isWithinRange(dateValue, start, end) {
  if (!dateValue) return false;
  const value = new Date(dateValue);
  return value >= start && value <= end;
}

function computeDelta(current, previous) {
  // For absolute-count / absolute-currency KPIs callers treat this as "points / units change"
  if (previous === 0 || previous === null || previous === undefined) {
    if (current === 0) return 0;
    return null; // undefined baseline -> no comparable delta
  }
  return current - previous;
}

function computePercentChange(current, previous) {
  if (previous === 0 || previous === null || previous === undefined) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

// ---------------------------------------------------------------------------
// Scope helper — matches dashboard.hono.ts semantics so the owner sees the
// same numbers on the KPI cards as on the legacy owner dashboard.
// ---------------------------------------------------------------------------

async function getScopedOwnerData(auth, repos) {
  const propertyResult = await repos.properties.findMany(auth.tenantId, {
    limit: 2000,
    offset: 0,
  });
  const allProperties = propertyResult.items;
  const properties = auth.propertyAccess?.includes('*')
    ? allProperties
    : allProperties.filter((property) => auth.propertyAccess?.includes(property.id));

  const propertyIds = new Set(properties.map((property) => property.id));

  const [unitsResult, leasesResult, invoicesResult, paymentsResult, workOrdersResult] =
    await Promise.all([
      repos.units.findMany(auth.tenantId, { limit: 5000, offset: 0 }),
      repos.leases.findMany(auth.tenantId, { limit: 5000, offset: 0 }),
      repos.invoices.findMany(auth.tenantId, 5000, 0),
      repos.payments.findMany(auth.tenantId, 5000, 0),
      repos.workOrders.findMany(auth.tenantId, 5000, 0),
    ]);

  const scopedUnits = unitsResult.items.filter((unit) => propertyIds.has(unit.propertyId));
  const scopedUnitIds = new Set(scopedUnits.map((unit) => unit.id));
  const scopedLeases = leasesResult.items.filter(
    (lease) => propertyIds.has(lease.propertyId) || scopedUnitIds.has(lease.unitId)
  );
  const scopedLeaseIds = new Set(scopedLeases.map((lease) => lease.id));
  const scopedCustomerIds = new Set(scopedLeases.map((lease) => lease.customerId));
  const scopedInvoices = invoicesResult.items.filter(
    (invoice) =>
      (invoice.leaseId && scopedLeaseIds.has(invoice.leaseId)) ||
      (invoice.customerId && scopedCustomerIds.has(invoice.customerId))
  );
  const scopedInvoiceIds = new Set(scopedInvoices.map((invoice) => invoice.id));
  const scopedPayments = paymentsResult.items.filter(
    (payment) =>
      (payment.leaseId && scopedLeaseIds.has(payment.leaseId)) ||
      (payment.customerId && scopedCustomerIds.has(payment.customerId)) ||
      (payment.invoiceId && scopedInvoiceIds.has(payment.invoiceId))
  );
  const scopedWorkOrders = workOrdersResult.items.filter((workOrder) =>
    propertyIds.has(workOrder.propertyId)
  );

  return {
    properties: properties.map(mapPropertyRow),
    units: scopedUnits.map(mapUnitRow),
    leases: scopedLeases.map(mapLeaseRow),
    invoices: scopedInvoices.map(mapInvoiceRow),
    payments: scopedPayments.map(mapPaymentRow),
    workOrders: scopedWorkOrders.map(mapWorkOrderRow),
  };
}

// ---------------------------------------------------------------------------
// Core KPI computations (current-period + previous-period for deltas)
// ---------------------------------------------------------------------------

function computeSummary(scope, now = new Date()) {
  const curStart = startOfMonth(now);
  const curEnd = endOfMonth(now);
  const prevRef = previousMonth(now);
  const prevStart = startOfMonth(prevRef);
  const prevEnd = endOfMonth(prevRef);

  const paymentsIn = (payment, start, end) =>
    isWithinRange(payment.completedAt || payment.createdAt, start, end);
  const invoicesIn = (invoice, start, end) =>
    isWithinRange(invoice.createdAt, start, end);

  // Collection rate = collected / invoiced for the month
  const curCollected = scope.payments
    .filter((p) => paymentsIn(p, curStart, curEnd))
    .reduce((sum, p) => sum + p.amount, 0);
  const curInvoiced = scope.invoices
    .filter((i) => invoicesIn(i, curStart, curEnd))
    .reduce((sum, i) => sum + i.total, 0);
  const prevCollected = scope.payments
    .filter((p) => paymentsIn(p, prevStart, prevEnd))
    .reduce((sum, p) => sum + p.amount, 0);
  const prevInvoiced = scope.invoices
    .filter((i) => invoicesIn(i, prevStart, prevEnd))
    .reduce((sum, i) => sum + i.total, 0);

  const curCollectionRate = curInvoiced > 0 ? (curCollected / curInvoiced) * 100 : 0;
  const prevCollectionRate = prevInvoiced > 0 ? (prevCollected / prevInvoiced) * 100 : 0;

  // Occupancy — current snapshot vs. leases that were active a month ago
  const totalUnits = scope.units.length;
  const occupiedNow = scope.units.filter((u) => u.status === 'OCCUPIED').length;
  const occupancyNow = totalUnits > 0 ? (occupiedNow / totalUnits) * 100 : 0;

  // Approximate last-month occupancy: leases active at prevEnd that mapped to a known unit
  const prevOccupiedUnits = new Set(
    scope.leases
      .filter(
        (lease) =>
          lease.unitId &&
          lease.startDate &&
          new Date(lease.startDate) <= prevEnd &&
          (!lease.endDate || new Date(lease.endDate) >= prevStart)
      )
      .map((lease) => lease.unitId)
  );
  const occupancyPrev = totalUnits > 0 ? (prevOccupiedUnits.size / totalUnits) * 100 : 0;

  // Arrears total — sum amountDue on overdue invoices (any age)
  const arrearsNow = scope.invoices
    .filter(
      (i) => i.status === 'OVERDUE' || (i.amountDue > 0 && new Date(i.dueDate) < now)
    )
    .reduce((sum, i) => sum + i.amountDue, 0);
  const arrearsPrev = scope.invoices
    .filter(
      (i) =>
        i.amountDue > 0 &&
        new Date(i.dueDate) < prevEnd &&
        new Date(i.dueDate) >= new Date(1970, 0, 1)
    )
    .reduce((sum, i) => sum + i.amountDue, 0);

  // Open maintenance tickets (open = not completed/cancelled/rejected)
  const closedStatuses = new Set(['COMPLETED', 'CANCELLED', 'REJECTED']);
  const openNow = scope.workOrders.filter((w) => !closedStatuses.has(w.status)).length;
  // Previous: work orders created before prevEnd that had not reached a terminal
  // status by prevEnd. We can't travel time on the row, so approximate by
  // counting WOs created in the prior month and not completed within it.
  const openPrev = scope.workOrders.filter((w) => {
    if (!isWithinRange(w.createdAt, prevStart, prevEnd)) return false;
    if (!w.completedAt) return true;
    return new Date(w.completedAt) > prevEnd;
  }).length;

  return {
    collectionRate: {
      value: Math.round(curCollectionRate * 10) / 10,
      previous: Math.round(prevCollectionRate * 10) / 10,
      delta: Math.round(computeDelta(curCollectionRate, prevCollectionRate) * 10) / 10,
      unit: 'percent',
    },
    occupancy: {
      value: Math.round(occupancyNow * 10) / 10,
      previous: Math.round(occupancyPrev * 10) / 10,
      delta: Math.round(computeDelta(occupancyNow, occupancyPrev) * 10) / 10,
      unit: 'percent',
    },
    arrears: {
      value: arrearsNow,
      previous: arrearsPrev,
      delta: computeDelta(arrearsNow, arrearsPrev),
      unit: 'currency',
    },
    openTickets: {
      value: openNow,
      previous: openPrev,
      delta: computeDelta(openNow, openPrev),
      unit: 'count',
    },
    // Extras the web dashboard consumes
    revenue: {
      value: curCollected,
      previous: prevCollected,
      delta: computeDelta(curCollected, prevCollected),
      changePercent: Math.round(computePercentChange(curCollected, prevCollected) * 10) / 10,
      unit: 'currency',
    },
    meta: {
      generatedAt: now.toISOString(),
      periodStart: curStart.toISOString(),
      periodEnd: curEnd.toISOString(),
      previousPeriodStart: prevStart.toISOString(),
      previousPeriodEnd: prevEnd.toISOString(),
    },
  };
}

function buildMonthlyBuckets(months, now = new Date()) {
  const buckets = [];
  for (let index = months - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    buckets.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      month: date.toLocaleDateString('en-KE', { month: 'short' }),
      start: startOfMonth(date),
      end: endOfMonth(date),
    });
  }
  return buckets;
}

function computeOccupancyTrend(scope, months = 6, now = new Date()) {
  const buckets = buildMonthlyBuckets(months, now);
  const totalUnits = scope.units.length;

  return buckets.map((bucket) => {
    const occupied = new Set(
      scope.leases
        .filter(
          (lease) =>
            lease.unitId &&
            lease.startDate &&
            new Date(lease.startDate) <= bucket.end &&
            (!lease.endDate || new Date(lease.endDate) >= bucket.start)
        )
        .map((lease) => lease.unitId)
    ).size;
    return {
      month: bucket.month,
      rate: totalUnits > 0 ? Math.round((occupied / totalUnits) * 1000) / 10 : 0,
    };
  });
}

function computeRevenueTrend(scope, months = 7, now = new Date()) {
  const buckets = buildMonthlyBuckets(months, now);

  return buckets.map((bucket) => {
    const monthPayments = scope.payments.filter((payment) =>
      isWithinRange(payment.completedAt || payment.createdAt, bucket.start, bucket.end)
    );
    const rent = monthPayments
      .filter((p) => (p.paymentType || '').toLowerCase() === 'rent' || !p.paymentType)
      .reduce((sum, p) => sum + p.amount, 0);
    const other = monthPayments
      .filter((p) => (p.paymentType || '').toLowerCase() !== 'rent' && p.paymentType)
      .reduce((sum, p) => sum + p.amount, 0);
    return { month: bucket.month, rent, other };
  });
}

function computeExpenseTrend(scope, months = 7, now = new Date()) {
  const buckets = buildMonthlyBuckets(months, now);

  return buckets.map((bucket) => {
    const monthWorkOrders = scope.workOrders.filter((wo) =>
      isWithinRange(wo.completedAt || wo.updatedAt || wo.createdAt, bucket.start, bucket.end)
    );
    let maintenance = 0;
    let utilities = 0;
    let admin = 0;
    for (const wo of monthWorkOrders) {
      const cost = Number(wo.actualCost || wo.estimatedCost || 0);
      const category = String(wo.category || '').toLowerCase();
      if (category.includes('utilit') || category.includes('power') || category.includes('water')) {
        utilities += cost;
      } else if (category.includes('admin') || category.includes('office')) {
        admin += cost;
      } else {
        maintenance += cost;
      }
    }
    return { month: bucket.month, maintenance, utilities, admin };
  });
}

function computeArrears(scope, now = new Date()) {
  const buckets = {
    current: 0,
    overdue_1_30: 0,
    overdue_31_60: 0,
    overdue_61_90: 0,
    overdue_90_plus: 0,
  };

  for (const invoice of scope.invoices) {
    if (invoice.amountDue <= 0) continue;
    const dueDate = new Date(invoice.dueDate);
    const ageDays = Math.floor((now.getTime() - dueDate.getTime()) / 86400000);
    if (ageDays <= 0) buckets.current += invoice.amountDue;
    else if (ageDays <= 30) buckets.overdue_1_30 += invoice.amountDue;
    else if (ageDays <= 60) buckets.overdue_31_60 += invoice.amountDue;
    else if (ageDays <= 90) buckets.overdue_61_90 += invoice.amountDue;
    else buckets.overdue_90_plus += invoice.amountDue;
  }

  const totalOverdue =
    buckets.overdue_1_30 +
    buckets.overdue_31_60 +
    buckets.overdue_61_90 +
    buckets.overdue_90_plus;

  return {
    total: totalOverdue,
    current: buckets.current,
    buckets: [
      { bucket: 'Current', amount: buckets.current },
      { bucket: '1-30 Days', amount: buckets.overdue_1_30 },
      { bucket: '31-60 Days', amount: buckets.overdue_31_60 },
      { bucket: '61-90 Days', amount: buckets.overdue_61_90 },
      { bucket: '90+ Days', amount: buckets.overdue_90_plus },
    ],
  };
}

function computeMaintenance(scope, now = new Date()) {
  const curStart = startOfMonth(now);
  const curEnd = endOfMonth(now);
  const prev = previousMonth(now);
  const prevStart = startOfMonth(prev);
  const prevEnd = endOfMonth(prev);

  const closed = new Set(['COMPLETED', 'CANCELLED', 'REJECTED']);
  const open = scope.workOrders.filter((w) => !closed.has(w.status));
  const inProgress = scope.workOrders.filter((w) => w.status === 'IN_PROGRESS').length;
  const pendingApprovals = scope.workOrders.filter((w) => w.status === 'PENDING_APPROVAL').length;

  const completedThisMonth = scope.workOrders.filter(
    (w) =>
      w.status === 'COMPLETED' &&
      isWithinRange(w.completedAt || w.updatedAt, curStart, curEnd)
  ).length;
  const completedPrevMonth = scope.workOrders.filter(
    (w) =>
      w.status === 'COMPLETED' &&
      isWithinRange(w.completedAt || w.updatedAt, prevStart, prevEnd)
  ).length;

  const totalCostThisMonth = scope.workOrders
    .filter((w) => isWithinRange(w.updatedAt || w.createdAt, curStart, curEnd))
    .reduce((sum, w) => sum + Number(w.actualCost || w.estimatedCost || 0), 0);

  return {
    open: open.length,
    inProgress,
    pendingApprovals,
    completedThisMonth,
    completedPrevMonth,
    totalCostThisMonth,
    delta: computeDelta(open.length, completedPrevMonth),
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const app = new Hono();
app.use('*', authMiddleware);
app.use('*', databaseMiddleware);
app.use('*', async (c, next) => {
  const auth = c.get('auth');
  const allowed = [
    UserRole.OWNER,
    UserRole.TENANT_ADMIN,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.SUPPORT,
  ];
  if (!allowed.includes(auth.role)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Analytics access is not allowed for this role.',
        },
      },
      403
    );
  }
  await next();
});

app.get('/summary', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const scope = await getScopedOwnerData(auth, repos);
  return c.json({ success: true, data: computeSummary(scope) });
});

app.get('/occupancy', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const scope = await getScopedOwnerData(auth, repos);
  return c.json({ success: true, data: computeOccupancyTrend(scope) });
});

app.get('/revenue', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const scope = await getScopedOwnerData(auth, repos);
  return c.json({ success: true, data: computeRevenueTrend(scope) });
});

app.get('/expenses', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const scope = await getScopedOwnerData(auth, repos);
  return c.json({ success: true, data: computeExpenseTrend(scope) });
});

app.get('/arrears', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const scope = await getScopedOwnerData(auth, repos);
  return c.json({ success: true, data: computeArrears(scope) });
});

app.get('/maintenance', async (c) => {
  const auth = c.get('auth');
  const repos = c.get('repos');
  const scope = await getScopedOwnerData(auth, repos);
  return c.json({ success: true, data: computeMaintenance(scope) });
});

export const analyticsRouter = app;

// TODO(SQLKPIDataProvider): For tenants with >5k invoices/payments/work-orders
// aggregation in JS becomes a bottleneck. Push the current-month/prev-month
// aggregations into SQL as `SELECT SUM(...) FROM invoices WHERE tenantId=? AND
// created_at BETWEEN ? AND ? GROUP BY date_trunc('month', created_at)`. The
// repository abstraction currently exposes `findMany` only, so add a dedicated
// `kpis` repo (see packages/database) before wiring this in.
