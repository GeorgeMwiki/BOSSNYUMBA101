import { useMutation, useQuery } from '@tanstack/react-query';
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

/**
 * Detailed query used by the audit-log page.
 * Server returns a paginated payload with `items` + `total`.
 */
export interface AuditQuery {
  actor?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  sort?: 'timestamp_desc' | 'timestamp_asc';
}

export interface AuditEventsPage {
  items: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
}

function buildQuery(filters: AuditLogFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('q', filters.search);
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.dateRange) params.set('range', filters.dateRange);
  const query = params.toString();
  return query ? `?${query}` : '';
}

function buildAuditQuery(q: AuditQuery): string {
  const params = new URLSearchParams();
  if (q.actor) params.set('actor', q.actor);
  if (q.action) params.set('action', q.action);
  if (q.entity) params.set('entity', q.entity);
  if (q.from) params.set('from', q.from);
  if (q.to) params.set('to', q.to);
  if (q.page) params.set('page', String(q.page));
  if (q.pageSize) params.set('pageSize', String(q.pageSize));
  if (q.sort) params.set('sort', q.sort);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function useAuditEvents(query: AuditQuery | AuditLogFilters) {
  // Detect AuditQuery shape (has `page`/`pageSize`/`actor`/etc)
  const isPaged = (query as AuditQuery).page !== undefined ||
    (query as AuditQuery).actor !== undefined ||
    (query as AuditQuery).action !== undefined ||
    (query as AuditQuery).entity !== undefined ||
    (query as AuditQuery).from !== undefined ||
    (query as AuditQuery).sort !== undefined;
  return useQuery({
    queryKey: ['audit-events', query],
    queryFn: async (): Promise<AuditEventsPage> => {
      if (isPaged) {
        const q = query as AuditQuery;
        const items = unwrap(
          await api.get<AuditEvent[] | AuditEventsPage>(
            `/audit/events${buildAuditQuery(q)}`,
          ),
          'Audit events',
        );
        if (Array.isArray(items)) {
          return {
            items,
            total: items.length,
            page: q.page ?? 1,
            pageSize: q.pageSize ?? items.length,
          };
        }
        return items;
      }
      const items = unwrap(
        await api.get<AuditEvent[]>(`/audit/events${buildQuery(query as AuditLogFilters)}`),
        'Audit events',
      );
      return { items, total: items.length, page: 1, pageSize: items.length };
    },
    staleTime: 15_000,
  });
}

export function useExportAuditEvents() {
  return useMutation({
    mutationFn: async (query: AuditQuery): Promise<AuditEvent[]> => {
      const result = unwrap(
        await api.get<AuditEvent[]>(
          `/audit/events/export${buildAuditQuery(query)}`,
        ),
        'Audit events export',
      );
      return result;
    },
  });
}

export function auditEventsToCsv(rows: AuditEvent[]): string {
  const headers = [
    'timestamp',
    'action',
    'category',
    'actor_id',
    'actor_name',
    'actor_email',
    'actor_role',
    'tenant',
    'resource_type',
    'resource_id',
    'resource_name',
    'ip',
    'user_agent',
  ];
  const escape = (val: unknown): string => {
    const s = val === null || val === undefined ? '' : String(val);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.timestamp,
        r.action,
        r.category,
        r.actor.id,
        r.actor.name,
        r.actor.email,
        r.actor.role,
        r.tenant ?? '',
        r.resource.type,
        r.resource.id,
        r.resource.name,
        r.ipAddress,
        r.userAgent,
      ]
        .map(escape)
        .join(','),
    );
  }
  return lines.join('\n');
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
