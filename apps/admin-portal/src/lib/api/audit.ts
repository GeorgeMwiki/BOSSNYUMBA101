import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

function unwrap<T>(res: { success: boolean; data?: T; error?: string }, feature: string): T {
  if (res.success && res.data !== undefined) return res.data;
  throw new Error(res.error || `${feature} is unavailable.`);
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  action: string;
  category: string;
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  tenant: string | null;
  resource: {
    type: string;
    id: string;
    name: string;
  };
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
}

export interface AuditLogFilters {
  search?: string;
  category?: string;
  dateRange?: 'today' | 'last7' | 'last30' | 'last90';
}

function buildQuery(filters: AuditLogFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('q', filters.search);
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.dateRange) params.set('range', filters.dateRange);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function useAuditEvents(filters: AuditLogFilters) {
  return useQuery({
    queryKey: ['audit-events', filters],
    queryFn: async () =>
      unwrap(await api.get<AuditEvent[]>(`/audit/events${buildQuery(filters)}`), 'Audit events'),
    staleTime: 15_000,
  });
}

export async function exportAuditEvents(filters: AuditLogFilters): Promise<Blob> {
  const query = buildQuery({ ...filters });
  const token = localStorage.getItem('admin_token');
  const baseUrl = (import.meta.env.VITE_API_URL?.trim() || '/api/v1').replace(/\/$/, '');
  const url = baseUrl.endsWith('/api/v1')
    ? `${baseUrl}/audit/events/export${query}`
    : `${baseUrl}/api/v1/audit/events/export${query}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'text/csv',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    throw new Error('Failed to export audit log');
  }
  return response.blob();
}
