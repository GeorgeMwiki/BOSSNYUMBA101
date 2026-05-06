/**
 * Hooks migrated from admin-portal/src/lib/hooks.ts.
 *
 * Owner-portal pages that originated in the deprecated admin-portal
 * referenced these admin-flavoured hooks. Re-defined here to keep the
 * migrated pages self-contained without polluting the canonical
 * lib/hooks.ts (which is owner-scoped).
 */

import { useQuery } from '@tanstack/react-query';
import { api } from './api';

function requireLiveData<T>(
  result: {
    success: boolean;
    data?: T;
    error?: { code?: string; message?: string } | string;
  },
  feature: string,
): T {
  if (!result.success || result.data === undefined) {
    const msg =
      typeof result.error === 'string'
        ? result.error
        : result.error?.message;
    throw new Error(msg ?? `${feature} unavailable`);
  }
  return result.data;
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
