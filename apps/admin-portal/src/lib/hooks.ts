import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

function requireLiveData<T>(result: { success: boolean; data?: T; error?: string }, feature: string): T {
  if (result.success && result.data !== undefined) {
    return result.data;
  }

  throw new Error(result.error || `${feature} is unavailable until live data is connected.`);
}

// ─── Tenants ───────────────────────────────────────────────

interface Tenant {
  id: string;
  name: string;
  status: string;
  plan: string;
  properties: number;
  units: number;
  users: number;
  mrr: number;
  createdAt: string;
  primaryContact: { name: string; email: string };
}

export function useTenants() {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const res = await api.get<Tenant[]>('/tenants');
      return requireLiveData(res, 'Tenant list');
    },
    staleTime: 30_000,
  });
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: ['tenants', id],
    queryFn: async () => {
      const res = await api.get<Tenant>(`/tenants/${id}`);
      return requireLiveData(res, 'Tenant details');
    },
    enabled: !!id,
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post<Tenant>('/tenants', data);
      return requireLiveData(res, 'Tenant creation');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  });
}

// ─── System Health ─────────────────────────────────────────

interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  uptime: number;
  lastCheck: string;
  errorRate: number;
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const res = await api.get<ServiceHealth[]>('/system/health');
      return requireLiveData(res, 'System health');
    },
    refetchInterval: 30_000,
  });
}

// ─── AI Decisions ──────────────────────────────────────────

export interface AIDecisionRecord {
  id: string;
  type: string;
  tenant: string;
  input: string;
  decision: string;
  confidence: number;
  reasoning: string;
  model: string;
  latencyMs: number;
  timestamp: string;
  status: 'auto_approved' | 'pending_review' | 'approved' | 'rejected' | 'overridden';
  reviewedBy?: string;
  reviewedAt?: string;
}

export function useAIDecisions(filter?: string) {
  return useQuery({
    queryKey: ['ai-decisions', filter],
    queryFn: async () => {
      const res = await api.get<AIDecisionRecord[]>('/ai/decisions');
      return requireLiveData(res, 'AI decision log');
    },
    staleTime: 15_000,
  });
}

export function useReviewAIDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' | 'override' }) => {
      const res = await api.post(`/ai/decisions/${id}/review`, { action });
      return requireLiveData(res, 'AI decision review');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-decisions'] }),
  });
}

// ─── Support Cases ─────────────────────────────────────────

export interface SupportCaseRecord {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  tenant: string;
  requester: { name: string; email: string; phone?: string };
  assignee: string | null;
  escalationLevel: number;
  createdAt: string;
  updatedAt: string;
}

export function useSupportCases() {
  return useQuery({
    queryKey: ['support-cases'],
    queryFn: async () => {
      const res = await api.get<SupportCaseRecord[]>('/support/cases');
      return requireLiveData(res, 'Support cases');
    },
    staleTime: 15_000,
  });
}

export function useEscalateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, level, reason }: { id: string; level: number; reason: string }) => {
      const res = await api.post(`/support/cases/${id}/escalate`, { level, reason });
      return requireLiveData(res, 'Case escalation');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['support-cases'] }),
  });
}

// ─── Roles ─────────────────────────────────────────────────

export interface AdminRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
  isSystem: boolean;
  createdAt: string;
  createdBy: string;
}

export interface AdminAuditEntry {
  id: string;
  action: string;
  actor: string;
  target: string;
  changes: string;
  timestamp: string;
}

export function useRoles() {
  return useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: async () => {
      const res = await api.get<AdminRole[]>('/admin/roles');
      return requireLiveData(res, 'Roles');
    },
  });
}

export function useRolesAudit() {
  return useQuery({
    queryKey: ['admin', 'roles', 'audit'],
    queryFn: async () => {
      const res = await api.get<AdminAuditEntry[]>('/admin/roles/audit');
      return requireLiveData(res, 'Roles audit log');
    },
  });
}
