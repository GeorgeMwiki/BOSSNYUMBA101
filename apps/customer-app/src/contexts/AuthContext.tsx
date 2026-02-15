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

    // Demo: Simulate OTP send. In production, call API to send SMS.
    const storedPhone = `+${normalized}`;
    sessionStorage.setItem('otp_phone', storedPhone);
    sessionStorage.setItem('otp_code', '123456'); // Demo OTP
    return { success: true };
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    const storedPhone = sessionStorage.getItem('otp_phone');
    const storedOtp = sessionStorage.getItem('otp_code');

    if (!storedPhone || !storedOtp) {
      return { success: false, message: 'OTP expired. Please request a new one.' };
    }

    const normalizedPhone = phone.replace(/\D/g, '').replace(/^0/, '254');
    const storedNormalized = storedPhone.replace(/\D/g, '').replace(/^254/, '');

    if (!normalizedPhone.includes(storedNormalized) && !storedPhone.includes(normalizedPhone)) {
      return { success: false, message: 'Phone number mismatch' };
    }

    if (otp !== storedOtp) {
      return { success: false, message: 'Invalid OTP. Please try again.' };
    }

    // Demo: Create/login user. In production, call API.
    const demoUser: CustomerUser = {
      id: 'customer-1',
      phone: storedPhone,
      firstName: 'John',
      lastName: 'Kamau',
      email: 'john.kamau@example.com',
    };

    const demoToken = `demo-token-${Date.now()}`;
    setUser(demoUser);
    setToken(demoToken);
    localStorage.setItem(CUSTOMER_TOKEN_KEY, demoToken);
    localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(demoUser));
    sessionStorage.removeItem('otp_phone');
    sessionStorage.removeItem('otp_code');

    return { success: true };
  }, []);

  const register = useCallback(
    async (data: { phone: string; firstName: string; lastName: string; email?: string }) => {
      const normalized = data.phone.replace(/\D/g, '').replace(/^0/, '254');
      const storedPhone = `+${normalized}`;

      sessionStorage.setItem('otp_phone', storedPhone);
      sessionStorage.setItem('otp_code', '123456');
      sessionStorage.setItem('register_data', JSON.stringify(data));

      return { success: true };
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
