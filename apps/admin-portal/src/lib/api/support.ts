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
