/**
 * KPIs / Analytics API Service
 *
 * Typed client for the /analytics/* KPI endpoints exposed by the api-gateway.
 * The concrete SQL implementation (SQLKPIDataProvider) lives in
 * services/api-gateway/src/services/sql-kpi-data-provider.ts.
 */

import { getApiClient, ApiResponse } from '../client';

export interface KPIPortfolioSummary {
  occupancy: number;
  revenue: number;
  expenses: number;
  noi: number;
}

export interface OccupancyTrendPoint {
  month: string;
  rate: number;
}

export interface OccupancyRateMeta {
  rate: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  trend: OccupancyTrendPoint[];
}

export interface RentCollectionRate {
  rate: number;
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
}

export type ArrearsAgingBucketKey = 'current' | '1-30' | '31-60' | '61-90' | '90+';

export interface ArrearsAgingBucket {
  bucket: ArrearsAgingBucketKey;
  amount: number;
  count: number;
}

export interface ArrearsAging {
  buckets: ArrearsAgingBucket[];
  totalOutstanding: number;
}

export interface MaintenanceTicketsMetrics {
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

export interface RevenueBreakdown {
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

export interface ExpenseBreakdown {
  trend: ExpenseBreakdownPoint[];
  byCategory: Array<{ name: string; value: number }>;
  totalExpenses: number;
}

export interface KPIQueryParams {
  propertyId?: string | string[];
  startDate?: string;
  endDate?: string;
  months?: number;
}

function buildParams(
  params?: KPIQueryParams
): Record<string, string | number | boolean | string[] | undefined> {
  if (!params) return {};
  const out: Record<string, string | number | boolean | string[] | undefined> = {};
  if (params.propertyId !== undefined) out.propertyId = params.propertyId;
  if (params.startDate) out.startDate = params.startDate;
  if (params.endDate) out.endDate = params.endDate;
  if (params.months !== undefined) out.months = String(params.months);
  return out;
}

export const kpisService = {
  getPortfolioSummary(
    params?: KPIQueryParams
  ): Promise<ApiResponse<KPIPortfolioSummary>> {
    return getApiClient().get<KPIPortfolioSummary>('/analytics/summary', {
      params: buildParams(params),
    });
  },

  getOccupancy(params?: KPIQueryParams): Promise<ApiResponse<OccupancyTrendPoint[]>> {
    return getApiClient().get<OccupancyTrendPoint[]>('/analytics/occupancy', {
      params: buildParams(params),
    });
  },

  getRevenue(params?: KPIQueryParams): Promise<ApiResponse<RevenueBreakdownPoint[]>> {
    return getApiClient().get<RevenueBreakdownPoint[]>('/analytics/revenue', {
      params: buildParams(params),
    });
  },

  getExpenses(
    params?: KPIQueryParams
  ): Promise<ApiResponse<ExpenseBreakdownPoint[]>> {
    return getApiClient().get<ExpenseBreakdownPoint[]>('/analytics/expenses', {
      params: buildParams(params),
    });
  },

  getCollection(params?: KPIQueryParams): Promise<ApiResponse<RentCollectionRate>> {
    return getApiClient().get<RentCollectionRate>('/analytics/collection', {
      params: buildParams(params),
    });
  },

  getArrears(params?: KPIQueryParams): Promise<ApiResponse<ArrearsAging>> {
    return getApiClient().get<ArrearsAging>('/analytics/arrears', {
      params: buildParams(params),
    });
  },

  getMaintenance(
    params?: KPIQueryParams
  ): Promise<ApiResponse<MaintenanceTicketsMetrics>> {
    return getApiClient().get<MaintenanceTicketsMetrics>('/analytics/maintenance', {
      params: buildParams(params),
    });
  },

  /**
   * Generic dispatch against /analytics/kpis/:metric - returns the raw payload.
   */
  getMetric<T = unknown>(
    metric:
      | 'summary'
      | 'occupancy'
      | 'collection'
      | 'arrears'
      | 'maintenance'
      | 'revenue'
      | 'expenses',
    params?: KPIQueryParams
  ): Promise<ApiResponse<T>> {
    return getApiClient().get<T>(`/analytics/kpis/${encodeURIComponent(metric)}`, {
      params: buildParams(params),
    });
  },
};
