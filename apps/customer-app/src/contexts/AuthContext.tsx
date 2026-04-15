'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

export interface CustomerUser {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface AuthResult {
  success: boolean;
  message?: string;
  requiresOtp?: boolean;
}

interface AuthContextType {
  user: CustomerUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  loginWithPhone: (phone: string) => Promise<AuthResult>;
  loginWithPassword: (identifier: string, password: string) => Promise<AuthResult>;
  verifyOtp: (phone: string, otp: string) => Promise<AuthResult>;
  register: (data: {
    phone: string;
    firstName: string;
    lastName: string;
    email?: string;
    nationalId?: string;
    inviteCode?: string;
  }) => Promise<AuthResult>;
  logout: () => void;
}

const CUSTOMER_TOKEN_KEY = 'customer_token';
const CUSTOMER_USER_KEY = 'customer_user';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('0')) return `254${digits.slice(1)}`;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

interface AuthResponseShape {
  token?: string;
  accessToken?: string;
  user?: CustomerUser;
  customer?: CustomerUser;
  requiresOtp?: boolean;
}

function persistSession(token: string, user: CustomerUser) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(user));
}

function readAuthPayload(payload: unknown): { token: string | null; user: CustomerUser | null } {
  const p = (payload ?? {}) as AuthResponseShape;
  const token = p.token ?? p.accessToken ?? null;
  const user = p.user ?? p.customer ?? null;
  return { token, user };
}

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

  const loginWithPhone = useCallback(async (phone: string): Promise<AuthResult> => {
    const normalized = normalizePhone(phone);
    if (normalized.length < 12) {
      return { success: false, message: 'Please enter a valid phone number' };
    }

    try {
      await api.auth.requestOtp(normalized);
      return { success: true, requiresOtp: true };
    } catch (error) {
      return {
        success: false,
        message: extractErrorMessage(error, 'Failed to send OTP. Please try again.'),
      };
    }
  }, []);

  const loginWithPassword = useCallback(
    async (identifier: string, password: string): Promise<AuthResult> => {
      if (!identifier.trim() || !password) {
        return { success: false, message: 'Please provide credentials' };
      }

      try {
        const payload = await api.auth.loginWithPassword(identifier.trim(), password);
        const { token: nextToken, user: nextUser } = readAuthPayload(payload);

        if (!nextToken || !nextUser) {
          return { success: false, message: 'Unexpected response from server' };
        }

        persistSession(nextToken, nextUser);
        setToken(nextToken);
        setUser(nextUser);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          message: extractErrorMessage(error, 'Invalid email or password'),
        };
      }
    },
    []
  );

  const verifyOtp = useCallback(async (phone: string, otp: string): Promise<AuthResult> => {
    if (otp.trim().length !== 6) {
      return { success: false, message: 'Enter the 6-digit code' };
    }

    try {
      const payload = await api.auth.verifyOtp(normalizePhone(phone), otp.trim());
      const { token: nextToken, user: nextUser } = readAuthPayload(payload);

      if (!nextToken || !nextUser) {
        return { success: false, message: 'Unexpected response from server' };
      }

      persistSession(nextToken, nextUser);
      setToken(nextToken);
      setUser(nextUser);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: extractErrorMessage(error, 'Invalid or expired code'),
      };
    }
  }, []);

  const register = useCallback(
    async (data: {
      phone: string;
      firstName: string;
      lastName: string;
      email?: string;
      nationalId?: string;
      inviteCode?: string;
    }): Promise<AuthResult> => {
      const normalizedPhone = normalizePhone(data.phone);
      if (normalizedPhone.length < 12) {
        return { success: false, message: 'Please enter a valid Kenyan phone number' };
      }
      if (!data.firstName.trim() || !data.lastName.trim()) {
        return { success: false, message: 'Please provide your full name' };
      }

      try {
        const payload = await api.auth.register({
          ...data,
          phone: normalizedPhone,
        });

        const { token: nextToken, user: nextUser } = readAuthPayload(payload);

        // If API returns a token immediately, complete signup.
        if (nextToken && nextUser) {
          persistSession(nextToken, nextUser);
          setToken(nextToken);
          setUser(nextUser);
          return { success: true };
        }

        // Otherwise require OTP verification.
        return { success: true, requiresOtp: true };
      } catch (error) {
        return {
          success: false,
          message: extractErrorMessage(error, 'Registration failed. Please try again.'),
        };
      }
    },
    []
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CUSTOMER_TOKEN_KEY);
      localStorage.removeItem(CUSTOMER_USER_KEY);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!token,
        loginWithPhone,
        loginWithPassword,
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
