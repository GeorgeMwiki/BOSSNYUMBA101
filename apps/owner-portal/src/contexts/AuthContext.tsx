import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
}

interface Property {
  id: string;
  name: string;
}

interface AuthApiResponse<T> {
  success?: boolean;
  data?: { success?: boolean; data?: T; error?: { message?: string } } | T;
}

interface AuthMePayload {
  user: User;
  tenant: Tenant;
  role: string;
  permissions?: string[];
  properties?: Property[];
}

interface AuthLoginPayload extends AuthMePayload {
  token: string;
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
const MIN_SESSION_TIMEOUT = 1;
const MAX_SESSION_TIMEOUT = 24 * 60;
// Throttle interval for activity-driven session refreshes (ms)
const ACTIVITY_THROTTLE_MS = 30 * 1000;

function readStoredSessionTimeout(): number {
  const raw = localStorage.getItem('sessionTimeout');
  const parsed = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed < MIN_SESSION_TIMEOUT) {
    return DEFAULT_SESSION_TIMEOUT;
  }
  return Math.min(parsed, MAX_SESSION_TIMEOUT);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(readStoredSessionTimeout);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);

  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshRef = useRef<number>(0);

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
  }, []);

  const resetSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    const safeMinutes = Math.max(
      MIN_SESSION_TIMEOUT,
      Math.min(sessionTimeoutMinutes, MAX_SESSION_TIMEOUT)
    );
    const timeoutMs = safeMinutes * 60 * 1000;
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

    const now = new Date();
    setLastActivity(now);
    localStorage.setItem('lastActivity', now.toISOString());
    lastRefreshRef.current = now.getTime();
  }, [sessionTimeoutMinutes, logout]);

  const refreshSession = useCallback(() => {
    if (token) {
      resetSessionTimeout();
    }
  }, [token, resetSessionTimeout]);

  const setSessionTimeout = useCallback((minutes: number) => {
    if (!Number.isFinite(minutes) || minutes < MIN_SESSION_TIMEOUT) {
      return;
    }
    const safe = Math.min(Math.floor(minutes), MAX_SESSION_TIMEOUT);
    setSessionTimeoutMinutes(safe);
    localStorage.setItem('sessionTimeout', String(safe));
    if (token) {
      resetSessionTimeout();
    }
  }, [token, resetSessionTimeout]);

  // Track user activity (throttled to avoid resetting timers on every keystroke)
  useEffect(() => {
    if (!token) return;

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < ACTIVITY_THROTTLE_MS) {
        return;
      }
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

  // Cross-tab synchronization: react to token/activity changes from other tabs
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'token') {
        if (event.newValue === null) {
          // Another tab logged out
          setToken(null);
          setUser(null);
          setTenant(null);
          setRole(null);
          setPermissions([]);
          setProperties([]);
          if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
          if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
        } else if (event.newValue !== token) {
          // Another tab logged in / changed user; pick up the new token
          setToken(event.newValue);
        }
      } else if (event.key === 'lastActivity' && event.newValue) {
        const parsed = Date.parse(event.newValue);
        if (!Number.isNaN(parsed)) {
          lastRefreshRef.current = parsed;
          setLastActivity(new Date(parsed));
        }
      } else if (event.key === 'sessionTimeout' && event.newValue) {
        const parsed = parseInt(event.newValue, 10);
        if (Number.isFinite(parsed) && parsed >= MIN_SESSION_TIMEOUT) {
          setSessionTimeoutMinutes(Math.min(parsed, MAX_SESSION_TIMEOUT));
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [token]);

  // Check for existing session on mount
  useEffect(() => {
    const storedLastActivity = localStorage.getItem('lastActivity');
    if (storedLastActivity && token) {
      const lastActivityTime = new Date(storedLastActivity).getTime();
      const now = Date.now();
      const timeoutMs = sessionTimeoutMinutes * 60 * 1000;

      if (Number.isFinite(lastActivityTime) && now - lastActivityTime > timeoutMs) {
        // Session has expired
        logout('timeout');
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const response = (await api.get('/auth/me')) as AuthApiResponse<AuthMePayload>;
          if (response.data?.success || response.success) {
            const data = (response.data?.data ?? response.data) as AuthMePayload | undefined;
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
      const response = (await api.post('/auth/login', { email, password })) as AuthApiResponse<AuthLoginPayload>;

      if (response.data?.success || response.success) {
        const data = (response.data?.data ?? response.data) as AuthLoginPayload;
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
