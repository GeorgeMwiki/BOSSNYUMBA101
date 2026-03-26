'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedToken = localStorage.getItem(CUSTOMER_TOKEN_KEY);
    const storedUser = localStorage.getItem(CUSTOMER_USER_KEY);

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        localStorage.removeItem(CUSTOMER_USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  const loginWithPhone = useCallback(async (phone: string) => {
    const normalized = phone.replace(/\D/g, '').replace(/^0/, '254');
    if (normalized.length < 9) {
      return { success: false, message: 'Please enter a valid phone number' };
    }

    try {
      const { getApiClient } = await import('@bossnyumba/api-client');
      const client = getApiClient();
      await client.post('/auth/otp/send', { phone: normalized });
      return { success: true };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Failed to send OTP. Please try again.' };
    }
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    try {
      const { getApiClient } = await import('@bossnyumba/api-client');
      const client = getApiClient();
      const res = await client.post<{ token: string; user: CustomerUser }>('/auth/otp/verify', { phone, otp });
      if (res.data?.token && res.data?.user) {
        setToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem(CUSTOMER_TOKEN_KEY, res.data.token);
        localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(res.data.user));
        return { success: true };
      }
      return { success: false, message: 'Invalid verification response' };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'OTP verification failed. Please try again.' };
    }
  }, []);

  const register = useCallback(
    async (data: { phone: string; firstName: string; lastName: string; email?: string }) => {
      try {
        const { getApiClient } = await import('@bossnyumba/api-client');
        const client = getApiClient();
        const res = await client.post<{ token: string; user: CustomerUser }>('/auth/register', data);
        if (res.data?.token && res.data?.user) {
          setToken(res.data.token);
          setUser(res.data.user);
          localStorage.setItem(CUSTOMER_TOKEN_KEY, res.data.token);
          localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(res.data.user));
          return { success: true };
        }
        return { success: true, message: 'Account created' };
      } catch (err) {
        return { success: false, message: err instanceof Error ? err.message : 'Registration failed. Please try again.' };
      }
    },
    []
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_USER_KEY);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
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
