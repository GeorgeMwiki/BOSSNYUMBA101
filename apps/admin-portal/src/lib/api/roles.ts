import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

function unwrap<T>(res: { success: boolean; data?: T; error?: string }, feature: string): T {
  if (res.success && res.data !== undefined) return res.data;
  throw new Error(res.error || `${feature} is unavailable.`);
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
  isSystem: boolean;
  createdAt: string;
  createdBy: string;
}

export interface RoleAuditEntry {
  id: string;
  action: string;
  actor: string;
  target: string;
  changes: string;
  timestamp: string;
}

export interface CreateRoleInput {
  name: string;
  description: string;
  permissions: string[];
}

export interface UpdateRoleInput extends CreateRoleInput {
  id: string;
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => unwrap(await api.get<Role[]>('/roles'), 'Roles'),
    staleTime: 30_000,
  });
}

export function useRoleAuditLog() {
  return useQuery({
    queryKey: ['roles-audit'],
    queryFn: async () => unwrap(await api.get<RoleAuditEntry[]>('/roles/audit'), 'Role audit log'),
    staleTime: 60_000,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRoleInput) =>
      unwrap(await api.post<Role>('/roles', input), 'Role creation'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      qc.invalidateQueries({ queryKey: ['roles-audit'] });
    },
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdateRoleInput) =>
      unwrap(await api.put<Role>(`/roles/${id}`, body), 'Role update'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      qc.invalidateQueries({ queryKey: ['roles-audit'] });
    },
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.delete(`/roles/${id}`), 'Role deletion'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      qc.invalidateQueries({ queryKey: ['roles-audit'] });
    },
  });
}

export interface PermissionMatrixSave {
  roles: { id: string; permissions: string[] }[];
}

export function useSavePermissionMatrix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PermissionMatrixSave) =>
      unwrap(await api.put('/roles/permissions/matrix', input), 'Permission matrix'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      qc.invalidateQueries({ queryKey: ['roles-audit'] });
    },
  });
}
