/**
 * Owner portal React Query hooks.
 *
 * Consolidates server-state access so pages stop duplicating
 * `useState + useEffect + api.get` patterns. Mirrors the pattern
 * established in admin-portal/src/lib/hooks.ts — keep shapes aligned
 * so a shared package can replace both files later.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

function unwrap<T>(
  result: { success: boolean; data?: T; error?: { message: string } | string },
  feature: string
): T {
  if (result.success && result.data !== undefined) {
    return result.data;
  }
  const message =
    typeof result.error === 'string'
      ? result.error
      : result.error?.message || `${feature} unavailable`;
  throw new Error(message);
}

// ─── Properties ────────────────────────────────────────────

export interface Property {
  id: string;
  name: string;
  type: string;
  status: string;
  address: {
    line1: string;
    city: string;
    region?: string;
    country: string;
  };
  totalUnits: number;
  occupiedUnits: number;
  monthlyRevenue?: number;
}

export function useProperties() {
  return useQuery({
    queryKey: ['properties'],
    queryFn: async () => unwrap(await api.get<Property[]>('/properties'), 'Properties'),
  });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: ['properties', id],
    queryFn: async () => unwrap(await api.get<Property>(`/properties/${id}`), 'Property'),
    enabled: !!id,
  });
}

// ─── Tenants ───────────────────────────────────────────────

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

export function useTenants() {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: async () => unwrap(await api.get<OwnerTenant[]>('/tenants'), 'Tenants'),
  });
}

// ─── Vendors ───────────────────────────────────────────────

export interface Vendor {
  id: string;
  name: string;
  type: string;
  email?: string;
  phone?: string;
  status: string;
  propertiesCount?: number;
}

export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async () => unwrap(await api.get<Vendor[]>('/vendors'), 'Vendors'),
  });
}

// ─── Approvals ─────────────────────────────────────────────

export interface Approval {
  id: string;
  type: string;
  status: string;
  entityType: string;
  entityId: string;
  requestedAction: string;
  justification?: string;
  decision?: string;
  createdAt: string;
  decidedAt?: string;
  requester?: { id: string; name: string };
  approver?: { id: string; name: string };
}

export function useApprovals() {
  return useQuery({
    queryKey: ['approvals'],
    queryFn: async () => unwrap(await api.get<Approval[]>('/approvals'), 'Approvals'),
  });
}

export function useApproveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision?: string }) => {
      return unwrap(
        await api.post(`/approvals/${id}/approve`, { decision: decision ?? 'Approved' }),
        'Approve request'
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
  });
}

export function useRejectRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision?: string }) => {
      return unwrap(
        await api.post(`/approvals/${id}/reject`, { decision: decision ?? 'Rejected' }),
        'Reject request'
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] }),
  });
}

// ─── Portfolio ─────────────────────────────────────────────

export interface PortfolioSummary {
  totalProperties: number;
  totalUnits: number;
  totalValue: number;
  monthlyRevenue: number;
  occupancyRate: number;
  yoyGrowth: number;
}

export function usePortfolioSummary() {
  return useQuery({
    queryKey: ['portfolio', 'summary'],
    queryFn: async () =>
      unwrap(await api.get<PortfolioSummary>('/portfolio/summary'), 'Portfolio summary'),
  });
}
