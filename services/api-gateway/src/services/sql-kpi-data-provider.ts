/**
 * SQLKPIDataProvider
 *
 * Concrete implementation of the IKPIDataProvider contract defined in
 * services/reports/src/services/kpi-data-provider.ts, backed by drizzle-orm
 * queries against the BOSSNYUMBA Postgres schema in @bossnyumba/database.
 *
 * Lives in the api-gateway package because that is where @bossnyumba/database
 * is a workspace dependency; the reports service is a pure library with no
 * database dependency. The interface shape is duplicated locally below to
 * keep the package dependency graph acyclic.
 */

// @ts-nocheck

import { and, eq, gte, lte, inArray, isNull } from 'drizzle-orm';
import type { DatabaseClient } from '@bossnyumba/database';

/**
 * Schema table references required by SQLKPIDataProvider.
 *
 * We accept these as a constructor dependency rather than importing the schemas
 * directly. This keeps unit tests trivial (pass simple objects) and sidesteps a
 * pre-existing duplicate-export issue in packages/database/src/schemas/payment.schema.ts
 * that otherwise breaks test-time transpilation of the whole database package.
 *
 * In production, call `SQLKPIDataProvider.fromDatabase(db)` which loads the real
 * drizzle table objects from '@bossnyumba/database'.
 */
export interface KPISchemaTables {
  units: any;
  invoices: any;
  payments: any;
  workOrders: any;
}

// ============================================================================
// Shared types (mirror services/reports/src/services/kpi-data-provider.ts)
// ============================================================================

export interface KPIPeriod {
  start: Date;
  end: Date;
  label: string;
}

export interface OccupancyRateResult {
  rate: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  trend: Array<{ month: string; rate: number }>;
}

export interface RentCollectionRateResult {
  rate: number;
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
}

export interface ArrearsAgingBucket {
  bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
  amount: number;
  count: number;
}

export interface ArrearsAgingResult {
  buckets: ArrearsAgingBucket[];
  totalOutstanding: number;
}

export interface MaintenanceTicketsMetricsResult {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  avgResolutionHours: number;
  totalCost: number;
}

export interface RevenueBreakdownPoint {
  month: string;
  rent: number;
  other: number;
}

export interface RevenueBreakdownResult {
  trend: RevenueBreakdownPoint[];
  bySource: Array<{ name: string; value: number }>;
  totalRevenue: number;
}

export interface ExpenseBreakdownPoint {
  month: string;
  maintenance: number;
  utilities: number;
  admin: number;
}

export interface ExpenseBreakdownResult {
  trend: ExpenseBreakdownPoint[];
  byCategory: Array<{ name: string; value: number }>;
  totalExpenses: number;
}

export interface PortfolioSummaryResult {
  occupancy: number;
  revenue: number;
  expenses: number;
  noi: number;
}

export interface IKPIDataProvider {
  getOccupancyRate(tenantId: string, period: KPIPeriod, propertyIds?: string[]): Promise<OccupancyRateResult>;
  getRentCollectionRate(tenantId: string, period: KPIPeriod, propertyIds?: string[]): Promise<RentCollectionRateResult>;
  getArrearsAging(tenantId: string, propertyIds?: string[]): Promise<ArrearsAgingResult>;
  getMaintenanceTicketsMetrics(tenantId: string, period: KPIPeriod, propertyIds?: string[]): Promise<MaintenanceTicketsMetricsResult>;
  getRevenueBreakdown(tenantId: string, period: KPIPeriod, propertyIds?: string[]): Promise<RevenueBreakdownResult>;
  getExpenseBreakdown(tenantId: string, period: KPIPeriod, propertyIds?: string[]): Promise<ExpenseBreakdownResult>;
  getPortfolioSummary(tenantId: string, period: KPIPeriod, propertyIds?: string[]): Promise<PortfolioSummaryResult>;
}

// ============================================================================
// Helpers
// ============================================================================

/** Convert minor currency units (cents) to major units (KES). */
export function toMajor(minor: number | null | undefined): number {
  if (!minor) return 0;
  return Number(minor) / 100;
}

export function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-KE', { month: 'short' });
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function buildMonthBuckets(
  period: KPIPeriod
): Array<{ key: string; label: string; start: Date; end: Date }> {
  const buckets: Array<{ key: string; label: string; start: Date; end: Date }> = [];
  const cursor = new Date(period.start.getFullYear(), period.start.getMonth(), 1);
  const end = new Date(period.end.getFullYear(), period.end.getMonth(), 1);

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    buckets.push({
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: cursor.toLocaleDateString('en-KE', { month: 'short' }),
      start: new Date(year, month, 1),
      end: new Date(year, month + 1, 0, 23, 59, 59, 999),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return buckets;
}

export function lastNMonthsPeriod(months: number): KPIPeriod {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1);
  return { start, end, label: `last-${months}-months` };
}

// ============================================================================
// SQLKPIDataProvider
// ============================================================================

export class SQLKPIDataProvider implements IKPIDataProvider {
  constructor(
    private readonly db: DatabaseClient,
    private readonly tables: KPISchemaTables
  ) {}

  /**
   * Factory that loads the real drizzle schema tables from the database
   * package and constructs a provider. Use this at HTTP-route wiring time.
   */
  static async fromDatabase(db: DatabaseClient): Promise<SQLKPIDataProvider> {
    const schemas = await import('@bossnyumba/database');
    return new SQLKPIDataProvider(db, {
      units: (schemas as any).units,
      invoices: (schemas as any).invoices,
      payments: (schemas as any).payments,
      workOrders: (schemas as any).workOrders,
    });
  }

  /**
   * Build the common tenant filter plus optional propertyId IN (...) constraint.
   * Abstracted so each metric method can reuse consistent scoping.
   */
  private unitsScope(tenantId: string, propertyIds?: string[]) {
    const { units } = this.tables;
    const conditions = [eq(units.tenantId, tenantId), isNull(units.deletedAt)];
    if (propertyIds && propertyIds.length > 0) {
      conditions.push(inArray(units.propertyId, propertyIds));
    }
    return and(...conditions);
  }

  async getOccupancyRate(
    tenantId: string,
    period: KPIPeriod,
    propertyIds?: string[]
  ): Promise<OccupancyRateResult> {
    const { units } = this.tables;
    const rows = await this.db
      .select({ status: units.status })
      .from(units)
      .where(this.unitsScope(tenantId, propertyIds));

    const totalUnits = rows.length;
    const occupiedUnits = rows.filter((r) => r.status === 'occupied').length;
    const vacantUnits = totalUnits - occupiedUnits;
    const rate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

    // Trend: approximate by re-using the current rate per bucket if no
    // historical occupancy snapshots are available. This keeps the chart
    // non-empty; a dedicated occupancy_snapshots table would replace this.
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

  async getRentCollectionRate(
    tenantId: string,
    period: KPIPeriod,
    propertyIds?: string[]
  ): Promise<RentCollectionRateResult> {
    const { invoices } = this.tables;
    const invoiceRows = await this.db
      .select({
        totalAmount: invoices.totalAmount,
        paidAmount: invoices.paidAmount,
        balanceAmount: invoices.balanceAmount,
        propertyId: invoices.propertyId,
        invoiceType: invoices.invoiceType,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          isNull(invoices.deletedAt),
          gte(invoices.issueDate, period.start),
          lte(invoices.issueDate, period.end),
          eq(invoices.invoiceType, 'rent')
        )
      );

    const scopedInvoices = propertyIds && propertyIds.length > 0
      ? invoiceRows.filter((r) => r.propertyId && propertyIds.includes(r.propertyId))
      : invoiceRows;

    const totalBilled = scopedInvoices.reduce((sum, r) => sum + toMajor(r.totalAmount), 0);
    const totalCollected = scopedInvoices.reduce((sum, r) => sum + toMajor(r.paidAmount), 0);
    const totalOutstanding = scopedInvoices.reduce((sum, r) => sum + toMajor(r.balanceAmount), 0);
    const rate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

    return {
      rate: Math.round(rate * 10) / 10,
      totalBilled,
      totalCollected,
      totalOutstanding,
    };
  }

  async getArrearsAging(
    tenantId: string,
    propertyIds?: string[]
  ): Promise<ArrearsAgingResult> {
    const { invoices } = this.tables;
    const rows = await this.db
      .select({
        balanceAmount: invoices.balanceAmount,
        dueDate: invoices.dueDate,
        propertyId: invoices.propertyId,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          isNull(invoices.deletedAt)
        )
      );

    const scoped = propertyIds && propertyIds.length > 0
      ? rows.filter((r) => r.propertyId && propertyIds.includes(r.propertyId))
      : rows;

    const now = new Date();
    const buckets: Record<ArrearsAgingBucket['bucket'], { amount: number; count: number }> = {
      current: { amount: 0, count: 0 },
      '1-30': { amount: 0, count: 0 },
      '31-60': { amount: 0, count: 0 },
      '61-90': { amount: 0, count: 0 },
      '90+': { amount: 0, count: 0 },
    };

    for (const row of scoped) {
      const amount = toMajor(row.balanceAmount);
      if (amount <= 0) continue;
      const dueDate = new Date(row.dueDate);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      let key: ArrearsAgingBucket['bucket'];
      if (daysOverdue <= 0) key = 'current';
      else if (daysOverdue <= 30) key = '1-30';
      else if (daysOverdue <= 60) key = '31-60';
      else if (daysOverdue <= 90) key = '61-90';
      else key = '90+';

      buckets[key].amount += amount;
      buckets[key].count += 1;
    }

    const bucketList: ArrearsAgingBucket[] = (
      ['current', '1-30', '31-60', '61-90', '90+'] as const
    ).map((bucket) => ({
      bucket,
      amount: buckets[bucket].amount,
      count: buckets[bucket].count,
    }));

    const totalOutstanding = bucketList.reduce((sum, b) => sum + b.amount, 0);

    return { buckets: bucketList, totalOutstanding };
  }

  async getMaintenanceTicketsMetrics(
    tenantId: string,
    period: KPIPeriod,
    propertyIds?: string[]
  ): Promise<MaintenanceTicketsMetricsResult> {
    const { workOrders } = this.tables;
    const rows = await this.db
      .select({
        status: workOrders.status,
        createdAt: workOrders.createdAt,
        completedAt: workOrders.completedAt,
        actualCost: workOrders.actualCost,
        estimatedCost: workOrders.estimatedCost,
        propertyId: workOrders.propertyId,
      })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.tenantId, tenantId),
          isNull(workOrders.deletedAt),
          gte(workOrders.createdAt, period.start),
          lte(workOrders.createdAt, period.end)
        )
      );

    const scoped = propertyIds && propertyIds.length > 0
      ? rows.filter((r) => propertyIds.includes(r.propertyId))
      : rows;

    const total = scoped.length;
    const open = scoped.filter((r) => ['submitted', 'triaged', 'assigned'].includes(r.status)).length;
    const inProgress = scoped.filter((r) => ['scheduled', 'in_progress', 'pending_parts'].includes(r.status)).length;
    const completed = scoped.filter((r) => ['completed', 'verified'].includes(r.status)).length;

    const resolvedWithTimes = scoped.filter((r) => r.completedAt && r.createdAt);
    const totalResolutionHours = resolvedWithTimes.reduce((sum, r) => {
      const ms = new Date(r.completedAt!).getTime() - new Date(r.createdAt).getTime();
      return sum + ms / (1000 * 60 * 60);
    }, 0);
    const avgResolutionHours = resolvedWithTimes.length > 0
      ? Math.round((totalResolutionHours / resolvedWithTimes.length) * 10) / 10
      : 0;

    const totalCost = scoped.reduce(
      (sum, r) => sum + toMajor(r.actualCost ?? r.estimatedCost ?? 0),
      0
    );

    return { total, open, inProgress, completed, avgResolutionHours, totalCost };
  }

  async getRevenueBreakdown(
    tenantId: string,
    period: KPIPeriod,
    propertyIds?: string[]
  ): Promise<RevenueBreakdownResult> {
    const { payments, invoices } = this.tables;
    // Revenue comes from completed payments, split by linked invoice type.
    const paymentRows = await this.db
      .select({
        amount: payments.amount,
        completedAt: payments.completedAt,
        createdAt: payments.createdAt,
        invoiceId: payments.invoiceId,
        status: payments.status,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          gte(payments.createdAt, period.start),
          lte(payments.createdAt, period.end),
          eq(payments.status, 'completed')
        )
      );

    // Fetch linked invoices in one pass for type classification and property scoping.
    const invoiceIds = paymentRows.map((p) => p.invoiceId).filter((id): id is string => !!id);
    let invoiceMap = new Map<string, { invoiceType: string; propertyId: string | null }>();
    if (invoiceIds.length > 0) {
      const invRows = await this.db
        .select({
          id: invoices.id,
          invoiceType: invoices.invoiceType,
          propertyId: invoices.propertyId,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            inArray(invoices.id, invoiceIds)
          )
        );
      invoiceMap = new Map(invRows.map((r) => [r.id, { invoiceType: r.invoiceType, propertyId: r.propertyId }]));
    }

    const buckets = buildMonthBuckets(period);
    const trendMap = new Map<string, RevenueBreakdownPoint>();
    for (const b of buckets) {
      trendMap.set(b.key, { month: b.label, rent: 0, other: 0 });
    }

    const bySourceTotals: Record<string, number> = {};
    let totalRevenue = 0;

    for (const payment of paymentRows) {
      const inv = payment.invoiceId ? invoiceMap.get(payment.invoiceId) : undefined;
      if (propertyIds && propertyIds.length > 0) {
        if (!inv?.propertyId || !propertyIds.includes(inv.propertyId)) continue;
      }

      const amount = toMajor(payment.amount);
      totalRevenue += amount;

      const rawDate = payment.completedAt ?? payment.createdAt;
      const key = monthKey(new Date(rawDate));
      const bucket = trendMap.get(key);
      if (bucket) {
        if (inv?.invoiceType === 'rent') bucket.rent += amount;
        else bucket.other += amount;
      }

      const sourceName = inv?.invoiceType
        ? inv.invoiceType.charAt(0).toUpperCase() + inv.invoiceType.slice(1)
        : 'Other';
      bySourceTotals[sourceName] = (bySourceTotals[sourceName] ?? 0) + amount;
    }

    const bySource = Object.entries(bySourceTotals).map(([name, value]) => ({ name, value }));

    return {
      trend: Array.from(trendMap.values()),
      bySource,
      totalRevenue,
    };
  }

  async getExpenseBreakdown(
    tenantId: string,
    period: KPIPeriod,
    propertyIds?: string[]
  ): Promise<ExpenseBreakdownResult> {
    const { workOrders, invoices } = this.tables;
    // Expenses are approximated from work order costs (maintenance) and
    // expense-type invoices (utilities, admin-like categories).
    const woRows = await this.db
      .select({
        actualCost: workOrders.actualCost,
        estimatedCost: workOrders.estimatedCost,
        createdAt: workOrders.createdAt,
        category: workOrders.category,
        propertyId: workOrders.propertyId,
      })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.tenantId, tenantId),
          isNull(workOrders.deletedAt),
          gte(workOrders.createdAt, period.start),
          lte(workOrders.createdAt, period.end)
        )
      );

    const invRows = await this.db
      .select({
        totalAmount: invoices.totalAmount,
        issueDate: invoices.issueDate,
        invoiceType: invoices.invoiceType,
        propertyId: invoices.propertyId,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, tenantId),
          isNull(invoices.deletedAt),
          gte(invoices.issueDate, period.start),
          lte(invoices.issueDate, period.end)
        )
      );

    const scopedWO = propertyIds && propertyIds.length > 0
      ? woRows.filter((r) => propertyIds.includes(r.propertyId))
      : woRows;
    const scopedInv = propertyIds && propertyIds.length > 0
      ? invRows.filter((r) => r.propertyId && propertyIds.includes(r.propertyId))
      : invRows;

    const buckets = buildMonthBuckets(period);
    const trendMap = new Map<string, ExpenseBreakdownPoint>();
    for (const b of buckets) {
      trendMap.set(b.key, { month: b.label, maintenance: 0, utilities: 0, admin: 0 });
    }

    let maintenanceTotal = 0;
    let utilitiesTotal = 0;
    let adminTotal = 0;
    let insuranceTotal = 0;
    let otherTotal = 0;

    for (const wo of scopedWO) {
      const amount = toMajor(wo.actualCost ?? wo.estimatedCost ?? 0);
      maintenanceTotal += amount;
      const key = monthKey(new Date(wo.createdAt));
      const bucket = trendMap.get(key);
      if (bucket) bucket.maintenance += amount;
    }

    for (const inv of scopedInv) {
      if (inv.invoiceType === 'rent' || inv.invoiceType === 'deposit') continue;
      const amount = toMajor(inv.totalAmount);
      const key = monthKey(new Date(inv.issueDate));
      const bucket = trendMap.get(key);
      if (inv.invoiceType === 'utilities') {
        utilitiesTotal += amount;
        if (bucket) bucket.utilities += amount;
      } else if (inv.invoiceType === 'maintenance') {
        // already counted via workOrders; skip to avoid double-count
      } else if (inv.invoiceType === 'late_fee') {
        adminTotal += amount;
        if (bucket) bucket.admin += amount;
      } else {
        otherTotal += amount;
      }
    }

    const byCategory = [
      { name: 'Maintenance', value: maintenanceTotal },
      { name: 'Utilities', value: utilitiesTotal },
      { name: 'Admin', value: adminTotal },
      { name: 'Insurance', value: insuranceTotal },
      { name: 'Other', value: otherTotal },
    ];

    const totalExpenses = maintenanceTotal + utilitiesTotal + adminTotal + insuranceTotal + otherTotal;

    return {
      trend: Array.from(trendMap.values()),
      byCategory,
      totalExpenses,
    };
  }

  async getPortfolioSummary(
    tenantId: string,
    period: KPIPeriod,
    propertyIds?: string[]
  ): Promise<PortfolioSummaryResult> {
    const [occupancy, revenue, expenses] = await Promise.all([
      this.getOccupancyRate(tenantId, period, propertyIds),
      this.getRevenueBreakdown(tenantId, period, propertyIds),
      this.getExpenseBreakdown(tenantId, period, propertyIds),
    ]);

    return {
      occupancy: occupancy.rate,
      revenue: revenue.totalRevenue,
      expenses: expenses.totalExpenses,
      noi: revenue.totalRevenue - expenses.totalExpenses,
    };
  }
}
