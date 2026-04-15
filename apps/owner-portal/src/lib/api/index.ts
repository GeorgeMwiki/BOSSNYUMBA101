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
  getWorkOrder: (id: string) => api.get(`/owner/work-orders/${id}`),
  listComments: (id: string) =>
    api.get<Array<{ id: string; author: string; content: string; createdAt: string }>>(
      `/owner/work-orders/${id}/comments`
    ),
  addComment: (id: string, content: string) =>
    api.post(`/owner/work-orders/${id}/comments`, { content }),
};

// ─── Tenants (owner view) ─────────────────────────────────────────
export interface OwnerTenant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
  leaseEndDate: string;
  rentAmount: number;
  status: string;
}

export interface OwnerTenantConversation {
  id: string;
  tenantId: string;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount?: number;
}

export const tenantsApi = {
  list: () => api.get<OwnerTenant[]>('/tenants'),
  conversations: () =>
    api.get<OwnerTenantConversation[]>('/tenants/communications'),
};

// ─── Vendors (owner view) ─────────────────────────────────────────
export interface OwnerVendor {
  id: string;
  name: string;
  type: string;
  email?: string;
  phone?: string;
  status: string;
  propertiesCount?: number;
}

export const ownerVendorsApi = {
  list: () => api.get<OwnerVendor[]>('/vendors'),
};

// ─── Auth / Invitations ───────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{
      token?: string;
      requiresMfa?: boolean;
      mfaSetupRequired?: boolean;
      tempToken?: string;
      mfaSecret?: string;
      qrCodeUrl?: string;
    }>('/auth/login', { email, password }),
  register: (payload: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    companyName?: string;
  }) => api.post('/auth/register', payload),
  verifyEmail: (email: string, code: string) =>
    api.post('/auth/verify-email', { email, code }),
  mfaSetup: (email: string) =>
    api.post<{
      secret: string;
      qrCodeUrl: string;
      backupCodes: string[];
    }>('/auth/mfa/setup', { email }),
  mfaVerify: (payload: { email?: string; code: string; tempToken?: string }) =>
    api.post('/auth/mfa/verify', payload),
  invite: {
    get: (token: string) =>
      api.get<{
        inviteId: string;
        email: string;
        role: string;
        inviterName: string;
        organizationName: string;
        propertyName?: string;
        expiresAt: string;
      }>(`/auth/invite/${token}`),
    accept: (payload: {
      token: string;
      firstName: string;
      lastName: string;
      password: string;
    }) => api.post('/auth/accept-invite', payload),
  },
  sendCoOwnerInvite: (payload: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    propertyIds: string[];
    message?: string;
  }) => api.post('/invitations/co-owner', payload),
};
