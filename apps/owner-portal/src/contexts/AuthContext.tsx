import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, ACTIVE_ORG_STORAGE_KEY } from '../lib/api';

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
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  role: string | null;
  permissions: string[];
  properties: Property[];
  memberships: Membership[];
  activeOrgId: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  sessionTimeoutMinutes: number;
  lastActivity: Date | null;
  login: (email: string, password: string) => Promise<void>;
  logout: (reason?: string) => void;
  refreshSession: () => void;
  setSessionTimeout: (minutes: number) => void;
  setActiveOrg: (tenantId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default session timeout in minutes (configurable)
const DEFAULT_SESSION_TIMEOUT = 30;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(
    localStorage.getItem(ACTIVE_ORG_STORAGE_KEY)
  );
  const [loading, setLoading] = useState(true);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(
    parseInt(localStorage.getItem('sessionTimeout') || String(DEFAULT_SESSION_TIMEOUT))
  );
  const [lastActivity, setLastActivity] = useState<Date | null>(null);

  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback((reason?: string) => {
    localStorage.removeItem('token');
    localStorage.removeItem('lastActivity');
    localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setTenant(null);
    setRole(null);
    setPermissions([]);
    setProperties([]);
    setMemberships([]);
    setActiveOrgId(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySessionData = useCallback((data: any) => {
    setUser(data.user ?? null);
    setTenant(data.tenant ?? null);
    setRole(data.role ?? null);
    setPermissions(data.permissions || []);
    setProperties(data.properties || []);
    setMemberships(data.memberships || []);
    const nextOrgId = data.activeOrgId ?? data.tenant?.id ?? null;
    setActiveOrgId(nextOrgId);
    if (nextOrgId) {
      localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, nextOrgId);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const response = await api.get<any>('/auth/me');
          if (response.success && response.data) {
            applySessionData(response.data);
            resetSessionTimeout();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const login = async (email: string, password: string) => {
    const response = await api.post<any>('/auth/login', { email, password });

    if (!response.success || !response.data) {
      // Surface the server's error message verbatim.
      throw new Error(response.error?.message || 'Login failed');
    }

    const data = response.data;
    const newToken: string | undefined = data.token;
    if (!newToken) {
      throw new Error('Login response missing token');
    }
    localStorage.setItem('token', newToken);
    setToken(newToken);
    applySessionData(data);
    resetSessionTimeout();
  };

  const setActiveOrg = useCallback(async (tenantId: string) => {
    if (!tenantId) return;
    // Optimistic local update so subsequent calls carry X-Active-Org
    localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, tenantId);
    setActiveOrgId(tenantId);

    const response = await api.post<any>('/auth/switch-org', { tenantId });
    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to switch organization');
    }
    const data = response.data;
    if (data.token) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
    }
    applySessionData(data);
  }, [applySessionData]);

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        role,
        permissions,
        properties,
        memberships,
        activeOrgId,
        isAuthenticated: !!token && !!user,
        loading,
        sessionTimeoutMinutes,
        lastActivity,
        login,
        logout,
        refreshSession,
        setSessionTimeout,
        setActiveOrg,
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
