/**
 * KPIs API Service
 *
 * Thin client over `/api/v1/analytics/*` exposed by the api-gateway.
 * Backs the owner dashboard KPI cards on both the owner-portal (web) and
 * the bossnyumba_app Flutter-equivalent TS consumers.
 */

import { getApiClient, type ApiResponse } from '../client';

export type KpiUnit = 'percent' | 'currency' | 'count';

export interface KpiValue<T extends number = number> {
  /** Current-period value */
  value: T;
  /** Previous-period value (same length window) */
  previous: T;
  /** value - previous, null when previous is undefined / incomparable */
  delta: number | null;
  /** How this value should be rendered */
  unit: KpiUnit;
  /** For revenue only */
  changePercent?: number;
}

export interface KpiSummary {
  collectionRate: KpiValue;
  occupancy: KpiValue;
  arrears: KpiValue;
  openTickets: KpiValue;
  revenue: KpiValue;
  meta: {
    generatedAt: string;
    periodStart: string;
    periodEnd: string;
    previousPeriodStart: string;
    previousPeriodEnd: string;
  };
}

export interface OccupancyTrendPoint {
  month: string;
  rate: number;
}

export interface RevenueTrendPoint {
  month: string;
  rent: number;
  other: number;
}

export interface ExpenseTrendPoint {
  month: string;
  maintenance: number;
  utilities: number;
  admin: number;
}

export interface ArrearsBucket {
  bucket: string;
  amount: number;
}

export interface ArrearsReport {
  total: number;
  current: number;
  buckets: ArrearsBucket[];
}

export interface MaintenanceKpis {
  open: number;
  inProgress: number;
  pendingApprovals: number;
  completedThisMonth: number;
  completedPrevMonth: number;
  totalCostThisMonth: number;
  delta: number | null;
}

export interface KpiQueryParams {
  propertyId?: string;
  /** Optional organisation / tenant override – the server uses the JWT tenantId by default. */
  orgId?: string;
}

function buildSearchParams(params?: KpiQueryParams): Record<string, string> | undefined {
  if (!params) return undefined;
  const out: Record<string, string> = {};
  if (params.propertyId) out.propertyId = params.propertyId;
  if (params.orgId) out.orgId = params.orgId;
  return Object.keys(out).length ? out : undefined;
}

export const kpisService = {
  /** 4 headline owner KPIs with period-over-period deltas. */
  async getSummary(params?: KpiQueryParams): Promise<ApiResponse<KpiSummary>> {
    return getApiClient().get<KpiSummary>('/analytics/summary', buildSearchParams(params));
  },

  async getOccupancyTrend(
    params?: KpiQueryParams,
  ): Promise<ApiResponse<OccupancyTrendPoint[]>> {
    return getApiClient().get<OccupancyTrendPoint[]>(
      '/analytics/occupancy',
      buildSearchParams(params),
    );
  },

  async getRevenueTrend(
    params?: KpiQueryParams,
  ): Promise<ApiResponse<RevenueTrendPoint[]>> {
    return getApiClient().get<RevenueTrendPoint[]>(
      '/analytics/revenue',
      buildSearchParams(params),
    );
  },

  async getExpenseTrend(
    params?: KpiQueryParams,
  ): Promise<ApiResponse<ExpenseTrendPoint[]>> {
    return getApiClient().get<ExpenseTrendPoint[]>(
      '/analytics/expenses',
      buildSearchParams(params),
    );
  },

  async getArrears(params?: KpiQueryParams): Promise<ApiResponse<ArrearsReport>> {
    return getApiClient().get<ArrearsReport>('/analytics/arrears', buildSearchParams(params));
  },

  async getMaintenance(params?: KpiQueryParams): Promise<ApiResponse<MaintenanceKpis>> {
    return getApiClient().get<MaintenanceKpis>(
      '/analytics/maintenance',
      buildSearchParams(params),
    );
  },
};
