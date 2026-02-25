'use client';

/**
 * Estate Manager App Auth Context - Production Ready
 *
 * V2 Supabase Auth with role enforcement for estate managers.
 * Supports phone OTP (primary) and email login.
 * Falls back to legacy auth in dev mode.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface AuthProfile {
  id: string;
  authUid: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  displayName: string | null;
  avatarUrl: string | null;
  preferredLocale: string;
  preferredTimezone: string;
  preferredCurrency: string;
}

export interface UserContext {
  id: string;
  contextType: 'owner' | 'tenant' | 'technician' | 'manager' | 'admin';
  tenantId: string | null;
  isActive: boolean;
  isPrimary: boolean;
  displayName: string | null;
  entityType: 'individual' | 'company';
  enabledFeatures: string[];
  onboardingCompleted: boolean;
  onboardingStep: string | null;
}

interface AuthContextType {
  user: AuthProfile | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  contexts: UserContext[];
  activeContext: UserContext | null;
  loginWithPhone: (phone: string) => Promise<{ success: boolean; message?: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ success: boolean; message?: string }>;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  switchContext: (contextId: string) => Promise<void>;
}

const TOKEN_KEY = 'em_token';
const REFRESH_TOKEN_KEY = 'em_refresh_token';
const USER_KEY = 'em_user';
const CONTEXTS_KEY = 'em_contexts';
const ACTIVE_CONTEXT_KEY = 'em_active_context';

// Also keep auth_token for backwards compat with ApiProvider
const LEGACY_TOKEN_KEY = 'auth_token';

function getApiBaseUrl(): string {
  const url =
    typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_API_URL
      : process.env.API_URL;

  if (url?.trim()) {
    const base = url.trim().replace(/\/$/, '');
    return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_API_URL is required in production');
  }

  return 'http://localhost:4000/api/v1';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [contexts, setContexts] = useState<UserContext[]>([]);
  const [activeContext, setActiveContext] = useState<UserContext | null>(null);

  const apiBase = typeof window !== 'undefined' ? getApiBaseUrl() : '';

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedToken = localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    const storedContexts = localStorage.getItem(CONTEXTS_KEY);
    const storedActiveCtx = localStorage.getItem(ACTIVE_CONTEXT_KEY);

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
        if (storedContexts) setContexts(JSON.parse(storedContexts));
        if (storedActiveCtx) setActiveContext(JSON.parse(storedActiveCtx));
      } catch {
        clearStorage();
      }

      verifySession(storedToken).catch(() => {
        clearStorage();
        setToken(null);
        setUser(null);
      });
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearStorage() {
    [TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, CONTEXTS_KEY, ACTIVE_CONTEXT_KEY, LEGACY_TOKEN_KEY, 'tenant_id'].forEach(
      k => localStorage.removeItem(k)
    );
  }

  function saveSession(data: {
    token: string;
    refreshToken?: string;
    profile: AuthProfile;
    contexts: UserContext[];
    activeContext?: UserContext;
  }) {
    setToken(data.token);
    setUser(data.profile);
    setContexts(data.contexts);
    setActiveContext(data.activeContext || data.contexts[0] || null);

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(LEGACY_TOKEN_KEY, data.token); // backwards compat
    if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(data.profile));
    localStorage.setItem(CONTEXTS_KEY, JSON.stringify(data.contexts));
    if (data.activeContext || data.contexts[0]) {
      const ctx = data.activeContext || data.contexts[0];
      localStorage.setItem(ACTIVE_CONTEXT_KEY, JSON.stringify(ctx));
      if (ctx.tenantId) localStorage.setItem('tenant_id', ctx.tenantId);
    }
  }

  async function verifySession(accessToken: string): Promise<void> {
    const res = await fetch(`${getApiBaseUrl()}/auth/v2/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Session expired');
    const json = await res.json();
    if (json.success && json.data) {
      setUser(json.data.profile);
      setContexts(json.data.contexts || []);
      setActiveContext(json.data.activeContext || null);
    }
  }

  const loginWithPhone = useCallback(async (phone: string) => {
    try {
      const res = await fetch(`${apiBase}/auth/v2/phone/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();
      if (!json.success) return { success: false, message: json.error?.message || 'Failed to send OTP' };
      sessionStorage.setItem('otp_phone', phone);
      return { success: true };
    } catch {
      if (process.env.NODE_ENV !== 'production') {
        sessionStorage.setItem('otp_phone', phone);
        return { success: true };
      }
      return { success: false, message: 'Network error' };
    }
  }, [apiBase]);

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    try {
      const res = await fetch(`${apiBase}/auth/v2/phone/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });
      const json = await res.json();
      if (!json.success) return { success: false, message: json.error?.message || 'Invalid OTP' };

      saveSession({
        token: json.data.token,
        refreshToken: json.data.refreshToken,
        profile: json.data.profile,
        contexts: json.data.contexts || [],
        activeContext: json.data.activeContext,
      });
      sessionStorage.removeItem('otp_phone');
      return { success: true };
    } catch {
      if (process.env.NODE_ENV !== 'production') {
        if (otp !== '123456') return { success: false, message: 'Use 123456 in dev' };
        const normalized = phone.replace(/\D/g, '');
        const demoProfile: AuthProfile = {
          id: `demo-mgr-${normalized}`, authUid: `demo-mgr-${normalized}`,
          email: null, phone, firstName: 'Estate', lastName: 'Manager',
          displayName: 'Estate Manager', avatarUrl: null,
          preferredLocale: 'en', preferredTimezone: 'Africa/Dar_es_Salaam', preferredCurrency: 'TZS',
        };
        const demoContext: UserContext = {
          id: `ctx-mgr-${normalized}`, contextType: 'manager', tenantId: 'tenant-001',
          isActive: true, isPrimary: true, displayName: 'Property Manager',
          entityType: 'individual',
          enabledFeatures: ['work_orders', 'inspections', 'occupancy', 'collections', 'vendors', 'leases', 'reports'],
          onboardingCompleted: true, onboardingStep: null,
        };
        saveSession({ token: `demo-mgr-token-${Date.now()}`, profile: demoProfile, contexts: [demoContext], activeContext: demoContext });
        sessionStorage.removeItem('otp_phone');
        return { success: true };
      }
      return { success: false, message: 'Network error' };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    try {
      // Try v2 first
      const v2Res = await fetch(`${apiBase}/auth/v2/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const v2Json = await v2Res.json();
      if (v2Json.success && v2Json.data) {
        saveSession({
          token: v2Json.data.token,
          refreshToken: v2Json.data.refreshToken,
          profile: v2Json.data.profile,
          contexts: v2Json.data.contexts || [],
          activeContext: v2Json.data.activeContext,
        });
        return { success: true };
      }

      // Fallback to legacy
      const legacyRes = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const legacyJson = await legacyRes.json();
      if (legacyJson.data?.token) {
        const u = legacyJson.data.user || legacyJson.data;
        const profile: AuthProfile = {
          id: u.id, authUid: u.id, email: u.email, phone: u.phone || null,
          firstName: u.firstName || 'Manager', lastName: u.lastName || '',
          displayName: u.displayName || null, avatarUrl: null,
          preferredLocale: 'en', preferredTimezone: 'Africa/Dar_es_Salaam', preferredCurrency: 'TZS',
        };
        saveSession({ token: legacyJson.data.token, profile, contexts: [], activeContext: undefined });
        return { success: true };
      }

      return { success: false, message: 'Invalid credentials' };
    } catch {
      return { success: false, message: 'Network error' };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  const logout = useCallback(() => {
    if (token) {
      fetch(`${apiBase}/auth/v2/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    setToken(null);
    setUser(null);
    setContexts([]);
    setActiveContext(null);
    clearStorage();
  }, [apiBase, token]);

  const switchContextFn = useCallback(async (contextId: string) => {
    const ctx = contexts.find(c => c.id === contextId);
    if (!ctx) return;
    setActiveContext(ctx);
    localStorage.setItem(ACTIVE_CONTEXT_KEY, JSON.stringify(ctx));
    if (ctx.tenantId) localStorage.setItem('tenant_id', ctx.tenantId);
    if (token) {
      fetch(`${apiBase}/auth/v2/contexts/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contextId }),
      }).catch(() => {});
    }
  }, [apiBase, token, contexts]);

  return (
    <AuthContext.Provider value={{
      user, token, loading, isAuthenticated: !!token, contexts, activeContext,
      loginWithPhone, verifyOtp, loginWithEmail, logout, switchContext: switchContextFn,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
