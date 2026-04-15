import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

function unwrap<T>(res: { success: boolean; data?: T; error?: string }, feature: string): T {
  if (res.success && res.data !== undefined) return res.data;
  throw new Error(res.error || `${feature} is unavailable.`);
}

export interface ApproverConfig {
  level: number;
  role: string;
  requiredCount: number;
  autoApproveAfterHours: number;
}

export interface ApprovalRule {
  id: string;
  name: string;
  category: string;
  description: string;
  trigger: string;
  thresholdType: 'amount' | 'count' | 'always';
  thresholdValue: number;
  thresholdCurrency?: string;
  approvers: ApproverConfig[];
  escalationHours: number;
  autoRejectAfterHours: number;
  isActive: boolean;
}

export type ApprovalRuleInput = Omit<ApprovalRule, 'id'> & { id?: string };

export function useApprovalRules() {
  return useQuery({
    queryKey: ['approval-rules'],
    queryFn: async () => unwrap(await api.get<ApprovalRule[]>('/approvals/rules'), 'Approval rules'),
    staleTime: 30_000,
  });
}

export function useSaveApprovalMatrix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rules: ApprovalRule[]) =>
      unwrap(await api.put<ApprovalRule[]>('/approvals/rules', { rules }), 'Approval matrix save'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approval-rules'] }),
  });
}

export function useDeleteApprovalRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.delete(`/approvals/rules/${id}`), 'Approval rule deletion'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approval-rules'] }),
  });
}
