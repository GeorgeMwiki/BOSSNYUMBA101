/**
 * Owner-portal AuthContext
 *
 * Real JWT-backed auth wired to the api-gateway `/auth` routes. Mirrors the
 * customer-app context but uses the owner-specific token key and preserves
 * the existing `{user, tenant, login, logout, properties, ...}` surface used
 * by LoginPage, Layout, SettingsPage, MessagesPage, ESignature and the
 * CoOwnerInviteModal.
 *
 * Canonical shape for parallel agents: `{ user, token, tenantId }`.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OwnerUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  mfaEnabled?: boolean;
}

export interface TenantInfo {
  id: string;
  name?: string;
  slug?: string;
}

export interface PropertyRef {
  id: string;
  name?: string;
}

export interface DecodedJwt {
  userId?: string;
  sub?: string;
  tenantId?: string;
  role?: string;
  permissions?: string[];
  propertyAccess?: string[];
  email?: string;
  exp?: number;
  iat?: number;
}

interface AuthContextType {
  // Canonical shape required by parallel agents.
  user: OwnerUser | null;
  token: string | null;
  tenantId: string | null;

  // Existing consumers.
  tenant: TenantInfo | null;
  role: string | null;
  permissions: string[];
  properties: PropertyRef[];
  isAuthenticated: boolean;
  loading: boolean;
  isLoading: boolean;

  // Session management (existing behaviour).
  sessionTimeoutMinutes: number;
  lastActivity: Date | null;

  // Actions.
  login: (email: string, password: string) => Promise<void>;
  logout: (reason?: string) => void;
  refreshToken: () => Promise<boolean>;
  refreshSession: () => void;
  setSessionTimeout: (minutes: number) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const OWNER_AUTH_TOKEN_KEY = 'bossnyumba:owner:auth:token';
// Legacy key used by `src/lib/api.ts` — keep in sync so API requests still
// find the bearer token until that file is migrated.
const LEGACY_TOKEN_KEY = 'token';
const DEFAULT_SESSION_TIMEOUT = 30;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Decode a JWT payload without verifying. */
export function decodeJwt(token: string): DecodedJwt | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const json =
      typeof atob === 'function'
        ? atob(padded + pad)
        : Buffer.from(padded + pad, 'base64').toString('binary');
    const decoded = decodeURIComponent(
      Array.from(json)
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(decoded) as DecodedJwt;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, skewSeconds = 0): boolean {
  const claims = decodeJwt(token);
  if (!claims?.exp) return false;
  return claims.exp - skewSeconds <= Math.floor(Date.now() / 1000);
}

function writeToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OWNER_AUTH_TOKEN_KEY, token);
  localStorage.setItem(LEGACY_TOKEN_KEY, token);
}

function clearToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(OWNER_AUTH_TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem('lastActivity');
}

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem(OWNER_AUTH_TOKEN_KEY) ??
    localStorage.getItem(LEGACY_TOKEN_KEY) ??
    null
  );
}

// Shape helpers for the `api` client which returns either
// `{ success, data }` or `{ data: { success, data } }` depending on caller.
function unwrap<T>(response: unknown): T | null {
  if (!response || typeof response !== 'object') return null;
  const asAny = response as { data?: unknown; success?: boolean };
  if (asAny.success && 'data' in asAny) return asAny.data as T;
  if (asAny.data && typeof asAny.data === 'object') {
    const nested = asAny.data as { success?: boolean; data?: unknown };
    if (nested.success && nested.data) return nested.data as T;
    return asAny.data as T;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<OwnerUser | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [token, setToken] = useState<string | null>(() => readToken());
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [properties, setProperties] = useState<PropertyRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(() => {
    if (typeof window === 'undefined') return DEFAULT_SESSION_TIMEOUT;
    const stored = localStorage.getItem('sessionTimeout');
    const parsed = stored ? parseInt(stored, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : DEFAULT_SESSION_TIMEOUT;
  });
  const [lastActivity, setLastActivity] = useState<Date | null>(null);

  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearState = useCallback(() => {
    setUser(null);
    setTenant(null);
    setRole(null);
    setPermissions([]);
    setProperties([]);
    setLastActivity(null);
    setToken(null);
  }, []);

  const logout = useCallback(
    (reason?: string) => {
      clearToken();
      clearState();
      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
      sessionTimeoutRef.current = null;
      warningTimeoutRef.current = null;
      expiryTimerRef.current = null;
      if (reason === 'timeout' && typeof window !== 'undefined') {
        sessionStorage.setItem('logoutReason', 'Session expired due to inactivity');
      }
    },
    [clearState]
  );

  const scheduleTokenExpiry = useCallback(
    (nextToken: string) => {
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
      const claims = decodeJwt(nextToken);
      if (!claims?.exp) return;
      const msUntilExpiry = claims.exp * 1000 - Date.now();
      if (msUntilExpiry <= 0) {
        logout();
        return;
      }
      expiryTimerRef.current = setTimeout(() => logout(), msUntilExpiry);
    },
    [logout]
  );

  const resetSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

    const timeoutMs = sessionTimeoutMinutes * 60 * 1000;
    const warningMs = Math.max(timeoutMs - 5 * 60 * 1000, timeoutMs * 0.8);

    warningTimeoutRef.current = setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('session-warning', {
            detail: { minutesRemaining: Math.ceil((timeoutMs - warningMs) / 60000) },
          })
        );
      }
    }, warningMs);

    sessionTimeoutRef.current = setTimeout(() => {
      logout('timeout');
      if (typeof window !== 'undefined') {
        window.location.href = '/login?reason=timeout';
      }
    }, timeoutMs);

    const now = new Date();
    setLastActivity(now);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastActivity', now.toISOString());
    }
  }, [sessionTimeoutMinutes, logout]);

  const refreshSession = useCallback(() => {
    if (token) resetSessionTimeout();
  }, [token, resetSessionTimeout]);

  const setSessionTimeout = useCallback(
    (minutes: number) => {
      setSessionTimeoutMinutes(minutes);
      if (typeof window !== 'undefined') {
        localStorage.setItem('sessionTimeout', String(minutes));
      }
      if (token) resetSessionTimeout();
    },
    [token, resetSessionTimeout]
  );

  const applyLoginData = useCallback(
    (nextToken: string, data: Record<string, unknown>) => {
      writeToken(nextToken);
      setToken(nextToken);
      setUser((data.user as OwnerUser) ?? null);
      setTenant((data.tenant as TenantInfo) ?? null);
      setRole((data.role as string) ?? null);
      setPermissions(((data.permissions as string[]) ?? []) as string[]);
      setProperties(((data.properties as PropertyRef[]) ?? []) as PropertyRef[]);
      scheduleTokenExpiry(nextToken);
      resetSessionTimeout();
    },
    [resetSessionTimeout, scheduleTokenExpiry]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await api.post<{
        token: string;
        user: OwnerUser;
        tenant?: TenantInfo;
        role?: string;
        permissions?: string[];
        properties?: PropertyRef[];
      }>('/auth/login', { email, password });

      const data = unwrap<{
        token: string;
        user: OwnerUser;
        tenant?: TenantInfo;
        role?: string;
        permissions?: string[];
        properties?: PropertyRef[];
      }>(response);

      if (!data?.token) {
        const message =
          ((response as { error?: { message?: string } })?.error?.message) ||
          ((response as { data?: { error?: { message?: string } } })?.data?.error?.message) ||
          'Login failed';
        throw new Error(message);
      }

      applyLoginData(data.token, data as unknown as Record<string, unknown>);
    },
    [applyLoginData]
  );

  const refreshToken = useCallback(async (): Promise<boolean> => {
    const current = readToken();
    if (!current) return false;
    try {
      const response = await api.post<{ token: string }>('/auth/refresh');
      const data = unwrap<{ token: string }>(response);
      if (!data?.token) {
        logout();
        return false;
      }
      writeToken(data.token);
      setToken(data.token);
      scheduleTokenExpiry(data.token);
      return true;
    } catch {
      logout();
      return false;
    }
  }, [logout, scheduleTokenExpiry]);

  // Track user activity for idle session timeout.
  useEffect(() => {
    if (!token) return;

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => refreshSession();

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [token, refreshSession]);

  // Hydrate on mount: verify stored token with /auth/me.
  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      const stored = readToken();
      if (!stored) {
        setLoading(false);
        return;
      }

      if (isTokenExpired(stored)) {
        clearToken();
        clearState();
        setLoading(false);
        return;
      }

      // Check idle expiry based on last activity.
      if (typeof window !== 'undefined') {
        const storedLastActivity = localStorage.getItem('lastActivity');
        if (storedLastActivity) {
          const lastActivityTime = new Date(storedLastActivity).getTime();
          const timeoutMs = sessionTimeoutMinutes * 60 * 1000;
          if (Date.now() - lastActivityTime > timeoutMs) {
            logout('timeout');
            setLoading(false);
            return;
          }
        }
      }

      try {
        const response = await api.get<{
          user: OwnerUser;
          tenant?: TenantInfo;
          role?: string;
          permissions?: string[];
          properties?: PropertyRef[];
        }>('/auth/me');

        if (cancelled) return;
        const data = unwrap<{
          user: OwnerUser;
          tenant?: TenantInfo;
          role?: string;
          permissions?: string[];
          properties?: PropertyRef[];
        }>(response);

        if (!data?.user) {
          logout();
        } else {
          setUser(data.user);
          setTenant(data.tenant ?? null);
          setRole(data.role ?? null);
          setPermissions(data.permissions ?? []);
          setProperties(data.properties ?? []);
          scheduleTokenExpiry(stored);
          resetSessionTimeout();
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Auth check failed:', error);
          logout();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initAuth();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      tenantId: tenant?.id ?? null,
      tenant,
      role,
      permissions,
      properties,
      isAuthenticated: !!token && !!user,
      loading,
      isLoading: loading,
      sessionTimeoutMinutes,
      lastActivity,
      login,
      logout,
      refreshToken,
      refreshSession,
      setSessionTimeout,
    }),
    [
      user,
      token,
      tenant,
      role,
      permissions,
      properties,
      loading,
      sessionTimeoutMinutes,
      lastActivity,
      login,
      logout,
      refreshToken,
      refreshSession,
      setSessionTimeout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
