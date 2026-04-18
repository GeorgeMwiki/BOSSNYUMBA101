'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { normalizePhoneForCountry } from '@bossnyumba/domain-models';

/**
 * Shape of a single org membership surfaced to the UI. Mirrors (a subset
 * of) the domain-layer `OrgMembership` — IDs are plain strings here so
 * the browser bundle does not depend on the branded-type module.
 */
export interface CustomerOrgMembership {
  id: string;
  organizationId: string;
  nickname?: string;
  status: 'ACTIVE' | 'LEFT' | 'BLOCKED';
}

export interface CustomerUser {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email?: string;
  /**
   * Global cross-org identity ID (see domain-models/identity/tenant-identity.ts).
   * Optional while the backend migration rolls out — legacy single-org
   * sessions omit this field.
   */
  tenantIdentityId?: string;
  /**
   * All memberships attached to this identity. Empty for fresh installs
   * that have not yet redeemed an invite code.
   */
  memberships?: CustomerOrgMembership[];
  /**
   * Currently scoped organization. UI and API client use this to set the
   * `X-Org-Context` header so the gateway can enforce isolation.
   */
  activeOrgId?: string;
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
  /**
   * Switch the active organization scope. Invalidates cached per-org
   * state; API calls made after the switch carry the new org context.
   * TODO: wire to real session-exchange endpoint when backend is ready.
   */
  setActiveOrg: (orgId: string) => Promise<{ success: boolean; message?: string }>;
  /**
   * Redeem an invite code for the currently authenticated identity.
   * Creates a fresh `OrgMembership` server-side. TODO: wire to
   * `InviteCodeService.redeem` when backend is ready.
   */
  redeemInviteCode: (code: string) => Promise<{ success: boolean; message?: string }>;
}

const CUSTOMER_TOKEN_KEY = 'customer_token';
const CUSTOMER_USER_KEY = 'customer_user';

/**
 * Default country code used when phone normalization is required and the
 * user has not (yet) declared their region. Tanzania is the founder
 * tenant; region detection via geolocation/IP will replace this once the
 * onboarding flow lands.
 */
const DEFAULT_PHONE_COUNTRY: string = 'TZ';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
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
    // Region-driven normalization replaces the previous hardcoded "254"
    // so new countries adopted by RegionConfig work with zero code
    // changes. `DEFAULT_PHONE_COUNTRY` will be replaced by a detected
    // country code once onboarding region-detection is wired.
    const normalized = normalizePhoneForCountry(phone, DEFAULT_PHONE_COUNTRY);
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
    localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_USER_KEY);
    // Reset per-user cache so another resident on the same device never
    // sees the previous user's scoped data.
    queryClient.clear();
  }, [queryClient]);

  const setActiveOrg = useCallback(
    async (orgId: string) => {
      if (!user) {
        return { success: false, message: 'Not authenticated' };
      }
      const membership = user.memberships?.find((m) => m.organizationId === orgId);
      if (!membership) {
        return { success: false, message: 'You are not a member of that organization' };
      }
      if (membership.status !== 'ACTIVE') {
        return { success: false, message: 'Membership is not active' };
      }
      // TODO: call /auth/exchange-org-token to get a per-org scoped JWT.
      // For now we persist locally AND clear the React Query cache so
      // per-org scoped queries (e.g. rent history, requests) don't leak
      // from the previously-active org after the switch.
      const next: CustomerUser = { ...user, activeOrgId: orgId };
      setUser(next);
      if (typeof window !== 'undefined') {
        localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(next));
      }
      queryClient.clear();
      return { success: true };
    },
    [user, queryClient]
  );

  const redeemInviteCode = useCallback(
    async (code: string) => {
      if (!user) {
        return { success: false, message: 'Not authenticated' };
      }
      if (!code || code.trim().length < 4) {
        return { success: false, message: 'Please enter a valid invite code' };
      }
      // TODO: call POST /identity/invite-codes/redeem (backed by
      // InviteCodeService.redeem) and append the returned membership.
      return {
        success: false,
        message: 'Invite code redemption is not wired to a live provider in this build.',
      };
    },
    [user]
  );

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
        setActiveOrg,
        redeemInviteCode,
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
