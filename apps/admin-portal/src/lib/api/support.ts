import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

function unwrap<T>(res: { success: boolean; data?: T; error?: string }, feature: string): T {
  if (res.success && res.data !== undefined) return res.data;
  throw new Error(res.error || `${feature} is unavailable.`);
}

export interface SupportToolingCustomer {
  id: string;
  name: string;
  tenant: string;
  status: string;
  openTickets: number;
  lastContactAt: string | null;
}

export interface SupportToolingTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  assignee?: string | null;
}

export interface SupportToolingSnapshot {
  customers: SupportToolingCustomer[];
  recentTickets: SupportToolingTicket[];
  openCount: number;
  escalatedCount: number;
}

export function useSupportToolingSnapshot() {
  return useQuery({
    queryKey: ['support-tooling'],
    queryFn: async () => unwrap(await api.get<SupportToolingSnapshot>('/support/tooling'), 'Support tooling'),
    staleTime: 30_000,
  });
}

export interface EscalationCase {
  id: string;
  ticketNumber: string;
  subject: string;
  tenant: string;
  currentLevel: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'escalated' | 'resolved';
  createdAt: string;
  updatedAt: string;
  ownerEmail?: string | null;
}

export interface EscalationSnapshot {
  queue: EscalationCase[];
  slaBreaches: number;
  avgResolutionHours: number;
}

export function useEscalationQueue() {
  return useQuery({
    queryKey: ['support-escalation'],
    queryFn: async () => unwrap(await api.get<EscalationSnapshot>('/support/escalations'), 'Escalation queue'),
    staleTime: 15_000,
  });
}

export function useEscalateSupportCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, level, reason }: { id: string; level: number; reason: string }) =>
      unwrap(await api.post(`/support/cases/${id}/escalate`, { level, reason }), 'Case escalation'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-escalation'] }),
  });
}

export function useResolveSupportCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resolution }: { id: string; resolution: string }) =>
      unwrap(await api.post(`/support/cases/${id}/resolve`, { resolution }), 'Case resolution'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-escalation'] }),
  });
}

// ---------- Tickets surface used by SupportPage ----------

export type SupportStatus = 'open' | 'in_progress' | 'awaiting_customer' | 'resolved' | 'closed';
export type SupportPriority = 'low' | 'medium' | 'high' | 'critical';

export interface SupportConversationMessage {
  id: string;
  author: string;
  authorType: 'agent' | 'customer' | 'system';
  body: string;
  message?: string;
  createdAt: string;
  timestamp?: string;
  isInternal: boolean;
  sender: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: SupportStatus;
  priority: SupportPriority;
  category?: string;
  customer?: { id: string; name: string; email?: string };
  requester: { id: string; name: string; email?: string };
  assignee?: string | null;
  tenant: string;
  tenantId?: string | null;
  escalationLevel: number;
  createdAt: string;
  updatedAt: string;
  conversation?: SupportConversationMessage[];
  messages: SupportConversationMessage[];
}

export interface SupportTicketsPage {
  items: SupportTicket[];
  total: number;
}

export function useSupportTickets(filters: {
  status?: SupportStatus | 'all';
  search?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  return useQuery({
    queryKey: ['support-tickets', filters],
    queryFn: async (): Promise<SupportTicketsPage> => {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'all') params.set('status', filters.status);
      if (filters.search) params.set('q', filters.search);
      if (filters.page) params.set('page', String(filters.page));
      if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
      const qs = params.toString();
      const url = `/support/tickets${qs ? `?${qs}` : ''}`;
      const result = unwrap(
        await api.get<SupportTicket[] | SupportTicketsPage>(url),
        'Support tickets',
      );
      if (Array.isArray(result)) {
        return { items: result, total: result.length };
      }
      return result;
    },
    staleTime: 15_000,
  });
}

export function useReplyToTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ticketId: string; message: string; isInternal?: boolean; status?: SupportStatus }) =>
      unwrap(
        await api.post<SupportConversationMessage>(`/support/tickets/${input.ticketId}/replies`, {
          message: input.message,
          isInternal: input.isInternal ?? false,
          status: input.status,
        }),
        'Reply',
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-tickets'] }),
  });
}

export function useEscalateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; ticketId?: string; reason?: string; level?: number }) => {
      const ticketId = input.ticketId ?? input.id;
      if (!ticketId) throw new Error('Ticket id is required');
      return unwrap(
        await api.post<SupportTicket>(`/support/tickets/${ticketId}/escalate`, {
          reason: input.reason,
          level: input.level ?? 1,
        }),
        'Escalation',
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-tickets'] }),
  });
}
