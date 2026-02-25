'use client';

/**
 * Customer App Auth Context - Production Ready
 *
 * Integrates with Supabase Auth via the API gateway.
 * Supports:
 *  - Phone OTP login (primary for Tanzania)
 *  - Email registration
 *  - Dynamic context switching (same user can be tenant AND owner)
 *  - Progressive feature discovery
 *
 * Falls back to demo mode when API is unavailable (dev only).
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

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

export type CustomerUser = AuthProfile;

interface AuthContextType {
  user: AuthProfile | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  contexts: UserContext[];
  activeContext: UserContext | null;
  loginWithPhone: (phone: string) => Promise<{ success: boolean; message?: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ success: boolean; message?: string }>;
  register: (data: {
    phone: string;
    firstName: string;
    lastName: string;
    email?: string;
  }) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  switchContext: (contextId: string) => Promise<void>;
}

// ============================================================================
// Storage Keys
// ============================================================================

const TOKEN_KEY = 'customer_token';
const REFRESH_TOKEN_KEY = 'customer_refresh_token';
const USER_KEY = 'customer_user';
const CONTEXTS_KEY = 'customer_contexts';
const ACTIVE_CONTEXT_KEY = 'customer_active_context';

// ============================================================================
// API Base URL (from env, no hard-coded values)
// ============================================================================

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

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [contexts, setContexts] = useState<UserContext[]>([]);
  const [activeContext, setActiveContext] = useState<UserContext | null>(null);

  const apiBase = typeof window !== 'undefined' ? getApiBaseUrl() : '';

  // -----------------------------------------------------------------------
  // Restore session from storage
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedToken = localStorage.getItem(TOKEN_KEY);
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

      // Verify token is still valid (non-blocking)
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
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(CONTEXTS_KEY);
    localStorage.removeItem(ACTIVE_CONTEXT_KEY);
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
    if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(data.profile));
    localStorage.setItem(CONTEXTS_KEY, JSON.stringify(data.contexts));
    if (data.activeContext) {
      localStorage.setItem(ACTIVE_CONTEXT_KEY, JSON.stringify(data.activeContext));
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

  // -----------------------------------------------------------------------
  // Phone OTP Login
  // -----------------------------------------------------------------------
  const loginWithPhone = useCallback(async (phone: string) => {
    try {
      const res = await fetch(`${apiBase}/auth/v2/phone/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const json = await res.json();

      if (!json.success) {
        return { success: false, message: json.error?.message || 'Failed to send OTP' };
      }

      sessionStorage.setItem('otp_phone', phone);
      return { success: true };
    } catch {
      if (process.env.NODE_ENV !== 'production') {
        sessionStorage.setItem('otp_phone', phone);
        return { success: true };
      }
      return { success: false, message: 'Network error. Please try again.' };
    }
  }, [apiBase]);

  // -----------------------------------------------------------------------
  // Verify OTP
  // -----------------------------------------------------------------------
  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    try {
      const res = await fetch(`${apiBase}/auth/v2/phone/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });

      const json = await res.json();

      if (!json.success) {
        return { success: false, message: json.error?.message || 'Invalid OTP' };
      }

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
        if (otp !== '123456') {
          return { success: false, message: 'Invalid OTP. Use 123456 in dev mode.' };
        }

        const normalized = phone.replace(/\D/g, '');
        const demoProfile: AuthProfile = {
          id: `demo-${normalized}`,
          authUid: `demo-${normalized}`,
          email: null,
          phone,
          firstName: 'Demo',
          lastName: 'User',
          displayName: null,
          avatarUrl: null,
          preferredLocale: 'en',
          preferredTimezone: 'Africa/Dar_es_Salaam',
          preferredCurrency: 'TZS',
        };

        const demoContext: UserContext = {
          id: `ctx-demo-${normalized}`,
          contextType: 'tenant',
          tenantId: 'tenant-001',
          isActive: true,
          isPrimary: true,
          displayName: 'My Rental',
          entityType: 'individual',
          enabledFeatures: ['payments', 'maintenance', 'lease', 'profile', 'notifications'],
          onboardingCompleted: true,
          onboardingStep: null,
        };

        saveSession({
          token: `demo-token-${Date.now()}`,
          profile: demoProfile,
          contexts: [demoContext],
          activeContext: demoContext,
        });

        sessionStorage.removeItem('otp_phone');
        return { success: true };
      }
      return { success: false, message: 'Network error. Please try again.' };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  // -----------------------------------------------------------------------
  // Registration
  // -----------------------------------------------------------------------
  const register = useCallback(
    async (data: { phone: string; firstName: string; lastName: string; email?: string }) => {
      try {
        const res = await fetch(`${apiBase}/auth/v2/register/phone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        const json = await res.json();

        if (!json.success) {
          return { success: false, message: json.error?.message || 'Registration failed' };
        }

        sessionStorage.setItem('otp_phone', data.phone);
        sessionStorage.setItem('register_data', JSON.stringify(data));
        return { success: true };
      } catch {
        if (process.env.NODE_ENV !== 'production') {
          sessionStorage.setItem('otp_phone', data.phone);
          sessionStorage.setItem('register_data', JSON.stringify(data));
          return { success: true };
        }
        return { success: false, message: 'Network error. Please try again.' };
      }
    },
    [apiBase]
  );

  // -----------------------------------------------------------------------
  // Logout
  // -----------------------------------------------------------------------
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

  // -----------------------------------------------------------------------
  // Switch Context
  // -----------------------------------------------------------------------
  const switchContextFn = useCallback(async (contextId: string) => {
    const ctx = contexts.find((c) => c.id === contextId);
    if (!ctx) return;

    setActiveContext(ctx);
    localStorage.setItem(ACTIVE_CONTEXT_KEY, JSON.stringify(ctx));

    if (token) {
      fetch(`${apiBase}/auth/v2/contexts/switch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ contextId }),
      }).catch(() => {});
    }
  }, [apiBase, token, contexts]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!token,
        contexts,
        activeContext,
        loginWithPhone,
        verifyOtp,
        register,
        logout,
        switchContext: switchContextFn,
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
