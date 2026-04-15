import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'suspended';
export type BillingCycle = 'monthly' | 'annual';

export interface Subscription {
  id: string;
  tenantId: string;
  tenantName: string;
  plan: string;
  status: SubscriptionStatus;
  mrr: number;
  billingCycle: BillingCycle;
  currentPeriodEnd: string;
  createdAt: string;
}

export interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const res = await api.get<Subscription[]>('/platform/subscriptions');
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to load subscriptions');
      }
      return res.data;
    },
    staleTime: 30_000,
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await api.get<Plan[]>('/platform/plans');
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to load plans');
      }
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useChangeSubscriptionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      plan,
      billingCycle,
    }: {
      id: string;
      plan: string;
      billingCycle?: BillingCycle;
    }) => {
      const res = await api.post<Subscription>(`/platform/subscriptions/${id}/change-plan`, {
        plan,
        billingCycle,
      });
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to change plan');
      }
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  });
}

export function useSuspendSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await api.post<Subscription>(`/platform/subscriptions/${id}/suspend`, { reason });
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to suspend subscription');
      }
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  });
}

export function useResumeSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Subscription>(`/platform/subscriptions/${id}/resume`, {});
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to resume subscription');
      }
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  });
}
