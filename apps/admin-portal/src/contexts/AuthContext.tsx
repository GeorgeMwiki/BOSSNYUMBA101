/**
 * Admin Portal Auth Context - Production Ready
 *
 * Integrates with Supabase Auth via API gateway v2 endpoints.
 * Only allows admin/super_admin/support roles.
 * Falls back to demo mode when API is unavailable (dev only).
 * Production requires real API - no mock data allowed.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  avatarUrl?: string;
}

interface UserContext {
  id: string;
  contextType: 'owner' | 'tenant' | 'technician' | 'manager' | 'admin';
  tenantId: string | null;
  isPrimary: boolean;
  displayName: string | null;
  enabledFeatures: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  contexts: UserContext[];
  activeContext: UserContext | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function apiRequest(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('admin_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  return response.json();
}

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'admin'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'));
  const [loading, setLoading] = useState(true);
  const [contexts, setContexts] = useState<UserContext[]>([]);
  const [activeContext, setActiveContext] = useState<UserContext | null>(null);

  const logout = useCallback(() => {
    const storedToken = localStorage.getItem('admin_token');
    if (storedToken) {
      apiRequest('/auth/v2/logout', { method: 'POST' }).catch(() => {});
    }

    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setToken(null);
    setUser(null);
    setContexts([]);
    setActiveContext(null);
  }, []);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // Try v2 auth first (Supabase-backed)
        const v2Response = await apiRequest('/auth/v2/me');
        if (v2Response?.success && v2Response?.data) {
          const { profile, contexts: ctxs, activeContext: activeCtx } = v2Response.data;

          // Verify admin role
          const adminCtx = activeCtx || ctxs?.find((c: UserContext) => c.contextType === 'admin');
          if (!adminCtx || !ADMIN_ROLES.includes(adminCtx.contextType)) {
            logout();
            return;
          }

          setUser({
            id: profile.id,
            email: profile.email || '',
            firstName: profile.firstName,
            lastName: profile.lastName,
            role: adminCtx.contextType.toUpperCase(),
            tenantId: adminCtx.tenantId || '',
            avatarUrl: profile.avatarUrl,
          });
          setContexts(ctxs || []);
          setActiveContext(adminCtx);
          setLoading(false);
          return;
        }
      } catch {
        // V2 not available, try legacy
      }

      try {
        // Fallback to legacy auth
        const data = await apiRequest('/auth/me');
        if (data?.success && data?.data) {
          const userData = data.data.user || data.data;
          if (!ADMIN_ROLES.includes(userData.role)) {
            logout();
            return;
          }
          setUser(userData);
        }
      } catch {
        if (import.meta.env.PROD) {
          logout();
        }
      }

      setLoading(false);
    };

    initAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const login = async (email: string, password: string) => {
    try {
      // Try v2 auth first
      const v2Response = await apiRequest('/auth/v2/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (v2Response?.success && v2Response?.data) {
        const { token: newToken, profile, contexts: ctxs, activeContext: activeCtx } = v2Response.data;

        const adminCtx = activeCtx || ctxs?.find((c: UserContext) => c.contextType === 'admin');
        if (!adminCtx || !ADMIN_ROLES.includes(adminCtx.contextType)) {
          throw new Error('Access denied. Admin privileges required.');
        }

        localStorage.setItem('admin_token', newToken);
        setToken(newToken);
        setUser({
          id: profile.id,
          email: profile.email || email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          role: adminCtx.contextType.toUpperCase(),
          tenantId: adminCtx.tenantId || '',
          avatarUrl: profile.avatarUrl,
        });
        setContexts(ctxs || []);
        setActiveContext(adminCtx);
        return;
      }
    } catch (error) {
      if ((error as Error).message.includes('Access denied')) {
        throw error;
      }
      // V2 not available, try legacy
    }

    // Legacy auth fallback
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();

    if (!ADMIN_ROLES.includes(data.data?.user?.role)) {
      throw new Error('Access denied. Admin privileges required.');
    }

    setToken(data.data.token);
    setUser(data.data.user);
    localStorage.setItem('admin_token', data.data.token);
    localStorage.setItem('admin_user', JSON.stringify(data.data.user));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        contexts,
        activeContext,
        login,
        logout,
        isAuthenticated: !!token && !!user,
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
