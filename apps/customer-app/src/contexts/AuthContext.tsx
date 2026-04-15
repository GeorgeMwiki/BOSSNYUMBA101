'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { hasApiClient, getApiClient } from '@bossnyumba/api-client';

export interface CustomerUser {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface AuthContextType {
  user: CustomerUser | null;
  token: string | null;
  activeOrgId: string | null;
  setActiveOrg: (orgId: string | null) => void;
  loading: boolean;
  isAuthenticated: boolean;
  loginWithPhone: (phone: string) => Promise<{ success: boolean; message?: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ success: boolean; message?: string }>;
  register: (data: {
    phone: string;
    firstName: string;
    lastName: string;
    email?: string;
  }) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const CUSTOMER_TOKEN_KEY = 'customer_token';
const CUSTOMER_USER_KEY = 'customer_user';
const CUSTOMER_ACTIVE_ORG_KEY = 'customer_active_org_id';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Keep refs so the provider callbacks registered on the ApiClient always
  // read the latest values without needing to re-register on every render.
  const tokenRef = useRef<string | null>(null);
  const activeOrgIdRef = useRef<string | null>(null);
  tokenRef.current = token;
  activeOrgIdRef.current = activeOrgId;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedToken = localStorage.getItem(CUSTOMER_TOKEN_KEY);
    const storedUser = localStorage.getItem(CUSTOMER_USER_KEY);
    const storedOrg = localStorage.getItem(CUSTOMER_ACTIVE_ORG_KEY);

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        localStorage.removeItem(CUSTOMER_USER_KEY);
      }
    }
    if (storedOrg) {
      setActiveOrgIdState(storedOrg);
    }
    setLoading(false);
  }, []);

  // Wire the auth state into the shared ApiClient so every outgoing request
  // picks up the current bearer token + X-Active-Org header automatically.
  // We register provider callbacks (not static values) so the client always
  // sees the latest values without us re-calling setAccessToken on each
  // change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasApiClient()) return;
    const client = getApiClient();
    client.setTokenProvider(() => tokenRef.current);
    client.setActiveOrgProvider(() => activeOrgIdRef.current);
    return () => {
      // On unmount, detach providers so a stale closure doesn't outlive the
      // provider tree (e.g. in tests / fast refresh).
      client.setTokenProvider(null);
      client.setActiveOrgProvider(null);
    };
  }, []);

  // Re-assert provider registration whenever token or activeOrgId changes.
  // This is a no-op in steady state (the refs are already current), but it
  // covers the case where the ApiClient is initialized AFTER AuthProvider
  // mounted (e.g. lazy `ensureClient()` path in lib/api.ts).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasApiClient()) return;
    const client = getApiClient();
    client.setTokenProvider(() => tokenRef.current);
    client.setActiveOrgProvider(() => activeOrgIdRef.current);
  }, [token, activeOrgId]);

  const setActiveOrg = useCallback((orgId: string | null) => {
    setActiveOrgIdState(orgId);
    if (typeof window !== 'undefined') {
      if (orgId) {
        localStorage.setItem(CUSTOMER_ACTIVE_ORG_KEY, orgId);
      } else {
        localStorage.removeItem(CUSTOMER_ACTIVE_ORG_KEY);
      }
    }
  }, []);

  const loginWithPhone = useCallback(async (phone: string) => {
    const normalized = phone.replace(/\D/g, '').replace(/^0/, '254');
    if (normalized.length < 9) {
      return { success: false, message: 'Please enter a valid phone number' };
    }

    return {
      success: false,
      message: 'Resident OTP authentication is not wired to a live provider in this build.',
    };
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    void phone;
    void otp;
    return {
      success: false,
      message: 'Resident OTP verification is not wired to a live provider in this build.',
    };
  }, []);

  const register = useCallback(
    async (data: { phone: string; firstName: string; lastName: string; email?: string }) => {
      void data;
      return {
        success: false,
        message: 'Resident self-registration is not wired to a live provider in this build.',
      };
    },
    []
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setActiveOrgIdState(null);
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_USER_KEY);
    localStorage.removeItem(CUSTOMER_ACTIVE_ORG_KEY);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        activeOrgId,
        setActiveOrg,
        loading,
        isAuthenticated: !!token,
        loginWithPhone,
        verifyOtp,
        register,
        logout,
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
