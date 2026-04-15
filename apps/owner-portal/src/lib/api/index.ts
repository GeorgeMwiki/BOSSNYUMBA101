/**
 * Type-safe local wrappers for owner-portal.
 *
 * The portal talks to the same backend as the other apps, but uses the thin
 * fetch-based `api` helper rather than @bossnyumba/api-client because the
 * portal keeps its own auth state. These helpers give per-domain shapes.
 */

import { api } from '../api';

// ─── Portfolio performance KPIs ───────────────────────────────────
export interface PortfolioKpis {
  totalProperties: number;
  totalUnits: number;
  occupiedUnits: number;
  occupancyRate: number;
  grossYieldPct: number;
  netYieldPct: number;
  arrears: number;
  arrearsRatePct: number;
  noiMonthToDate: number;
  noiYearToDate: number;
  avgDaysVacant: number;
}

export const portfolioApi = {
  getKpis: () => api.get<PortfolioKpis>('/owner/portfolio/kpis'),
  getPerformance: (params?: { startDate?: string; endDate?: string }) => {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<{
      properties: Array<{
        id: string;
        name: string;
        occupancyRate: number;
        yieldPct: number;
        arrears: number;
        rentCollected: number;
      }>;
    }>(`/owner/portfolio/performance${suffix}`);
  },
};

// ─── Disbursements (payout schedule + statements) ─────────────────
export interface PayoutScheduleItem {
  id: string;
  dueDate: string;
  period: string;
  property?: { id: string; name: string };
  grossAmount: number;
  deductions: number;
  netAmount: number;
  status: 'SCHEDULED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'HELD';
}

export const disbursementsApi = {
  list: () => api.get('/owner/disbursements'),
  schedule: () => api.get<{ items: PayoutScheduleItem[] }>('/owner/disbursements/schedule'),
  statement: (disbursementId: string) =>
    api.get<{ downloadUrl: string; expiresAt?: string }>(
      `/owner/disbursements/${disbursementId}/statement`
    ),
};

// ─── Maintenance oversight (owner view) ───────────────────────────
export const maintenanceApi = {
  listApprovals: () => api.get('/owner/approvals'),
  approve: (id: string, comment?: string) =>
    api.post(`/owner/approvals/${id}/approve`, { comment }),
  reject: (id: string, reason: string) =>
    api.post(`/owner/approvals/${id}/reject`, { reason }),
};
