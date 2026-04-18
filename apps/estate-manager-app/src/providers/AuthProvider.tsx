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

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
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
    const storedUser = readJson<ManagerUser>(USER_KEY);
    const storedTenant =
      readJson<ManagerTenant>(TENANT_KEY) ??
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
    setTenant(next);
  }, []);

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
