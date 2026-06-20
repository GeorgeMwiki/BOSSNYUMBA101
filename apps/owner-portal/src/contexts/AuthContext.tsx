import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

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
  /**
   * ISO-4217 default display currency for the tenant. Wave 4 made
   * `formatCurrency` require an explicit currency so every callsite
   * pulls this through `useTenantCurrency`. Optional because legacy
   * tenants seeded before the migration may not have it set — callers
   * are expected to fall back to a platform default in that case.
   */
  defaultCurrency?: string;
}

interface Property {
  id: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  role: string | null;
  permissions: string[];
  properties: Property[];
  isAuthenticated: boolean;
  loading: boolean;
  sessionTimeoutMinutes: number;
  lastActivity: Date | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshSession: () => void;
  setSessionTimeout: (minutes: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default session timeout in minutes (configurable)
const DEFAULT_SESSION_TIMEOUT = 30;

/**
 * Capture a signup → cockpit auth handoff.
 *
 * The marketing OwnerSignUpForm lands a freshly-provisioned owner at
 * `/dashboard#access_token=<supabase-jwt>` after creating the canonical
 * Supabase session. We read the token from the URL FRAGMENT (so it never
 * reaches a server / Referer / logs), persist it as the cockpit bearer,
 * and strip it from the URL. `GET /auth/me` then authenticates it via the
 * gateway's Supabase-JWT verifier — the canonical "Supabase JWT is
 * canonical" path — so the owner lands authenticated with no bespoke
 * cross-origin cookie required.
 *
 * Returns the captured token (already written to localStorage), or null
 * when there is no handoff fragment. Runs synchronously at provider init
 * so the very first `/auth/me` call carries the bearer.
 */
function captureSessionHandoff(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return null;
  // The fragment may carry other keys; parse it as a param map.
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const token = params.get('access_token');
  if (!token) return null;

  localStorage.setItem('token', token);

  // Strip the token from the URL so it is not bookmarked / shared / left
  // in history. Preserve any non-token fragment entries.
  params.delete('access_token');
  const remaining = params.toString();
  const cleanedHash = remaining ? `#${remaining}` : '';
  const cleanedUrl =
    window.location.pathname + window.location.search + cleanedHash;
  window.history.replaceState(null, '', cleanedUrl);

  return token;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  // Capture a signup → cockpit handoff token from the URL fragment BEFORE
  // reading localStorage, so a freshly-signed-up owner is authenticated on
  // the first render (the handoff token takes precedence over any stale
  // localStorage token). `captureSessionHandoff` already persisted it.
  const [token, setToken] = useState<string | null>(
    () => captureSessionHandoff() ?? localStorage.getItem('token')
  );
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(
    parseInt(localStorage.getItem('sessionTimeout') || String(DEFAULT_SESSION_TIMEOUT), 10)
  );
  const [lastActivity, setLastActivity] = useState<Date | null>(null);

  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const logout = useCallback((reason?: string) => {
    localStorage.removeItem('token');
    localStorage.removeItem('lastActivity');
    setToken(null);
    setUser(null);
    setTenant(null);
    setRole(null);
    setPermissions([]);
    setProperties([]);
    setLastActivity(null);

    // Reset the React Query cache so a new user (or the same user after
    // re-login) never sees stale per-tenant data bleed through.
    queryClient.clear();

    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    if (reason === 'timeout') {
      // Store the reason for logout to show message on login page
      sessionStorage.setItem('logoutReason', 'Session expired due to inactivity');
    }
  }, [queryClient]);

  const resetSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    const timeoutMs = sessionTimeoutMinutes * 60 * 1000;
    const warningMs = Math.max(timeoutMs - 5 * 60 * 1000, timeoutMs * 0.8); // Warning 5 min before or 80% of timeout

    // Set warning timeout
    warningTimeoutRef.current = setTimeout(() => {
      // Dispatch event for session warning
      window.dispatchEvent(new CustomEvent('session-warning', { 
        detail: { minutesRemaining: Math.ceil((timeoutMs - warningMs) / 60000) }
      }));
    }, warningMs);

    // Set session timeout
    sessionTimeoutRef.current = setTimeout(() => {
      logout('timeout');
      window.location.href = '/login?reason=timeout';
    }, timeoutMs);

    setLastActivity(new Date());
    localStorage.setItem('lastActivity', new Date().toISOString());
  }, [sessionTimeoutMinutes, logout]);

  const refreshSession = useCallback(() => {
    if (token) {
      resetSessionTimeout();
    }
  }, [token, resetSessionTimeout]);

  const setSessionTimeout = useCallback((minutes: number) => {
    setSessionTimeoutMinutes(minutes);
    localStorage.setItem('sessionTimeout', String(minutes));
    if (token) {
      resetSessionTimeout();
    }
  }, [token, resetSessionTimeout]);

  // Track user activity
  useEffect(() => {
    if (!token) return;

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    const handleActivity = () => {
      refreshSession();
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [token, refreshSession]);

  // Check for existing session on mount
  useEffect(() => {
    const storedLastActivity = localStorage.getItem('lastActivity');
    if (storedLastActivity && token) {
      const lastActivityTime = new Date(storedLastActivity).getTime();
      const now = Date.now();
      const timeoutMs = sessionTimeoutMinutes * 60 * 1000;
      
      if (now - lastActivityTime > timeoutMs) {
        // Session has expired
        logout('timeout');
        return;
      }
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const response: any = await api.get('/auth/me');
          if (response.data?.success || response.success) {
            const data: any = response.data?.data || response.data;
            if (data) {
              setUser(data.user);
              setTenant(data.tenant);
              setRole(data.role);
              setPermissions(data.permissions || []);
              setProperties(data.properties || []);
              resetSessionTimeout();
            }
          } else {
            logout();
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [token, resetSessionTimeout]);

  const login = async (email: string, password: string) => {
    try {
      const response: any = await api.post('/auth/login', { email, password });

      if (response.data?.success || response.success) {
        const data: any = response.data?.data || response.data;
        const { token: newToken, user: newUser, tenant: newTenant, role: newRole, permissions: newPerms, properties: newProps } = data;
        localStorage.setItem('token', newToken);
        setToken(newToken);
        setUser(newUser);
        setTenant(newTenant);
        setRole(newRole);
        setPermissions(newPerms || []);
        setProperties(newProps || []);
        resetSessionTimeout();
      } else {
        throw new Error(response.data?.error?.message || 'Login failed');
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error('Login failed');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        role,
        permissions,
        properties,
        isAuthenticated: !!token && !!user,
        loading,
        sessionTimeoutMinutes,
        lastActivity,
        login,
        logout,
        refreshSession,
        setSessionTimeout,
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
