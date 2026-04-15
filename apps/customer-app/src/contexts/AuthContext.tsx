'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface CustomerUser {
  id: string;
  phone?: string;
  firstName: string;
  lastName: string;
  email?: string;
  avatarUrl?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export interface Membership {
  userId: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantStatus?: string;
  role: string;
  permissions: string[];
}

interface AuthContextType {
  user: CustomerUser | null;
  tenant: Tenant | null;
  token: string | null;
  role: string | null;
  permissions: string[];
  memberships: Membership[];
  activeOrgId: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  setActiveOrg: (tenantId: string) => Promise<void>;
  loginWithPhone: (phone: string) => Promise<{ success: boolean; message?: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ success: boolean; message?: string }>;
  register: (data: {
    phone: string;
    firstName: string;
    lastName: string;
    email?: string;
  }) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const CUSTOMER_TOKEN_KEY = 'customer_token';
const CUSTOMER_USER_KEY = 'customer_user';
const ACTIVE_ORG_KEY = 'customer_active_org';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getApiBaseUrl(): string {
  const raw =
    (typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : process.env.API_URL) ??
    'http://localhost:4000';
  const trimmed = raw.trim().replace(/\/$/, '');
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
}

async function apiCall<T>(
  path: string,
  init: RequestInit & { token?: string | null; activeOrgId?: string | null } = {}
): Promise<{ success: boolean; data?: T; error?: { code?: string; message?: string } }> {
  const base = getApiBaseUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.token) headers['Authorization'] = `Bearer ${init.token}`;
  if (init.activeOrgId) headers['X-Active-Org'] = init.activeOrgId;

  const res = await fetch(`${base}${path}`, {
    method: init.method ?? 'GET',
    body: init.body,
    headers,
  });
  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    payload = { success: res.ok };
  }
  if (!res.ok && !payload?.error) {
    payload = {
      success: false,
      error: { code: 'HTTP_ERROR', message: res.statusText || 'Request failed' },
    };
  }
  return payload;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((data: any) => {
    setUser(data.user ?? null);
    setTenant(data.tenant ?? null);
    setRole(data.role ?? null);
    setPermissions(data.permissions || []);
    setMemberships(data.memberships || []);
    const nextOrgId = data.activeOrgId ?? data.tenant?.id ?? null;
    setActiveOrgId(nextOrgId);
    if (typeof window !== 'undefined') {
      if (nextOrgId) localStorage.setItem(ACTIVE_ORG_KEY, nextOrgId);
      if (data.user) localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(data.user));
    }
  }, []);

  // Hydrate on mount: if we have a stored token, call /auth/me.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedToken = localStorage.getItem(CUSTOMER_TOKEN_KEY);
    const storedOrg = localStorage.getItem(ACTIVE_ORG_KEY);

    if (!storedToken) {
      setLoading(false);
      return;
    }

    setToken(storedToken);
    setActiveOrgId(storedOrg);

    (async () => {
      const res = await apiCall<any>('/auth/me', {
        token: storedToken,
        activeOrgId: storedOrg,
      });
      if (res.success && res.data) {
        applySession(res.data);
      } else {
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        localStorage.removeItem(CUSTOMER_USER_KEY);
        localStorage.removeItem(ACTIVE_ORG_KEY);
        setToken(null);
        setUser(null);
        setActiveOrgId(null);
      }
      setLoading(false);
    })();
  }, [applySession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiCall<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (!res.success || !res.data) {
        // Surface server error verbatim.
        throw new Error(res.error?.message || 'Login failed');
      }
      const data = res.data;
      const newToken: string | undefined = data.token;
      if (!newToken) throw new Error('Login response missing token');
      if (typeof window !== 'undefined') {
        localStorage.setItem(CUSTOMER_TOKEN_KEY, newToken);
      }
      setToken(newToken);
      applySession(data);
    },
    [applySession]
  );

  const setActiveOrg = useCallback(
    async (tenantId: string) => {
      if (!tenantId || !token) return;
      if (typeof window !== 'undefined') {
        localStorage.setItem(ACTIVE_ORG_KEY, tenantId);
      }
      setActiveOrgId(tenantId);
      const res = await apiCall<any>('/auth/switch-org', {
        method: 'POST',
        body: JSON.stringify({ tenantId }),
        token,
        activeOrgId: tenantId,
      });
      if (!res.success || !res.data) {
        throw new Error(res.error?.message || 'Failed to switch organization');
      }
      const data = res.data;
      if (data.token) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(CUSTOMER_TOKEN_KEY, data.token);
        }
        setToken(data.token);
      }
      applySession(data);
    },
    [token, applySession]
  );

  const loginWithPhone = useCallback(async (phone: string) => {
    const normalized = phone.replace(/\D/g, '').replace(/^0/, '254');
    if (normalized.length < 9) {
      return { success: false, message: 'Please enter a valid phone number' };
    }

    // TODO: wire to live provider (e.g. POST /auth/otp/request). Until then we
    // hard-fail so the UI does not pretend to send an OTP.
    return {
      success: false,
      message: 'Resident OTP authentication is not wired to a live provider in this build.',
    };
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    void phone;
    void otp;
    // TODO: wire to live provider (e.g. POST /auth/otp/verify).
    return {
      success: false,
      message: 'Resident OTP verification is not wired to a live provider in this build.',
    };
  }, []);

  const register = useCallback(
    async (data: { phone: string; firstName: string; lastName: string; email?: string }) => {
      void data;
      // TODO: wire to POST /auth/register once self-registration is enabled on
      // the gateway (currently returns LIVE_DATA_NOT_IMPLEMENTED).
      return {
        success: false,
        message: 'Resident self-registration is not wired to a live provider in this build.',
      };
    },
    []
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setTenant(null);
    setRole(null);
    setPermissions([]);
    setMemberships([]);
    setActiveOrgId(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CUSTOMER_TOKEN_KEY);
      localStorage.removeItem(CUSTOMER_USER_KEY);
      localStorage.removeItem(ACTIVE_ORG_KEY);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        role,
        permissions,
        memberships,
        activeOrgId,
        loading,
        isAuthenticated: !!token,
        login,
        setActiveOrg,
        loginWithPhone,
        verifyOtp,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
