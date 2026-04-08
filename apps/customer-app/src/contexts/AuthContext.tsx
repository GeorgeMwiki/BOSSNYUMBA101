'use client';

/**
 * Customer-app AuthContext
 *
 * Real JWT-backed auth wired to the api-gateway `/auth` routes:
 *   POST /auth/login    -> { token, user, tenant, role, permissions, properties, expiresAt }
 *   GET  /auth/me       -> { user, tenant, role, permissions, properties }
 *   POST /auth/refresh  -> { token, expiresAt }
 *
 * Exposes the shape `{ user, token, tenantId }` that parallel agents assume,
 * plus full `login / logout / refreshToken` actions and backwards-compatible
 * `loginWithPhone / verifyOtp / register` helpers kept so the existing login
 * pages continue to work until OTP is migrated.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AUTH_TOKEN_KEY as AUTH_TOKEN_KEY_CONST,
  decodeJwt as decodeJwtUtil,
  isTokenExpired as isTokenExpiredUtil,
} from './auth-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  /**
   * The currently active tenant id for API scoping. Equals the active
   * membership's tenantId if multi-org, else the user's primary tenant.
   */
  tenantId: string | null;

  // State flags.
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AUTH_TOKEN_KEY = AUTH_TOKEN_KEY_CONST;
// Legacy keys kept in sync so `lib/api.ts` / other consumers still read them.
const LEGACY_TOKEN_KEY = 'customer_token';
const LEGACY_USER_KEY = 'customer_user';
/** Persisted active membership id so the org switcher survives reload. */
const ACTIVE_ORG_KEY = 'bossnyumba:auth:activeOrgId';

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
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Cross-tenant membership + region/language state.
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [region, setRegion] = useState<'TZ' | 'KE' | 'OTHER' | null>(null);
  const [language, setLanguage] = useState<'en' | 'sw' | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearState = useCallback(() => {
    setUser(null);
    setToken(null);
    setTenant(null);
    setRole(null);
    setPermissions([]);
    setMemberships([]);
    setActiveOrgIdState(null);
    setRegion(null);
    setLanguage(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ACTIVE_ORG_KEY);
    }
  }, []);

  /**
   * Switch the active membership. Accepts either the membership row id or
   * the tenant id (resolves to the matching membership). Persists to
   * localStorage so subsequent reloads pick up the same active org.
   */
  const setActiveOrg = useCallback(
    (membershipIdOrTenantId: string) => {
      const match = memberships.find(
        (m) => m.id === membershipIdOrTenantId || m.tenantId === membershipIdOrTenantId,
      );
      const nextId = match ? match.tenantId : membershipIdOrTenantId;
      setActiveOrgIdState(nextId);
      if (typeof window !== 'undefined') {
        localStorage.setItem(ACTIVE_ORG_KEY, nextId);
      }
    },
    [memberships],
  );

  const logout = useCallback(() => {
    clearTokenFromStorage();
    clearState();
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, [clearState]);

  const scheduleExpiry = useCallback(
    (nextToken: string) => {
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
      const claims = decodeJwt(nextToken);
      if (!claims?.exp) return;
      const msUntilExpiry = claims.exp * 1000 - Date.now();
      if (msUntilExpiry <= 0) {
        logout();
        return;
      }
      expiryTimerRef.current = setTimeout(() => {
        logout();
      }, msUntilExpiry);
    },
    [logout]
  );

  const applyToken = useCallback(
    (
      nextToken: string,
      nextUser: CustomerUser | null,
      nextTenant?: TenantInfo | null,
      nextRole?: string | null,
      nextPerms?: string[] | null,
      nextMemberships?: OrgMembership[] | null,
      nextRegion?: 'TZ' | 'KE' | 'OTHER' | null,
      nextLanguage?: 'en' | 'sw' | null,
    ) => {
      const claims = decodeJwt(nextToken);
      const tenantFromClaims = claims?.tenantId ? { id: claims.tenantId } : null;
      const mergedTenant = nextTenant ?? tenantFromClaims;
      writeTokenToStorage(nextToken, nextUser);
      setToken(nextToken);
      setUser(nextUser);
      setTenant(mergedTenant);
      setRole(nextRole ?? claims?.role ?? null);
      setPermissions(nextPerms ?? claims?.permissions ?? []);
      // Memberships: backend sends `memberships`. If absent, synthesize a
      // single primary entry from the user's home tenant so the org
      // switcher always has at least one entry.
      const resolvedMemberships: OrgMembership[] =
        nextMemberships && nextMemberships.length > 0
          ? nextMemberships
          : mergedTenant
          ? [
              {
                id: 'primary',
                tenantId: mergedTenant.id,
                organizationId: null,
                role: nextRole ?? claims?.role ?? 'CUSTOMER',
                displayLabel: mergedTenant.name ?? null,
                isPrimary: true,
              },
            ]
          : [];
      setMemberships(resolvedMemberships);
      // Pick active org: prefer persisted choice if it matches a current
      // membership, else the primary, else the first.
      let nextActive: string | null = null;
      if (typeof window !== 'undefined') {
        const persisted = localStorage.getItem(ACTIVE_ORG_KEY);
        if (
          persisted &&
          resolvedMemberships.some((m) => m.tenantId === persisted)
        ) {
          nextActive = persisted;
        }
      }
      if (!nextActive && resolvedMemberships.length > 0) {
        nextActive =
          resolvedMemberships.find((m) => m.isPrimary)?.tenantId ??
          resolvedMemberships[0].tenantId;
      }
      setActiveOrgIdState(nextActive);
      if (nextActive && typeof window !== 'undefined') {
        localStorage.setItem(ACTIVE_ORG_KEY, nextActive);
      }
      // Region + language come from the user record on /auth/me.
      if (nextRegion !== undefined) setRegion(nextRegion);
      if (nextLanguage !== undefined) setLanguage(nextLanguage);
      scheduleExpiry(nextToken);
    },
    [scheduleExpiry]
  );

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      try {
        const { ok, body } = await apiJson<LoginResponseBody>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        if (!ok || !body?.success || !body.data?.token) {
          return {
            success: false,
            message: body?.error?.message ?? 'Invalid email or password',
          };
        }
        applyToken(
          body.data.token,
          body.data.user,
          body.data.tenant ?? null,
          body.data.role ?? null,
          body.data.permissions ?? []
        );
        return { success: true };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Network error',
        };
      }
    },
    [applyToken]
  );

  const refreshToken = useCallback(async (): Promise<boolean> => {
    const current = readTokenFromStorage();
    if (!current) return false;
    try {
      const { ok, body } = await apiJson<RefreshResponseBody>('/auth/refresh', {
        method: 'POST',
        token: current,
      });
      if (!ok || !body?.success || !body.data?.token) {
        logout();
        return false;
      }
      applyToken(body.data.token, user, tenant, role, permissions);
      return true;
    } catch {
      logout();
      return false;
    }
  }, [applyToken, logout, user, tenant, role, permissions]);

  // Back-compat OTP helpers. Kept so existing login/otp/register pages compile.
  const loginWithPhone = useCallback(async (phone: string): Promise<LoginResult> => {
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

  // Hydrate on mount: read token, verify with /auth/me, schedule expiry.
  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const stored = readTokenFromStorage();
      if (!stored) {
        setIsLoading(false);
        return;
      }
      if (isTokenExpired(stored)) {
        clearTokenFromStorage();
        setIsLoading(false);
        return;
      }

      try {
        const { ok, body } = await apiJson<MeResponseBody>('/auth/me', {
          method: 'GET',
          token: stored,
        });
        if (cancelled) return;
        if (!ok || !body?.success || !body.data) {
          clearTokenFromStorage();
          clearState();
        } else {
          applyToken(
            stored,
            body.data.user,
            body.data.tenant ?? null,
            body.data.role ?? null,
            body.data.permissions ?? [],
            body.data.memberships ?? null,
            body.data.user?.region ?? null,
            body.data.user?.language ?? null,
          );
        }
      } catch {
        if (!cancelled) {
          // Network failure on hydrate: keep token but decode claims locally so
          // the user is not logged out on a transient error.
          const claims = decodeJwt(stored);
          if (claims) {
            applyToken(
              stored,
              {
                id: claims.userId ?? claims.sub ?? 'unknown',
                email: claims.email,
              },
              claims.tenantId ? { id: claims.tenantId } : null,
              claims.role ?? null,
              claims.permissions ?? []
            );
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      // tenantId derives from the active membership when present, else
      // falls back to the user's primary tenant. This is what consumers
      // (api-client, server X-Active-Org header) should read.
      tenantId: activeOrgId ?? tenant?.id ?? null,
      isAuthenticated: !!token && !!user,
      isLoading,
      loading: isLoading,
      role,
      permissions,
      memberships,
      activeOrgId,
      setActiveOrg,
      region,
      language,
      login,
      logout,
      refreshToken,
      loginWithPhone,
      verifyOtp,
      register,
    }),
    [
      user,
      token,
      tenant,
      isLoading,
      role,
      permissions,
      memberships,
      activeOrgId,
      setActiveOrg,
      region,
      language,
      login,
      logout,
      refreshToken,
      loginWithPhone,
      verifyOtp,
      register,
    ]
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
