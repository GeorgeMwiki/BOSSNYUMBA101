/**
 * Owner Portal Auth Context - Production Ready
 *
 * Integrates with Supabase Auth via API gateway v2 endpoints.
 * Supports:
 *  - Email/password login (primary for owner portal)
 *  - Dynamic context switching (owner can also be tenant)
 *  - Session timeout management
 *  - Progressive feature discovery
 *
 * Falls back to demo mode when API is unavailable (dev only).
 * Production requires real API - no mock data allowed.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';

// ============================================================================
// Types
// ============================================================================

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  mfaEnabled?: boolean;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface Property {
  id: string;
  name: string;
}

interface UserContext {
  id: string;
  contextType: 'owner' | 'tenant' | 'technician' | 'manager' | 'admin';
  tenantId: string | null;
  isPrimary: boolean;
  displayName: string | null;
  entityType: 'individual' | 'company';
  enabledFeatures: string[];
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  role: string | null;
  permissions: string[];
  properties: Property[];
  contexts: UserContext[];
  activeContext: UserContext | null;
  isAuthenticated: boolean;
  loading: boolean;
  sessionTimeoutMinutes: number;
  lastActivity: Date | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshSession: () => void;
  setSessionTimeout: (minutes: number) => void;
  switchContext: (contextId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_SESSION_TIMEOUT = 30;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  });
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [contexts, setContexts] = useState<UserContext[]>([]);
  const [activeContext, setActiveContext] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_SESSION_TIMEOUT;
    return parseInt(localStorage.getItem('sessionTimeout') || String(DEFAULT_SESSION_TIMEOUT));
  });
  const [lastActivity, setLastActivity] = useState<Date | null>(null);

  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const logout = useCallback((reason?: string) => {
    // Server-side logout
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      api.post('/auth/v2/logout', {}).catch(() => {});
    }

    localStorage.removeItem('token');
    localStorage.removeItem('lastActivity');
    localStorage.removeItem('owner_contexts');
    localStorage.removeItem('owner_active_context');
    setToken(null);
    setUser(null);
    setTenant(null);
    setRole(null);
    setPermissions([]);
    setProperties([]);
    setContexts([]);
    setActiveContext(null);
    setLastActivity(null);

    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

    if (reason === 'timeout') {
      sessionStorage.setItem('logoutReason', 'Session expired due to inactivity');
    }
  }, []);

  const resetSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

    const timeoutMs = sessionTimeoutMinutes * 60 * 1000;
    const warningMs = Math.max(timeoutMs - 5 * 60 * 1000, timeoutMs * 0.8);

    warningTimeoutRef.current = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('session-warning', {
        detail: { minutesRemaining: Math.ceil((timeoutMs - warningMs) / 60000) }
      }));
    }, warningMs);

    sessionTimeoutRef.current = setTimeout(() => {
      logout('timeout');
      window.location.href = '/login?reason=timeout';
    }, timeoutMs);

    setLastActivity(new Date());
    localStorage.setItem('lastActivity', new Date().toISOString());
  }, [sessionTimeoutMinutes, logout]);

  const refreshSession = useCallback(() => {
    if (token) resetSessionTimeout();
  }, [token, resetSessionTimeout]);

  const setSessionTimeout = useCallback((minutes: number) => {
    setSessionTimeoutMinutes(minutes);
    localStorage.setItem('sessionTimeout', String(minutes));
    if (token) resetSessionTimeout();
  }, [token, resetSessionTimeout]);

  // Track user activity
  useEffect(() => {
    if (!token) return;

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => refreshSession();

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [token, refreshSession]);

  // Check for expired session on mount
  useEffect(() => {
    const storedLastActivity = localStorage.getItem('lastActivity');
    if (storedLastActivity && token) {
      const lastActivityTime = new Date(storedLastActivity).getTime();
      const now = Date.now();
      const timeoutMs = sessionTimeoutMinutes * 60 * 1000;

      if (now - lastActivityTime > timeoutMs) {
        logout('timeout');
        return;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const v2Response = await api.get('/auth/v2/me');
        if (v2Response.data?.success && v2Response.data?.data) {
          const { profile, contexts: ctxs, activeContext: activeCtx } = v2Response.data.data;
          setUser({
            id: profile.id,
            email: profile.email || '',
            firstName: profile.firstName,
            lastName: profile.lastName,
            avatarUrl: profile.avatarUrl,
          });
          setContexts(ctxs || []);
          setActiveContext(activeCtx || ctxs?.[0] || null);

          const ownerCtx = activeCtx || ctxs?.find((c: UserContext) => c.contextType === 'owner');
          if (ownerCtx?.tenantId) {
            setTenant({ id: ownerCtx.tenantId, name: ownerCtx.displayName || '', slug: '' });
          }
          setRole(ownerCtx?.contextType === 'owner' ? 'OWNER' : 'RESIDENT');
          setPermissions(ownerCtx?.enabledFeatures || []);
          resetSessionTimeout();
          setLoading(false);
          return;
        }
      } catch {
        // V2 not available, try legacy
      }

      try {
        // Fallback to legacy auth
        const response = await api.get('/auth/me');
        if (response.data?.success || response.success) {
          const data = response.data?.data || response.data;
          if (data) {
            setUser(data.user);
            setTenant(data.tenant);
            setRole(data.role);
            setPermissions(data.permissions || []);
            setProperties(data.properties || []);
            resetSessionTimeout();
          }
        }
      } catch {
        // Dev fallback only
        if (process.env.NODE_ENV !== 'production') {
          setUser({ id: '1', email: 'owner@demo.local', firstName: 'Demo', lastName: 'Owner' });
          setTenant({ id: '1', name: 'Demo Properties', slug: 'demo-properties' });
          setRole('OWNER');
          setPermissions(['portfolio', 'analytics', 'tenants_list', 'financial', 'reports']);
          resetSessionTimeout();
        } else {
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
      const v2Response = await api.post('/auth/v2/login', { email, password });

      if (v2Response.data?.success && v2Response.data?.data) {
        const { token: newToken, profile, contexts: ctxs, activeContext: activeCtx } = v2Response.data.data;

        localStorage.setItem('token', newToken);
        setToken(newToken);
        setUser({
          id: profile.id,
          email: profile.email || email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
        });
        setContexts(ctxs || []);
        setActiveContext(activeCtx || ctxs?.[0] || null);

        const ownerCtx = activeCtx || ctxs?.find((c: UserContext) => c.contextType === 'owner');
        if (ownerCtx?.tenantId) {
          setTenant({ id: ownerCtx.tenantId, name: ownerCtx.displayName || '', slug: '' });
        }
        setRole('OWNER');
        setPermissions(ownerCtx?.enabledFeatures || ['portfolio', 'analytics', 'financial']);
        resetSessionTimeout();
        return;
      }
    } catch {
      // V2 not available, try legacy
    }

    try {
      // Legacy auth
      const response = await api.post('/auth/login', { email, password });
      if (response.data?.success || response.success) {
        const data = response.data?.data || response.data;
        const { token: newToken, user: newUser, tenant: newTenant, role: newRole, permissions: newPerms } = data;
        localStorage.setItem('token', newToken);
        setToken(newToken);
        setUser(newUser);
        setTenant(newTenant);
        setRole(newRole);
        setPermissions(newPerms || []);
        resetSessionTimeout();
        return;
      }
      throw new Error(response.data?.error?.message || 'Login failed');
    } catch (error) {
      // Dev fallback only
      if (process.env.NODE_ENV !== 'production') {
        const mockToken = 'demo-token-' + Date.now();
        localStorage.setItem('token', mockToken);
        setToken(mockToken);
        setUser({ id: '1', email, firstName: email.split('@')[0], lastName: 'Demo' });
        setTenant({ id: '1', name: 'Demo Properties', slug: 'demo-properties' });
        setRole('OWNER');
        setPermissions(['portfolio', 'analytics', 'tenants_list', 'financial', 'reports']);
        resetSessionTimeout();
      } else {
        throw error;
      }
    }
  };

  const switchContext = useCallback((contextId: string) => {
    const ctx = contexts.find((c) => c.id === contextId);
    if (!ctx) return;

    setActiveContext(ctx);
    localStorage.setItem('owner_active_context', JSON.stringify(ctx));

    if (token) {
      api.post('/auth/v2/contexts/switch', { contextId }).catch(() => {});
    }
  }, [contexts, token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        role,
        permissions,
        properties,
        contexts,
        activeContext,
        isAuthenticated: !!token && !!user,
        loading,
        sessionTimeoutMinutes,
        lastActivity,
        login,
        logout,
        refreshSession,
        setSessionTimeout,
        switchContext,
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
