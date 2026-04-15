import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
}

export interface MfaChallenge {
  challengeId: string;
  method: 'totp' | 'sms' | 'email';
  destination?: string;
}

export type LoginOutcome =
  | { kind: 'success' }
  | { kind: 'mfa_required'; challenge: MfaChallenge };

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginOutcome>;
  verifyMfa: (challengeId: string, code: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface LoginResponse {
  token?: string;
  user?: User;
  mfaRequired?: boolean;
  challenge?: MfaChallenge;
}

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT'];

function persistSession(token: string, user: User) {
  localStorage.setItem('admin_token', token);
  localStorage.setItem('admin_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('admin_token');
    const storedUser = localStorage.getItem('admin_user');

    if (storedToken && storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as User;
        setToken(storedToken);
        setUser(parsed);
      } catch {
        clearSession();
      }
    }
    setLoading(false);
  }, []);

  const finalize = (resolvedToken: string, resolvedUser: User) => {
    if (!ADMIN_ROLES.includes(resolvedUser.role)) {
      clearSession();
      throw new Error('Access denied. Admin privileges required.');
    }
    setToken(resolvedToken);
    setUser(resolvedUser);
    persistSession(resolvedToken, resolvedUser);
  };

  const login = async (email: string, password: string): Promise<LoginOutcome> => {
    const response = await api.post<LoginResponse>('/auth/login', { email, password });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Login failed');
    }

    const payload = response.data;

    if (payload.mfaRequired && payload.challenge) {
      return { kind: 'mfa_required', challenge: payload.challenge };
    }

    if (!payload.token || !payload.user) {
      throw new Error('Login failed: malformed response from server.');
    }

    finalize(payload.token, payload.user);
    return { kind: 'success' };
  };

  const verifyMfa = async (challengeId: string, code: string) => {
    const response = await api.post<LoginResponse>('/auth/mfa/verify', { challengeId, code });
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Verification failed');
    }
    if (!response.data.token || !response.data.user) {
      throw new Error('Verification failed: malformed response from server.');
    }
    finalize(response.data.token, response.data.user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    clearSession();
    void api.post('/auth/logout', {}).catch(() => undefined);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        verifyMfa,
        logout,
        isAuthenticated: !!token,
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
