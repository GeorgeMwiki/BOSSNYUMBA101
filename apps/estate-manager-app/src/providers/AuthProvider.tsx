'use client';

/**
 * AuthProvider — estate-manager-app identity + session context.
 *
 * Until Wave 4 this app only stored `auth_token` and `tenant_id` in
 * localStorage and read them ad hoc from the ApiProvider. Centralising
 * them here avoids drift (e.g. pages reading stale values), gives us a
 * single logout path that resets the React Query cache, and surfaces
 * the identity to layout components (e.g. avatar, tenant picker) via
 * `useAuth()` rather than prop drilling.
 *
 * NOTE: login/signup for estate managers is still handled via the
 * admin/owner onboarding flow (no public signup). This provider only
 * manages the authenticated session.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getApiClient,
  hasApiClient,
  initializeApiClient,
} from '@bossnyumba/api-client';
import { z } from 'zod';

/**
 * Closes round-3 finding C-6 (CRITICAL): unsafe deserialization.
 *
 * `readJson` previously cast the parsed JSON straight to `T` with no
 * shape validation. Any transient XSS could prime `localStorage` with
 * an attacker-controlled object (e.g. spoof an `activeOrgId` or a fake
 * manager identity) and the AuthProvider would mount it into context.
 *
 * Each schema below is `strict()` so prototype-pollution keys
 * (`__proto__`, `constructor`) and unknown fields are rejected.
 */
const managerUserSchema = z
  .object({
    id: z.string().min(1),
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    role: z.string().optional(),
    avatarUrl: z.string().optional(),
  })
  .strict();

const managerTenantSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
  })
  .strict();

export interface ManagerUser {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role?: string;
  readonly avatarUrl?: string;
}

export interface ManagerTenant {
  readonly id: string;
  readonly name: string;
}

interface AuthContextValue {
  readonly user: ManagerUser | null;
  readonly tenant: ManagerTenant | null;
  readonly token: string | null;
  readonly isAuthenticated: boolean;
  readonly loading: boolean;
  setSession: (input: {
    user: ManagerUser;
    tenant: ManagerTenant;
    token: string;
  }) => void;
  setActiveTenant: (tenant: ManagerTenant) => void;
  logout: () => void;
}

const AUTH_TOKEN_KEY = 'auth_token';
const TENANT_ID_KEY = 'tenant_id';
const USER_KEY = 'manager_user';
const TENANT_KEY = 'manager_tenant';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readValidatedJson<T>(key: string, schema: z.ZodType<T>): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const result = schema.safeParse(parsed);
    if (!result.success) {
      // Closes round-3 C-6: silently purge malformed entries so a
      // single XSS write cannot poison this user forever.
      window.localStorage.removeItem(key);
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ManagerUser | null>(null);
  const [tenant, setTenant] = useState<ManagerTenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }
    const storedToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
    const storedUser = readValidatedJson<ManagerUser>(USER_KEY, managerUserSchema);
    const storedTenant =
      readValidatedJson<ManagerTenant>(TENANT_KEY, managerTenantSchema) ??
      (window.localStorage.getItem(TENANT_ID_KEY)
        ? { id: window.localStorage.getItem(TENANT_ID_KEY)!, name: '' }
        : null);

    setToken(storedToken);
    setUser(storedUser);
    setTenant(storedTenant);
    setLoading(false);
  }, []);

  const setSession = useCallback(
    (input: { user: ManagerUser; tenant: ManagerTenant; token: string }) => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(AUTH_TOKEN_KEY, input.token);
        window.localStorage.setItem(TENANT_ID_KEY, input.tenant.id);
        window.localStorage.setItem(USER_KEY, JSON.stringify(input.user));
        window.localStorage.setItem(TENANT_KEY, JSON.stringify(input.tenant));
      }
      if (hasApiClient()) {
        getApiClient().setAccessToken(input.token);
      } else {
        initializeApiClient({
          baseUrl: '/api/v1',
          tenantId: input.tenant.id,
          accessToken: input.token,
        });
      }
      setToken(input.token);
      setUser(input.user);
      setTenant(input.tenant);
    },
    []
  );

  const setActiveTenant = useCallback((next: ManagerTenant) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TENANT_ID_KEY, next.id);
      window.localStorage.setItem(TENANT_KEY, JSON.stringify(next));
    }
    // Closes round-3 C-3 + H-8: clear the per-tenant React Query
    // cache BEFORE switching state so no in-flight render can read a
    // stale entry from the previous tenant. removeQueries is
    // synchronous; queryClient.clear() would also wipe shared
    // (no-tenant) keys which we want to preserve.
    queryClient.removeQueries();
    setTenant(next);
  }, [queryClient]);

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
      window.localStorage.removeItem(TENANT_ID_KEY);
      window.localStorage.removeItem(USER_KEY);
      window.localStorage.removeItem(TENANT_KEY);
    }
    if (hasApiClient()) {
      getApiClient().setAccessToken(undefined);
    }
    setToken(null);
    setUser(null);
    setTenant(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      tenant,
      token,
      isAuthenticated: !!token,
      loading,
      setSession,
      setActiveTenant,
      logout,
    }),
    [user, tenant, token, loading, setSession, setActiveTenant, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
