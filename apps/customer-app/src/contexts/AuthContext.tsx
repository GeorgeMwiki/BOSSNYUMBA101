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

    return {
      success: false,
      message: 'OTP authentication is temporarily unavailable. Please try again later.',
    };
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    void phone;
    void otp;
    return {
      success: false,
      message: 'OTP verification is temporarily unavailable. Please try again later.',
    };
  }, []);

  const register = useCallback(
    async (data: { phone: string; firstName: string; lastName: string; email?: string }) => {
      void data;
      return {
        success: false,
        message: 'Registration is temporarily unavailable. Please try again later.',
      };
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
