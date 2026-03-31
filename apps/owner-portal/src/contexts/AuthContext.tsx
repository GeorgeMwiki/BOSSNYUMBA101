import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';

// Owner Portal Role Hierarchy
export const ROLES = {
  OWNER: 'OWNER',
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN_1: 'ADMIN_TIER_1',
  ADMIN_2: 'ADMIN_TIER_2',
  ADMIN_3: 'ADMIN_TIER_3',
  ADMIN_4: 'ADMIN_TIER_4',
} as const;

export type OwnerPortalRole = typeof ROLES[keyof typeof ROLES];

// Role hierarchy level (lower number = more access)
const ROLE_HIERARCHY: Record<string, number> = {
  [ROLES.OWNER]: 0,
  [ROLES.SUPER_ADMIN]: 1,
  [ROLES.ADMIN_1]: 2,
  [ROLES.ADMIN_2]: 3,
  [ROLES.ADMIN_3]: 4,
  [ROLES.ADMIN_4]: 5,
};

export function hasMinimumRole(userRole: string | null, requiredRole: string): boolean {
  if (!userRole) return false;
  const userLevel = ROLE_HIERARCHY[userRole] ?? 999;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
  return userLevel <= requiredLevel;
}

export function canAccessModule(userRole: string | null, module: string): boolean {
  if (!userRole) return false;
  const level = ROLE_HIERARCHY[userRole] ?? 999;

  // Modules available at each tier
  const moduleAccess: Record<string, number> = {
    // Owner & Super Admin only (level <= 1)
    'users': 1,
    'roles': 1,
    'configuration': 1,
    'audit': 1,
    'integrations': 1,
    // Admin Tier 1+ (level <= 2)
    'financial': 2,
    'budgets': 2,
    'reports': 2,
    'ai': 2,
    // Admin Tier 2+ (level <= 3)
    'properties': 3,
    'tenants': 3,
    'maintenance': 3,
    'communications': 3,
    'operations': 3,
    'support': 3,
    'compliance': 3,
    'vendors': 3,
    // Admin Tier 3+ (read-only + maintenance requests) (level <= 4)
    'dashboard': 5,
    'portfolio': 5,
    'analytics': 5,
    'messages': 5,
    'documents': 5,
    'approvals': 5,
    'settings': 5,
  };

  const requiredLevel = moduleAccess[module] ?? 1;
  return level <= requiredLevel;
}

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(
    parseInt(localStorage.getItem('sessionTimeout') || String(DEFAULT_SESSION_TIMEOUT))
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
