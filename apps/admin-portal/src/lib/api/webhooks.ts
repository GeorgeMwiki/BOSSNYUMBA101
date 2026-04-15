import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

function unwrap<T>(res: { success: boolean; data?: T; error?: string }, feature: string): T {
  if (res.success && res.data !== undefined) return res.data;
  throw new Error(res.error || `${feature} is unavailable.`);
}

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  tenantId: string | null;
  tenantName: string | null;
  status: 'active' | 'inactive' | 'failing';
  lastTriggered: string | null;
  successRate: number;
  createdAt: string;
}

export interface WebhookCreateInput {
  name: string;
  url: string;
  events: string[];
  tenantId?: string | null;
}

export interface WebhookCreateResponse {
  webhook: WebhookConfig;
  signingSecret: string;
}

export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => unwrap(await api.get<WebhookConfig[]>('/integrations/webhooks'), 'Webhooks'),
    staleTime: 30_000,
  });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: WebhookCreateInput) =>
      unwrap(await api.post<WebhookCreateResponse>('/integrations/webhooks', input), 'Webhook creation'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.delete(`/integrations/webhooks/${id}`), 'Webhook deletion'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useToggleWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'inactive' }) =>
      unwrap(await api.patch(`/integrations/webhooks/${id}`, { status }), 'Webhook toggle'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export interface WebhookTestResult {
  delivered: boolean;
  statusCode: number;
  latencyMs: number;
  message: string;
  body?: string;
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.post<WebhookTestResult>(`/integrations/webhooks/${id}/test`, {}), 'Webhook test'),
  });
}
