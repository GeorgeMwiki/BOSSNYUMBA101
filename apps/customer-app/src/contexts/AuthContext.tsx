'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { normalizePhoneForCountry } from '@bossnyumba/domain-models';
import { getApiBaseUrl } from '@/lib/api';
import { getCsrfHeaders } from '@/lib/csrf';
import { getSupabase } from '@/lib/supabase';

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
   * Server-managed tenant assignment, read from the Supabase JWT
   * `app_metadata.tenant_id`. The api-gateway REQUIRES this claim to live
   * in `app_metadata` (server-managed) — `user_metadata` is rejected — so
   * we surface it verbatim for diagnostics and org-scoping UI.
   */
  tenantId?: string;
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

/**
 * Read a string field from a JSON-ish metadata bag without trusting the
 * shape. Returns `undefined` for anything that is not a non-empty string.
 */
function readMetaString(
  meta: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = meta?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Project a Supabase session/user onto the UI's `CustomerUser`. The
 * tenant assignment is read ONLY from `app_metadata` (server-managed) to
 * mirror the api-gateway's trust boundary; profile fields fall back to
 * `user_metadata` then to empty strings so the avatar/profile render
 * without crashing for freshly-created accounts.
 */
function mapSupabaseUser(supabaseUser: SupabaseUser): CustomerUser {
  const appMeta = (supabaseUser.app_metadata ?? {}) as Record<string, unknown>;
  const userMeta = (supabaseUser.user_metadata ?? {}) as Record<string, unknown>;

  const firstName =
    readMetaString(userMeta, 'first_name') ??
    readMetaString(userMeta, 'firstName') ??
    '';
  const lastName =
    readMetaString(userMeta, 'last_name') ??
    readMetaString(userMeta, 'lastName') ??
    '';

  return {
    id: supabaseUser.id,
    phone: supabaseUser.phone ?? readMetaString(userMeta, 'phone') ?? '',
    firstName,
    lastName,
    email: supabaseUser.email ?? readMetaString(userMeta, 'email'),
    tenantId: readMetaString(appMeta, 'tenant_id'),
    activeOrgId: readMetaString(appMeta, 'active_org_id'),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from the existing Supabase session on mount, then keep the
  // context in sync with every auth transition (sign-in, sign-out, token
  // refresh, cross-tab changes). The Supabase client persists the session
  // in localStorage and auto-refreshes the access token — we are the
  // single reactive mirror of that state for the React tree.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supabase = getSupabase();
    let active = true;

    const applySession = (session: Session | null) => {
      if (!active) return;
      if (session?.user) {
        setUser((prev) => {
          const next = mapSupabaseUser(session.user);
          // Preserve client-side org-scope choices (activeOrgId can be set
          // via setActiveOrg before the gateway mints app_metadata) and any
          // memberships appended by redeemInviteCode within this session.
          return {
            ...next,
            activeOrgId: prev?.activeOrgId ?? next.activeOrgId,
            memberships: prev?.memberships ?? next.memberships,
          };
        });
        setToken(session.access_token);
      } else {
        setUser(null);
        setToken(null);
      }
    };

    supabase.auth
      .getSession()
      .then(({ data }) => applySession(data.session))
      .catch(() => applySession(null))
      .finally(() => {
        if (active) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
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

    try {
      const { error } = await getSupabase().auth.signInWithOtp({
        phone: normalized,
      });
      if (error) {
        return { success: false, message: error.message };
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Could not send the verification code',
      };
    }
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    const normalized = normalizePhoneForCountry(phone, DEFAULT_PHONE_COUNTRY);
    try {
      const { data, error } = await getSupabase().auth.verifyOtp({
        phone: normalized,
        token: otp,
        type: 'sms',
      });
      if (error) {
        return { success: false, message: error.message };
      }
      // verifyOtp establishes the session. Hydrate eagerly so callers that
      // navigate on `success` see an authenticated context immediately,
      // without waiting for the onAuthStateChange callback to fire.
      if (data.session?.user) {
        setUser(mapSupabaseUser(data.session.user));
        setToken(data.session.access_token);
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Invalid verification code',
      };
    }
  }, []);

  const register = useCallback(
    async (data: { phone: string; firstName: string; lastName: string; email?: string }) => {
      const normalized = normalizePhoneForCountry(data.phone, DEFAULT_PHONE_COUNTRY);
      if (normalized.length < 9) {
        return { success: false, message: 'Please enter a valid phone number' };
      }

      try {
        // Supabase creates the user on first verify. We pass the profile
        // fields as user_metadata so they are attached to the new account;
        // `shouldCreateUser` is the default but we set it explicitly to
        // document intent. Tenant assignment happens server-side (the
        // gateway writes app_metadata.tenant_id) — never from the client.
        const { error } = await getSupabase().auth.signInWithOtp({
          phone: normalized,
          options: {
            shouldCreateUser: true,
            data: {
              first_name: data.firstName,
              last_name: data.lastName,
              ...(data.email ? { email: data.email } : {}),
            },
          },
        });
        if (error) {
          return { success: false, message: error.message };
        }
        return { success: true };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Could not start registration',
        };
      }
    },
    []
  );

  const logout = useCallback(() => {
    // signOut clears the persisted session and triggers onAuthStateChange,
    // which resets user/token. We also reset state + cache eagerly so the
    // UI never flashes stale data between the call and the callback.
    void getSupabase()
      .auth.signOut()
      .catch(() => {
        // Network failure on sign-out: the local session is still cleared
        // by supabase-js, so the user is logged out client-side regardless.
      });
    setToken(null);
    setUser(null);
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
      // gateway can mint a per-org JWT scoped to `orgId`. If the gateway
      // returns 4xx/5xx (other than not-yet-wired 404/501) we surface the
      // error to the caller instead of silently pretending it succeeded.
      try {
        const apiBase = getApiBaseUrl();
        const res = await fetch(`${apiBase}/auth/exchange-org-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...getCsrfHeaders(),
          },
          body: JSON.stringify({ orgId }),
        });
        if (!res.ok && res.status !== 404 && res.status !== 501) {
          // 404 / 501 → fall through to client-side switch so the UI
          // remains usable while the endpoint is being wired.
          // Anything else (401/403/5xx) is a real failure.
          const err = (await res.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          return {
            success: false,
            message: err?.error?.message ?? `Org switch failed (status ${res.status})`,
          };
        }
      } catch (err) {
        // Network failure: keep the client-side switch (so the UI is still
        // usable in offline / dev) but surface a soft warning.
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Org switch failed (network error)',
        };
      }

      const next: CustomerUser = { ...user, activeOrgId: orgId };
      setUser(next);
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
      // the returned membership to the cached user.
      try {
        const apiBase = getApiBaseUrl();
        const res = await fetch(`${apiBase}/identity/invite-codes/redeem`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...getCsrfHeaders(),
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
          const err = (await res.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          return {
            success: false,
            message: err?.error?.message ?? `Invite redemption failed (status ${res.status})`,
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
