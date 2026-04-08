/**
 * KPI Data Provider
 *
 * Defines the contract for fetching KPI data for owner-portal dashboards.
 *
 * The low-level `IKPIEngineDataProvider` interface (in kpi-engine.service.ts)
 * returns raw numeric bundles used by the KPIEngine to compute full KPI objects.
 *
 * This module exposes `IKPIDataProvider`, the canonical interface for external
 * consumers (HTTP routes, unit tests, owner-portal pages) with convenience
 * accessor methods one-per-metric:
 *
 *   - getOccupancyRate(tenantId, period)      -> Occupancy analytics page
 *   - getRentCollectionRate(tenantId, period) -> Dashboard / Financial page
 *   - getArrearsAging(tenantId)               -> Dashboard arrears card
 *   - getMaintenanceTicketsMetrics(...)       -> Maintenance analytics
 *   - getRevenueBreakdown(tenantId, period)   -> Revenue analytics page
 *   - getExpenseBreakdown(tenantId, period)   -> Expenses analytics page
 *   - getPortfolioSummary(tenantId, period)   -> Analytics index page
 *
 * Concrete implementations:
 *   - SQLKPIDataProvider lives in services/api-gateway/src/services/sql-kpi-data-provider.ts
 *     (the api-gateway package is where the drizzle database client is wired).
 *   - MockKPIDataProvider (below) returns deterministic values for tests.
 */

import type { KPIPeriod } from './kpi-engine.service.js';
import type { TenantId, PropertyId } from '../types/index.js';

// ============================================================================
// Simple accessor types used by owner-portal pages and /api/kpis/* routes
// ============================================================================

export interface OccupancyRateResult {
  rate: number; // percent 0..100
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  trend: Array<{ month: string; rate: number }>;
}

export interface RentCollectionRateResult {
  rate: number; // percent 0..100
  totalBilled: number; // major currency units
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
  occupancy: number; // percent
  revenue: number;
  expenses: number;
  noi: number;
}

// ============================================================================
// IKPIDataProvider interface (simple accessors)
// ============================================================================

/**
 * IKPIDataProvider - simple method-per-metric interface used by HTTP routes
 * and owner-portal dashboards. Concrete SQL implementations may additionally
 * implement `IKPIEngineDataProvider` (from kpi-engine.service.ts) to be usable
 * with the full KPIEngine.
 */
export interface IKPIDataProvider {
  getOccupancyRate(
    tenantId: TenantId,
    period: KPIPeriod,
    propertyIds?: PropertyId[]
  ): Promise<OccupancyRateResult>;

  getRentCollectionRate(
    tenantId: TenantId,
    period: KPIPeriod,
    propertyIds?: PropertyId[]
  ): Promise<RentCollectionRateResult>;

  getArrearsAging(
    tenantId: TenantId,
    propertyIds?: PropertyId[]
  ): Promise<ArrearsAgingResult>;

  getMaintenanceTicketsMetrics(
    tenantId: TenantId,
    period: KPIPeriod,
    propertyIds?: PropertyId[]
  ): Promise<MaintenanceTicketsMetricsResult>;

  getRevenueBreakdown(
    tenantId: TenantId,
    period: KPIPeriod,
    propertyIds?: PropertyId[]
  ): Promise<RevenueBreakdownResult>;

  getExpenseBreakdown(
    tenantId: TenantId,
    period: KPIPeriod,
    propertyIds?: PropertyId[]
  ): Promise<ExpenseBreakdownResult>;

  getPortfolioSummary(
    tenantId: TenantId,
    period: KPIPeriod,
    propertyIds?: PropertyId[]
  ): Promise<PortfolioSummaryResult>;
}

// ============================================================================
// Helper: build a monthly period list for trend charts
// ============================================================================

/**
 * Given a KPIPeriod, produce a list of month buckets (YYYY-MM, short label)
 * covering the period. Used by SQL providers to bucket invoice/payment rows.
 */
export function buildMonthBuckets(
  period: KPIPeriod
): Array<{ key: string; label: string; start: Date; end: Date }> {
  const buckets: Array<{ key: string; label: string; start: Date; end: Date }> = [];
  const cursor = new Date(period.start.getFullYear(), period.start.getMonth(), 1);
  const end = new Date(period.end.getFullYear(), period.end.getMonth(), 1);

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    const label = cursor.toLocaleDateString('en-KE', { month: 'short' });
    const bucketStart = new Date(year, month, 1);
    const bucketEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
    buckets.push({ key, label, start: bucketStart, end: bucketEnd });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return buckets;
}

/**
 * Compute default KPIPeriod covering the last N months (inclusive of current).
 */
export function lastNMonthsPeriod(months: number): KPIPeriod {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1);
  return {
    start,
    end,
    label: `last-${months}-months`,
  };
}

// ============================================================================
// MockKPIDataProvider - deterministic values for unit tests and local dev
// ============================================================================

export class MockKPIDataProvider implements IKPIDataProvider {
  async getOccupancyRate(
    _tenantId: TenantId,
    period: KPIPeriod
  ): Promise<OccupancyRateResult> {
    const trend = buildMonthBuckets(period).map((b, i) => ({
      month: b.label,
      rate: 85 + i,
    }));
    return {
      rate: trend[trend.length - 1]?.rate ?? 91,
      totalUnits: 140,
      occupiedUnits: 128,
      vacantUnits: 12,
      trend,
    };
  }

  async getRentCollectionRate(): Promise<RentCollectionRateResult> {
    return {
      rate: 94,
      totalBilled: 10_000_000,
      totalCollected: 9_400_000,
      totalOutstanding: 600_000,
    };
  }

  async getArrearsAging(): Promise<ArrearsAgingResult> {
    return {
      buckets: [
        { bucket: 'current', amount: 200_000, count: 3 },
        { bucket: '1-30', amount: 150_000, count: 2 },
        { bucket: '31-60', amount: 120_000, count: 2 },
        { bucket: '61-90', amount: 80_000, count: 1 },
        { bucket: '90+', amount: 50_000, count: 1 },
      ],
      totalOutstanding: 600_000,
    };
  }

  async getMaintenanceTicketsMetrics(): Promise<MaintenanceTicketsMetricsResult> {
    return {
      total: 24,
      open: 6,
      inProgress: 4,
      completed: 14,
      avgResolutionHours: 18.5,
      totalCost: 510_000,
    };
  }

  async getRevenueBreakdown(
    _tenantId: TenantId,
    period: KPIPeriod
  ): Promise<RevenueBreakdownResult> {
    const trend = buildMonthBuckets(period).map((b) => ({
      month: b.label,
      rent: 9_000_000,
      other: 500_000,
    }));
    return {
      trend,
      bySource: [
        { name: 'Rent', value: 9_000_000 },
        { name: 'Parking', value: 280_000 },
        { name: 'Utilities', value: 420_000 },
        { name: 'Other', value: 300_000 },
      ],
      totalRevenue: 10_000_000,
    };
  }

  async getExpenseBreakdown(
    _tenantId: TenantId,
    period: KPIPeriod
  ): Promise<ExpenseBreakdownResult> {
    const trend = buildMonthBuckets(period).map((b) => ({
      month: b.label,
      maintenance: 500_000,
      utilities: 340_000,
      admin: 200_000,
    }));
    return {
      trend,
      byCategory: [
        { name: 'Maintenance', value: 500_000 },
        { name: 'Utilities', value: 340_000 },
        { name: 'Admin', value: 200_000 },
        { name: 'Insurance', value: 120_000 },
        { name: 'Other', value: 180_000 },
      ],
      totalExpenses: 1_340_000,
    };
  }

  async getPortfolioSummary(): Promise<PortfolioSummaryResult> {
    return {
      occupancy: 91,
      revenue: 9_400_000,
      expenses: 2_100_000,
      noi: 7_300_000,
    };
  }
}
