import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

function unwrap<T>(res: { success: boolean; data?: T; error?: string }, feature: string): T {
  if (res.success && res.data !== undefined) return res.data;
  throw new Error(res.error || `${feature} is unavailable.`);
}

export interface CommsTemplate {
  id: string;
  name: string;
  type: 'email' | 'sms';
  subject: string;
  body: string;
  category: string;
  lastUpdated: string;
  usageCount: number;
}

export interface CommsTemplateInput {
  name: string;
  type: 'email' | 'sms';
  subject: string;
  body: string;
  category: string;
}

export function useCommsTemplates() {
  return useQuery({
    queryKey: ['comms-templates'],
    queryFn: async () => unwrap(await api.get<CommsTemplate[]>('/communications/templates'), 'Templates'),
    staleTime: 30_000,
  });
}

export function useCreateCommsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CommsTemplateInput) =>
      unwrap(await api.post<CommsTemplate>('/communications/templates', input), 'Template creation'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comms-templates'] }),
  });
}

export function useUpdateCommsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: CommsTemplateInput & { id: string }) =>
      unwrap(await api.put<CommsTemplate>(`/communications/templates/${id}`, input), 'Template update'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comms-templates'] }),
  });
}

export function useDeleteCommsTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.delete(`/communications/templates/${id}`), 'Template deletion'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comms-templates'] }),
  });
}

export interface CommsTemplatePreview {
  subject: string;
  body: string;
}

export function usePreviewCommsTemplate() {
  return useMutation({
    mutationFn: async ({ id, variables }: { id: string; variables: Record<string, string> }) =>
      unwrap(
        await api.post<CommsTemplatePreview>(`/communications/templates/${id}/preview`, { variables }),
        'Template preview'
      ),
  });
}

export function useSendCommsTemplateTest() {
  return useMutation({
    mutationFn: async ({ id, recipient, variables }: { id: string; recipient: string; variables: Record<string, string> }) =>
      unwrap(
        await api.post(`/communications/templates/${id}/send-test`, { recipient, variables }),
        'Template test send'
      ),
  });
}

export interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused';
  channel: 'email' | 'sms' | 'both';
  targetAudience: string;
  templateId: string | null;
  sentCount: number;
  openRate: number;
  clickRate: number;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface CampaignInput {
  name: string;
  channel: 'email' | 'sms' | 'both';
  targetAudience: string;
  templateId: string | null;
  scheduledAt?: string | null;
}

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => unwrap(await api.get<Campaign[]>('/communications/campaigns'), 'Campaigns'),
    staleTime: 30_000,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CampaignInput) =>
      unwrap(await api.post<Campaign>('/communications/campaigns', input), 'Campaign creation'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useUpdateCampaignStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'start' | 'pause' | 'resume' | 'cancel' }) =>
      unwrap(await api.post<Campaign>(`/communications/campaigns/${id}/${action}`, {}), 'Campaign status'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useSendCampaignTest() {
  return useMutation({
    mutationFn: async ({ id, recipient }: { id: string; recipient: string }) =>
      unwrap(await api.post(`/communications/campaigns/${id}/send-test`, { recipient }), 'Campaign test'),
  });
}
