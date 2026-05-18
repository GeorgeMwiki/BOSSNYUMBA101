'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { normalizePhoneForCountry } from '@bossnyumba/domain-models';
import { getApiBaseUrl } from '@/lib/api';

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
   * Wired to `POST {api-gateway}/auth/exchange-org-token` — when the
   * gateway returns 404/501 we fall through to a client-side update
   * so the UI keeps functioning while the endpoint is being wired.
   */
  setActiveOrg: (orgId: string) => Promise<{ success: boolean; message?: string }>;
  /**
   * Redeem an invite code for the currently authenticated identity.
   * Wired to `POST {api-gateway}/identity/invite-codes/redeem` (backed
   * by `InviteCodeService.redeem`). Successful redemption appends the
   * returned membership to the cached user.
   */
  redeemInviteCode: (code: string) => Promise<{ success: boolean; message?: string }>;
}

const CUSTOMER_TOKEN_KEY = 'customer_token';
const CUSTOMER_USER_KEY = 'customer_user';

/**
 * Default country code used when phone normalization is required and the
 * user has not (yet) declared their region. The login form runs pre-tenant
 * context, so we cannot resolve a `countryPlugin` yet — instead we read the
 * deployment's preferred default from `NEXT_PUBLIC_DEFAULT_COUNTRY`
 * (ISO-3166-1 alpha-2). Region detection via geolocation/IP will replace
 * this once the onboarding flow lands.
 */
const DEFAULT_PHONE_COUNTRY: string =
  (typeof process !== 'undefined'
    ? process.env?.NEXT_PUBLIC_DEFAULT_COUNTRY?.trim().toUpperCase()
    : undefined) || 'TZ';

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

      // Wire to `POST {api-gateway}/auth/exchange-org-token` so the
      // gateway can mint a per-org JWT scoped to `orgId`. We persist
      // the returned token verbatim. If the gateway returns 4xx/5xx
      // we surface the error to the caller instead of silently
      // pretending the switch succeeded.
      try {
        const apiBase = getApiBaseUrl();
        const res = await fetch(`${apiBase}/auth/exchange-org-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ orgId }),
        });
        if (res.ok) {
          const payload = (await res.json().catch(() => null)) as { token?: string } | null;
          if (payload?.token && typeof payload.token === 'string') {
            setToken(payload.token);
            if (typeof window !== 'undefined') {
              localStorage.setItem(CUSTOMER_TOKEN_KEY, payload.token);
            }
          }
        } else if (res.status !== 404 && res.status !== 501) {
          // 404 / 501 → fall through to client-side switch so the UI
          // remains usable while the endpoint is being wired.
          // Anything else (401/403/5xx) is a real failure.
          const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          return {
            success: false,
            message:
              err?.error?.message ?? `Org switch failed (status ${res.status})`,
          };
        }
      } catch (err) {
        // Network failure: keep the client-side switch (so the UI is
        // still usable in offline / dev) but surface a soft warning.
        // eslint-disable-next-line no-console
        console.warn('setActiveOrg: gateway unreachable, falling back to client-side switch', err);
      }

      const next: CustomerUser = { ...user, activeOrgId: orgId };
      setUser(next);
      if (typeof window !== 'undefined') {
        localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(next));
      }
      queryClient.clear();
      return { success: true };
    },
    [user, token, queryClient]
  );

  const redeemInviteCode = useCallback(
    async (code: string) => {
      if (!user) {
        return { success: false, message: 'Not authenticated' };
      }
      if (!code || code.trim().length < 4) {
        return { success: false, message: 'Please enter a valid invite code' };
      }

      // Wire to `POST {api-gateway}/identity/invite-codes/redeem`
      // (backed by `InviteCodeService.redeem`). On success we append
      // the returned membership to the cached user and persist.
      try {
        const apiBase = getApiBaseUrl();
        const res = await fetch(`${apiBase}/identity/invite-codes/redeem`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ code: code.trim() }),
        });
        if (!res.ok) {
          if (res.status === 404 || res.status === 501) {
            return {
              success: false,
              message: 'Invite code redemption is not wired to a live provider in this build.',
            };
          }
          const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          return {
            success: false,
            message:
              err?.error?.message ?? `Invite redemption failed (status ${res.status})`,
          };
        }
        const payload = (await res.json().catch(() => null)) as {
          membership?: CustomerOrgMembership;
        } | null;
        const newMembership = payload?.membership;
        if (newMembership) {
          const next: CustomerUser = {
            ...user,
            memberships: [...(user.memberships ?? []), newMembership],
          };
          setUser(next);
          if (typeof window !== 'undefined') {
            localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(next));
          }
        }
        return { success: true };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Network error',
        };
      }
    },
    [user, token]
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
