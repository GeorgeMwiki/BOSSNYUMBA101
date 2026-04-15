import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

function unwrap<T>(res: { success: boolean; data?: T; error?: string }, feature: string): T {
  if (res.success && res.data !== undefined) return res.data;
  throw new Error(res.error || `${feature} is unavailable.`);
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scope: 'platform' | 'tenant';
  tenantId: string | null;
  tenantName: string | null;
  permissions: string[];
  lastUsed: string | null;
  createdAt: string;
  expiresAt: string | null;
  revokedAt?: string | null;
}

export interface ApiKeyCreateInput {
  name: string;
  scope: 'platform' | 'tenant';
  tenantId?: string | null;
  permissions: string[];
  expiresAt?: string | null;
}

export interface ApiKeyCreateResponse {
  apiKey: ApiKey;
  secret: string;
}

export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => unwrap(await api.get<ApiKey[]>('/integrations/api-keys'), 'API keys'),
    staleTime: 30_000,
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ApiKeyCreateInput) =>
      unwrap(await api.post<ApiKeyCreateResponse>('/integrations/api-keys', input), 'API key creation'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.post(`/integrations/api-keys/${id}/revoke`, {}), 'API key revoke'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });
}
