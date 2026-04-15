/**
 * SQLKPIDataProvider
 *
 * Production implementation of the simple `IKPIDataProvider` accessor
 * interface (one method per metric) backed by the live PostgreSQL schema
 * in `@bossnyumba/database`.
 *
 * Wired into:
 *   - GET /api/v1/owner/portfolio  (services/api-gateway/src/routes/bff/owner-portal.ts)
 *   - GET /api/v1/ai/briefing      (services/api-gateway/src/routes/ai.ts)
 *
 * The provider holds a Drizzle DatabaseClient and translates each accessor
 * call into one or more SQL aggregations scoped by tenantId and (optional)
 * propertyId list. All money values are returned in MAJOR currency units
 * (e.g. KES, not cents) — schema columns are stored in minor units and
 * divided by 100 here so the owner-portal/AI consumers don't need to know.
 *
 * Empty-dataset safety: every divisor is checked, NaN / Infinity is never
 * returned. When there is no data we return zeros rather than throwing.
 *
 * Health score formula (composed in callers, exposed here as a helper):
 *
 *   health = 0.30 * occupancyPct
 *          + 0.30 * collectionPct
 *          + 0.20 * slaCompliancePct
 *          + 0.20 * (satisfactionAvg / 5 * 100)
 *
 * Weights deliberately match `KPIEngine.calculateHealthScore` so portfolio
 * and per-property scores are comparable across the two code paths.
 */

import { and, eq, gte, lte, isNull, inArray, sql } from 'drizzle-orm';
import {
  invoices,
  payments,
  leases,
  units,
  workOrders,
} from '@bossnyumba/database';
import type { DatabaseClient } from '@bossnyumba/database';

import type { KPIPeriod } from './kpi-engine.service.js';
import type { TenantId, PropertyId } from '../types/index.js';
import {
  buildMonthBuckets,
  type IKPIDataProvider,
  type OccupancyRateResult,
  type RentCollectionRateResult,
  type ArrearsAgingResult,
  type ArrearsAgingBucket,
  type MaintenanceTicketsMetricsResult,
  type RevenueBreakdownResult,
  type ExpenseBreakdownResult,
  type PortfolioSummaryResult,
} from './kpi-data-provider.js';

// Convert minor-unit integer (e.g. cents/cents-equivalent) to major units.
function minorToMajor(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return n / 100;
}

function safeDivide(numerator: number, denominator: number): number {
  if (!denominator || !Number.isFinite(denominator)) return 0;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : 0;
}

// Statuses considered "open" for work orders.
const OPEN_WORK_ORDER_STATUSES = [
  'submitted',
  'triaged',
  'assigned',
  'scheduled',
  'in_progress',
  'pending_parts',
  'reopened',
] as const;

// Statuses considered "closed" for SLA / satisfaction calculations.
const CLOSED_WORK_ORDER_STATUSES = ['completed', 'verified'] as const;

export interface SQLKPIDataProviderOptions {
  /**
   * Optional default tenant scope. When set, the provider will reject
   * calls for any other tenantId. Useful for per-request providers that
   * are constructed with the auth.tenantId bound up front. Leave undefined
   * for a shared/global provider that trusts the caller-passed tenantId.
   */
  tenantId?: TenantId;
  /**
   * Optional default property filter. Calls that pass their own
   * `propertyIds` argument override this default.
   */
  propertyId?: PropertyId;
}

export class SQLKPIDataProvider implements IKPIDataProvider {
  constructor(
    private readonly db: DatabaseClient,
    private readonly options: SQLKPIDataProviderOptions = {}
  ) {}

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private resolveTenantId(tenantId: TenantId): TenantId {
    if (this.options.tenantId && tenantId !== this.options.tenantId) {
      throw new Error(
        `SQLKPIDataProvider: refusing call for tenant ${tenantId} (bound to ${this.options.tenantId})`
      );
    }
    return tenantId;
  }

  private resolvePropertyIds(propertyIds?: PropertyId[]): PropertyId[] | undefined {
    if (propertyIds && propertyIds.length > 0) return propertyIds;
    if (this.options.propertyId) return [this.options.propertyId];
    return undefined;
  }

  // ==========================================================================
  // Occupancy: units with an active lease / total units
  // ==========================================================================

  async getOccupancyRate(
    tenantId: TenantId,
    period: KPIPeriod,
    propertyIds?: PropertyId[]
  ): Promise<OccupancyRateResult> {
    const t = this.resolveTenantId(tenantId);
    const props = this.resolvePropertyIds(propertyIds);

    const unitConditions = [eq(units.tenantId, t), isNull(units.deletedAt)];
    if (props && props.length > 0) {
      unitConditions.push(inArray(units.propertyId, props));
    }

    const unitRows = await this.db
      .select({ id: units.id, status: units.status, propertyId: units.propertyId })
      .from(units)
      .where(and(...unitConditions));

    const totalUnits = unitRows.length;
    const unitIds = unitRows.map((u) => u.id);

    let occupiedUnits = 0;
    if (totalUnits > 0) {
      const now = new Date();
      const leaseConditions = [
        eq(leases.tenantId, t),
        isNull(leases.deletedAt),
        eq(leases.status, 'active'),
        lte(leases.startDate, now),
        gte(leases.endDate, now),
        inArray(leases.unitId, unitIds),
      ];
      const activeLeases = await this.db
        .select({ unitId: leases.unitId })
        .from(leases)
        .where(and(...leaseConditions));
      const occupiedUnitIds = new Set(activeLeases.map((l) => l.unitId));
      occupiedUnits = occupiedUnitIds.size;
    }

    const vacantUnits = Math.max(totalUnits - occupiedUnits, 0);
    const rate = safeDivide(occupiedUnits, totalUnits) * 100;

    // Build a flat trend (we don't have per-month occupancy snapshots in
    // the schema). Repeat the current rate across each month bucket so the
    // chart renders rather than shows NaN.
    const trend = buildMonthBuckets(period).map((b) => ({
      month: b.label,
      rate: Math.round(rate * 10) / 10,
    }));

    return {
      rate: Math.round(rate * 10) / 10,
      totalUnits,
      occupiedUnits,
      vacantUnits,
      trend,
    };
  }

  // ==========================================================================
  // Collection rate: completed payments / issued invoices over the period
  // ==========================================================================

  async getRentCollectionRate(
    tenantId: TenantId,
    period: KPIPeriod,
    propertyIds?: PropertyId[]
  ): Promise<RentCollectionRateResult> {
    const t = this.resolveTenantId(tenantId);
    const props = this.resolvePropertyIds(propertyIds);

    const invoiceConditions = [
      eq(invoices.tenantId, t),
      isNull(invoices.deletedAt),
      gte(invoices.issueDate, period.start),
      lte(invoices.issueDate, period.end),
    ];
    if (props && props.length > 0) {
      invoiceConditions.push(inArray(invoices.propertyId, props));
    }

    const invoiceAgg = await this.db
      .select({
        totalBilled: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)::bigint`,
        totalOutstanding: sql<number>`coalesce(sum(${invoices.balanceAmount}), 0)::bigint`,
      })
      .from(invoices)
      .where(and(...invoiceConditions));

    const totalBilled = minorToMajor(invoiceAgg[0]?.totalBilled ?? 0);
    const totalOutstanding = minorToMajor(invoiceAgg[0]?.totalOutstanding ?? 0);

    const paymentConditions = [
      eq(payments.tenantId, t),
      eq(payments.status, 'completed'),
      gte(payments.completedAt, period.start),
      lte(payments.completedAt, period.end),
    ];
    // Payments don't have a propertyId column directly; scope via lease/invoice.
    if (props && props.length > 0) {
      paymentConditions.push(
        sql`(${payments.invoiceId} IN (
          SELECT ${invoices.id} FROM ${invoices}
          WHERE ${invoices.tenantId} = ${t}
          AND ${invoices.propertyId} IN ${props}
        ) OR ${payments.leaseId} IN (
          SELECT ${leases.id} FROM ${leases}
          WHERE ${leases.tenantId} = ${t}
          AND ${leases.propertyId} IN ${props}
        ))`
      );
    }

    const paymentAgg = await this.db
      .select({
        totalCollected: sql<number>`coalesce(sum(${payments.amount}), 0)::bigint`,
      })
      .from(payments)
      .where(and(...paymentConditions));

    const totalCollected = minorToMajor(paymentAgg[0]?.totalCollected ?? 0);
    const rate = safeDivide(totalCollected, totalBilled) * 100;

    return {
      rate: Math.round(rate * 10) / 10,
      totalBilled,
      totalCollected,
      totalOutstanding,
    };
  }

  // ==========================================================================
  // Arrears aging: bucket open invoice balances by days overdue
  // ==========================================================================

  async getArrearsAging(
    tenantId: TenantId,
    propertyIds?: PropertyId[]
  ): Promise<ArrearsAgingResult> {
    const t = this.resolveTenantId(tenantId);
    const props = this.resolvePropertyIds(propertyIds);

    const conditions = [
      eq(invoices.tenantId, t),
      isNull(invoices.deletedAt),
    ];
    if (props && props.length > 0) {
      conditions.push(inArray(invoices.propertyId, props));
    }

    const rows = await this.db
      .select({
        balanceAmount: invoices.balanceAmount,
        dueDate: invoices.dueDate,
      })
      .from(invoices)
      .where(and(...conditions));

    const now = Date.now();
    const buckets: Record<ArrearsAgingBucket['bucket'], { amount: number; count: number }> = {
      current: { amount: 0, count: 0 },
      '1-30': { amount: 0, count: 0 },
      '31-60': { amount: 0, count: 0 },
      '61-90': { amount: 0, count: 0 },
      '90+': { amount: 0, count: 0 },
    };

    let totalOutstanding = 0;
    for (const row of rows) {
      const balance = minorToMajor(row.balanceAmount ?? 0);
      if (balance <= 0) continue;
      totalOutstanding += balance;
      const due = row.dueDate ? new Date(row.dueDate as unknown as string).getTime() : now;
      const daysOverdue = Math.floor((now - due) / (1000 * 60 * 60 * 24));
      let key: ArrearsAgingBucket['bucket'];
      if (daysOverdue <= 0) key = 'current';
      else if (daysOverdue <= 30) key = '1-30';
      else if (daysOverdue <= 60) key = '31-60';
      else if (daysOverdue <= 90) key = '61-90';
      else key = '90+';
      buckets[key].amount += balance;
      buckets[key].count += 1;
    }

    return {
      buckets: (Object.keys(buckets) as ArrearsAgingBucket['bucket'][]).map((bucket) => ({
        bucket,
        amount: Math.round(buckets[bucket].amount),
        count: buckets[bucket].count,
      })),
      totalOutstanding: Math.round(totalOutstanding),
    };
  }

  // ==========================================================================
  // Maintenance: ticket counts, avg resolution hours, total cost
  // ==========================================================================

  async getMaintenanceTicketsMetrics(
    tenantId: TenantId,
    period: KPIPeriod,
    propertyIds?: PropertyId[]
  ): Promise<MaintenanceTicketsMetricsResult> {
    const t = this.resolveTenantId(tenantId);
    const props = this.resolvePropertyIds(propertyIds);

    const conditions = [
      eq(workOrders.tenantId, t),
      isNull(workOrders.deletedAt),
      gte(workOrders.createdAt, period.start),
      lte(workOrders.createdAt, period.end),
    ];
    if (props && props.length > 0) {
      conditions.push(inArray(workOrders.propertyId, props));
    }

    const rows = await this.db
      .select({
        status: workOrders.status,
        createdAt: workOrders.createdAt,
        completedAt: workOrders.completedAt,
        actualCost: workOrders.actualCost,
        estimatedCost: workOrders.estimatedCost,
      })
      .from(workOrders)
      .where(and(...conditions));

    let total = 0;
    let open = 0;
    let inProgress = 0;
    let completed = 0;
    let totalCost = 0;
    const resolutionMs: number[] = [];

    const openSet = new Set<string>(OPEN_WORK_ORDER_STATUSES);
    const closedSet = new Set<string>(CLOSED_WORK_ORDER_STATUSES);

    for (const row of rows) {
      total += 1;
      const status = String(row.status);
      if (status === 'in_progress') inProgress += 1;
      if (openSet.has(status)) open += 1;
      if (closedSet.has(status)) {
        completed += 1;
        if (row.completedAt && row.createdAt) {
          const ms =
            new Date(row.completedAt as unknown as string).getTime() -
            new Date(row.createdAt as unknown as string).getTime();
          if (Number.isFinite(ms) && ms >= 0) resolutionMs.push(ms);
        }
      }
      const cost = row.actualCost ?? row.estimatedCost ?? 0;
      totalCost += minorToMajor(cost);
    }

    const avgResolutionHours =
      resolutionMs.length > 0
        ? safeDivide(
            resolutionMs.reduce((a, b) => a + b, 0),
            resolutionMs.length
          ) /
          (1000 * 60 * 60)
        : 0;

    return {
      total,
      open,
      inProgress,
      completed,
      avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
      totalCost: Math.round(totalCost),
    };
  }

  // ==========================================================================
  // Revenue breakdown: completed payments grouped by month and (lightly)
  // by source. We don't have a payment-source taxonomy in the schema, so
  // we attribute everything to "Rent" (which matches today's reality —
  // 100% of payment rows are rent invoices).
  // ==========================================================================

  async getRevenueBreakdown(
    tenantId: TenantId,
    period: KPIPeriod,
    propertyIds?: PropertyId[]
  ): Promise<RevenueBreakdownResult> {
    const t = this.resolveTenantId(tenantId);
    const props = this.resolvePropertyIds(propertyIds);

    const conditions = [
      eq(payments.tenantId, t),
      eq(payments.status, 'completed'),
      gte(payments.completedAt, period.start),
      lte(payments.completedAt, period.end),
    ];
    if (props && props.length > 0) {
      conditions.push(
        sql`(${payments.invoiceId} IN (
          SELECT ${invoices.id} FROM ${invoices}
          WHERE ${invoices.tenantId} = ${t}
          AND ${invoices.propertyId} IN ${props}
        ) OR ${payments.leaseId} IN (
          SELECT ${leases.id} FROM ${leases}
          WHERE ${leases.tenantId} = ${t}
          AND ${leases.propertyId} IN ${props}
        ))`
      );
    }

    const rows = await this.db
      .select({
        amount: payments.amount,
        completedAt: payments.completedAt,
      })
      .from(payments)
      .where(and(...conditions));

    const buckets = buildMonthBuckets(period);
    const trendMap = new Map(
      buckets.map((b) => [b.key, { month: b.label, rent: 0, other: 0 }])
    );

    let totalRevenue = 0;
    for (const row of rows) {
      const amount = minorToMajor(row.amount ?? 0);
      totalRevenue += amount;
      if (!row.completedAt) continue;
      const d = new Date(row.completedAt as unknown as string);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = trendMap.get(key);
      if (bucket) bucket.rent += amount;
    }

    const trend = Array.from(trendMap.values()).map((b) => ({
      month: b.month,
      rent: Math.round(b.rent),
      other: Math.round(b.other),
    }));

    return {
      trend,
      bySource: [{ name: 'Rent', value: Math.round(totalRevenue) }],
      totalRevenue: Math.round(totalRevenue),
    };
  }

  // ==========================================================================
  // Expense breakdown: work-order actual/estimated cost grouped by month.
  // Categories beyond "Maintenance" aren't tracked in the OLTP schema yet,
  // so we surface 0 for utilities/admin to keep the chart shape stable.
  // ==========================================================================

  async getExpenseBreakdown(
    tenantId: TenantId,
    period: KPIPeriod,
    propertyIds?: PropertyId[]
  ): Promise<ExpenseBreakdownResult> {
    const t = this.resolveTenantId(tenantId);
    const props = this.resolvePropertyIds(propertyIds);

    const conditions = [
      eq(workOrders.tenantId, t),
      isNull(workOrders.deletedAt),
      gte(workOrders.createdAt, period.start),
      lte(workOrders.createdAt, period.end),
    ];
    if (props && props.length > 0) {
      conditions.push(inArray(workOrders.propertyId, props));
    }

    const rows = await this.db
      .select({
        createdAt: workOrders.createdAt,
        completedAt: workOrders.completedAt,
        actualCost: workOrders.actualCost,
        estimatedCost: workOrders.estimatedCost,
      })
      .from(workOrders)
      .where(and(...conditions));

    const buckets = buildMonthBuckets(period);
    const trendMap = new Map(
      buckets.map((b) => [
        b.key,
        { month: b.label, maintenance: 0, utilities: 0, admin: 0 },
      ])
    );

    let totalExpenses = 0;
    for (const row of rows) {
      const cost = minorToMajor(row.actualCost ?? row.estimatedCost ?? 0);
      totalExpenses += cost;
      const when = row.completedAt ?? row.createdAt;
      if (!when) continue;
      const d = new Date(when as unknown as string);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = trendMap.get(key);
      if (bucket) bucket.maintenance += cost;
    }

    const trend = Array.from(trendMap.values()).map((b) => ({
      month: b.month,
      maintenance: Math.round(b.maintenance),
      utilities: Math.round(b.utilities),
      admin: Math.round(b.admin),
    }));

    return {
      trend,
      byCategory: [
        { name: 'Maintenance', value: Math.round(totalExpenses) },
        { name: 'Utilities', value: 0 },
        { name: 'Admin', value: 0 },
      ],
      totalExpenses: Math.round(totalExpenses),
    };
  }

  // ==========================================================================
  // Portfolio summary: combine occupancy, revenue, expenses, NOI.
  // ==========================================================================

  async getPortfolioSummary(
    tenantId: TenantId,
    period: KPIPeriod,
    propertyIds?: PropertyId[]
  ): Promise<PortfolioSummaryResult> {
    const [occ, rev, exp] = await Promise.all([
      this.getOccupancyRate(tenantId, period, propertyIds),
      this.getRevenueBreakdown(tenantId, period, propertyIds),
      this.getExpenseBreakdown(tenantId, period, propertyIds),
    ]);

    return {
      occupancy: occ.rate,
      revenue: rev.totalRevenue,
      expenses: exp.totalExpenses,
      noi: Math.round(rev.totalRevenue - exp.totalExpenses),
    };
  }

  // ==========================================================================
  // Extra computed metrics (not on IKPIDataProvider but useful for callers).
  // ==========================================================================

  /**
   * Open work orders count: status IN (open / in_progress / scheduled).
   * Cheap aggregate used by AI briefing for the "pending" section.
   */
  async getOpenWorkOrderCount(
    tenantId: TenantId,
    propertyIds?: PropertyId[]
  ): Promise<number> {
    const t = this.resolveTenantId(tenantId);
    const props = this.resolvePropertyIds(propertyIds);

    const conditions = [
      eq(workOrders.tenantId, t),
      isNull(workOrders.deletedAt),
      inArray(workOrders.status, [
        ...OPEN_WORK_ORDER_STATUSES,
      ] as unknown as (typeof workOrders.status.enumValues[number])[]),
    ];
    if (props && props.length > 0) {
      conditions.push(inArray(workOrders.propertyId, props));
    }

    const result = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(workOrders)
      .where(and(...conditions));
    return Number(result[0]?.c ?? 0);
  }

  /**
   * SLA compliance rate: of work orders closed in the period, the
   * percentage that did NOT breach response or resolution SLAs.
   * Returns 0 when there are no closed work orders.
   */
  async getSLAComplianceRate(
    tenantId: TenantId,
    period: KPIPeriod,
    propertyIds?: PropertyId[]
  ): Promise<number> {
    const t = this.resolveTenantId(tenantId);
    const props = this.resolvePropertyIds(propertyIds);

    const conditions = [
      eq(workOrders.tenantId, t),
      isNull(workOrders.deletedAt),
      inArray(workOrders.status, [
        ...CLOSED_WORK_ORDER_STATUSES,
      ] as unknown as (typeof workOrders.status.enumValues[number])[]),
      gte(workOrders.completedAt, period.start),
      lte(workOrders.completedAt, period.end),
    ];
    if (props && props.length > 0) {
      conditions.push(inArray(workOrders.propertyId, props));
    }

    const rows = await this.db
      .select({
        responseBreached: workOrders.responseBreached,
        resolutionBreached: workOrders.resolutionBreached,
      })
      .from(workOrders)
      .where(and(...conditions));

    if (rows.length === 0) return 0;
    const compliant = rows.filter(
      (r) => !r.responseBreached && !r.resolutionBreached
    ).length;
    return Math.round(safeDivide(compliant, rows.length) * 1000) / 10;
  }

  /**
   * Average customer satisfaction (1-5) on completed work orders in the
   * period. Returns 0 when no rated work orders exist.
   */
  async getSatisfactionScore(
    tenantId: TenantId,
    period: KPIPeriod,
    propertyIds?: PropertyId[]
  ): Promise<number> {
    const t = this.resolveTenantId(tenantId);
    const props = this.resolvePropertyIds(propertyIds);

    const conditions = [
      eq(workOrders.tenantId, t),
      isNull(workOrders.deletedAt),
      inArray(workOrders.status, [
        ...CLOSED_WORK_ORDER_STATUSES,
      ] as unknown as (typeof workOrders.status.enumValues[number])[]),
      gte(workOrders.completedAt, period.start),
      lte(workOrders.completedAt, period.end),
      sql`${workOrders.rating} IS NOT NULL`,
    ];
    if (props && props.length > 0) {
      conditions.push(inArray(workOrders.propertyId, props));
    }

    const result = await this.db
      .select({
        avgRating: sql<number>`coalesce(avg(${workOrders.rating}), 0)::float`,
      })
      .from(workOrders)
      .where(and(...conditions));

    const avg = Number(result[0]?.avgRating ?? 0);
    return Number.isFinite(avg) ? Math.round(avg * 100) / 100 : 0;
  }

  /**
   * Composite portfolio health score, 0-100. Same weights as
   * KPIEngine.calculateHealthScore so the two paths agree:
   *
   *   health = 0.30 * occupancyPct
   *          + 0.30 * collectionPct
   *          + 0.20 * slaCompliancePct
   *          + 0.20 * (satisfactionAvg / 5 * 100)
   */
  async getHealthScore(
    tenantId: TenantId,
    period: KPIPeriod,
    propertyIds?: PropertyId[]
  ): Promise<number> {
    const [occupancy, collection, sla, satisfaction] = await Promise.all([
      this.getOccupancyRate(tenantId, period, propertyIds),
      this.getRentCollectionRate(tenantId, period, propertyIds),
      this.getSLAComplianceRate(tenantId, period, propertyIds),
      this.getSatisfactionScore(tenantId, period, propertyIds),
    ]);

    const occupancyPct = Math.min(100, occupancy.rate);
    const collectionPct = Math.min(100, collection.rate);
    const slaPct = Math.min(100, sla);
    const satPct = Math.min(100, (satisfaction / 5) * 100);

    const score =
      0.3 * occupancyPct +
      0.3 * collectionPct +
      0.2 * slaPct +
      0.2 * satPct;

    return Math.round(score * 10) / 10;
  }
}
