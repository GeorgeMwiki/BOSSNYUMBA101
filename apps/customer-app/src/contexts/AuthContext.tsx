'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { hasApiClient, getApiClient } from '@bossnyumba/api-client';

export interface CustomerUser {
  id: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface TenantInfo {
  id: string;
  name?: string;
  slug?: string;
}

export interface DecodedJwt {
  userId?: string;
  sub?: string;
  tenantId?: string;
  role?: string;
  permissions?: string[];
  propertyAccess?: string[];
  email?: string;
  exp?: number;
  iat?: number;
}

export interface LoginResult {
  success: boolean;
  message?: string;
}

/**
 * Cross-tenant membership entry returned by `/auth/me`. Mirrors the
 * `MembershipBundle` shape from `@bossnyumba/domain-models`. The customer-
 * app + estate-manager-app are multi-org: a single user identity can be
 * a tenant in N different landlord orgs (or a manager serving N owners).
 */
export interface OrgMembership {
  /** Stable id from the membership row (or 'primary' for the user's home tenant). */
  id: string;
  /** The landlord/property-management-company tenant id. */
  tenantId: string;
  /** Optional pin to a specific org within the tenant. */
  organizationId: string | null;
  /** Role inside this membership's tenant. */
  role: string;
  /** Human-readable label shown in the org switcher. */
  displayLabel: string | null;
  /** True if this is the user's primary/home tenant. */
  isPrimary: boolean;
}

interface AuthContextType {
  // Canonical shape required by parallel agents.
  user: CustomerUser | null;
  token: string | null;
  activeOrgId: string | null;
  setActiveOrg: (orgId: string | null) => void;
  loading: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** @deprecated use `isLoading`. */
  loading: boolean;

  // Derived claims for convenience.
  role: string | null;
  permissions: string[];

  // Cross-tenant membership state (foundation: multi-owner customer/manager).
  /** All memberships for the current user (primary + cross-tenant). */
  memberships: OrgMembership[];
  /** The currently selected membership's tenant id. Drives X-Active-Org. */
  activeOrgId: string | null;
  /** Switch the active membership. Persists to localStorage. */
  setActiveOrg: (membershipIdOrTenantId: string) => void;

  // Region + language (foundation: drives policy + i18n).
  /** User's selected region (TZ / KE / OTHER). */
  region: 'TZ' | 'KE' | 'OTHER' | null;
  /** User's selected UI language. */
  language: 'en' | 'sw' | null;

  // Actions (new canonical API).
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;

  // Back-compat OTP helpers — existing login/otp/register pages import these.
  loginWithPhone: (phone: string) => Promise<LoginResult>;
  verifyOtp: (phone: string, otp: string) => Promise<LoginResult>;
  register: (data: {
    phone: string;
    firstName: string;
    lastName: string;
    email?: string;
  }) => Promise<LoginResult>;
}

const CUSTOMER_TOKEN_KEY = 'customer_token';
const CUSTOMER_USER_KEY = 'customer_user';
const CUSTOMER_ACTIVE_ORG_KEY = 'customer_active_org_id';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApiBaseUrl(): string {
  if (typeof process !== 'undefined') {
    const url = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (url) {
      const base = url.replace(/\/$/, '');
      return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
    }
  }
  return 'http://localhost:4000/api/v1';
}

/** Decode a JWT payload without verifying — the server is the source of truth. */
export const decodeJwt = decodeJwtUtil;

export const isTokenExpired = isTokenExpiredUtil;

function writeTokenToStorage(token: string, user: CustomerUser | null) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(LEGACY_TOKEN_KEY, token);
  if (user) localStorage.setItem(LEGACY_USER_KEY, JSON.stringify(user));
}

function clearTokenFromStorage() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(LEGACY_USER_KEY);
}

function readTokenFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem(AUTH_TOKEN_KEY) ??
    localStorage.getItem(LEGACY_TOKEN_KEY) ??
    null
  );
}

async function apiJson<T>(
  path: string,
  init: RequestInit & { token?: string | null } = {}
): Promise<{ ok: boolean; status: number; body: T | undefined }> {
  const { token, headers, ...rest } = init;
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  });
  let body: T | undefined;
  try {
    body = (await response.json()) as T;
  } catch {
    body = undefined;
  }
  return { ok: response.ok, status: response.status, body };
}

interface LoginResponseBody {
  success: boolean;
  data?: {
    token: string;
    user: CustomerUser;
    tenant?: TenantInfo;
    role?: string;
    permissions?: string[];
  };
  error?: { code?: string; message?: string };
}

interface MeResponseBody {
  success: boolean;
  data?: {
    user: CustomerUser & {
      region?: 'TZ' | 'KE' | 'OTHER';
      language?: 'en' | 'sw';
    };
    tenant?: TenantInfo;
    role?: string;
    permissions?: string[];
    memberships?: OrgMembership[];
  };
  error?: { code?: string; message?: string };
}

interface RefreshResponseBody {
  success: boolean;
  data?: { token: string; expiresAt?: string };
  error?: { code?: string; message?: string };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

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

  const verifyOtp = useCallback(async (_phone: string, _otp: string): Promise<LoginResult> => {
    return {
      success: false,
      message: 'Resident OTP verification is not wired to a live provider in this build.',
    };
  }, []);

  const register = useCallback(
    async (_data: {
      phone: string;
      firstName: string;
      lastName: string;
      email?: string;
    }): Promise<LoginResult> => {
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
