import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

function unwrap<T>(res: { success: boolean; data?: T; error?: string }, feature: string): T {
  if (res.success && res.data !== undefined) return res.data;
  throw new Error(res.error || `${feature} is unavailable.`);
}

export interface SystemHealthService {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  uptime: number;
  lastCheck: string;
  errorRate: number;
}

export interface HealthMetricPoint {
  time: string;
  requests: number;
  errors: number;
  latency: number;
}

export interface ExceptionItem {
  id: string;
  type: string;
  tenant: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'resolved';
  createdAt: string;
  assignee?: string;
  workflowId?: string;
}

export interface WorkflowItem {
  id: string;
  type: string;
  tenant: string;
  description: string;
  status: 'stuck' | 'pending_approval' | 'error' | 'timeout';
  step: string;
  stuckSince: string;
  retries: number;
}

export interface AIDecisionItem {
  id: string;
  type: string;
  tenant: string;
  input: string;
  decision: string;
  confidence: number;
  reasoning: string;
  timestamp: string;
  overridden: boolean;
}

export interface OperationsSnapshot {
  systemHealth: SystemHealthService[];
  healthMetrics: HealthMetricPoint[];
  exceptions: ExceptionItem[];
  stuckWorkflows: WorkflowItem[];
  aiDecisions: AIDecisionItem[];
}

export function useOperationsSnapshot() {
  return useQuery({
    queryKey: ['operations-snapshot'],
    queryFn: async () => unwrap(await api.get<OperationsSnapshot>('/operations/snapshot'), 'Operations snapshot'),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useRetryWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workflowId: string) =>
      unwrap(await api.post(`/operations/workflows/${workflowId}/retry`, {}), 'Workflow retry'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operations-snapshot'] }),
  });
}

export function useCancelWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workflowId: string) =>
      unwrap(await api.post(`/operations/workflows/${workflowId}/cancel`, {}), 'Workflow cancel'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operations-snapshot'] }),
  });
}

export function useAssignException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, assignee }: { id: string; assignee: string }) =>
      unwrap(await api.post(`/operations/exceptions/${id}/assign`, { assignee }), 'Exception assignment'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operations-snapshot'] }),
  });
}

export function useOverrideAIDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      unwrap(await api.post(`/operations/ai-decisions/${id}/override`, { reason }), 'AI decision override'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operations-snapshot'] }),
  });
}
