'use client';

/**
 * AuthProvider — estate-manager-app identity + session context.
 *
 * Supabase is the canonical auth (CLAUDE.md hard rule). This provider is
 * the single reactive mirror of the persisted Supabase session for the
 * React tree: it hydrates on mount, then keeps `user`/`tenant`/`token`
 * in sync with every auth transition (sign-in, sign-out, token refresh,
 * cross-tab change) via `onAuthStateChange`.
 *
 * The previous implementation stored an opaque `auth_token` in
 * localStorage and read it ad hoc. We have unified onto the Supabase
 * session — the access token comes from the live session and the tenant
 * id is read from the JWT `app_metadata.tenant_id` claim (server-managed;
 * `user_metadata` is never trusted), mirroring the api-gateway trust
 * boundary used by the customer-app.
 *
 * Operators are invited (no public signup); the email + password login
 * flow lives at `/login` and calls `signInWithEmailPassword` here.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { getApiClient, hasApiClient } from '@bossnyumba/api-client';
import { getSupabase } from '@/lib/supabase';

export interface ManagerUser {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role?: string;
  readonly avatarUrl?: string;
}

export interface ManagerTenant {
  readonly id: string;
  readonly name: string;
}

export interface AuthActionResult {
  readonly success: boolean;
  readonly message?: string;
}

interface AuthContextValue {
  readonly user: ManagerUser | null;
  readonly tenant: ManagerTenant | null;
  readonly token: string | null;
  readonly isAuthenticated: boolean;
  readonly loading: boolean;
  signInWithEmailPassword: (
    email: string,
    password: string
  ) => Promise<AuthActionResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
 * Project a Supabase user onto the UI's `ManagerUser`. Tenant + role are
 * read ONLY from `app_metadata` (server-managed) to mirror the
 * api-gateway's trust boundary; profile fields fall back to
 * `user_metadata` then to empty strings so freshly-invited accounts
 * render without crashing.
 */
function mapSupabaseUser(supabaseUser: SupabaseUser): {
  readonly user: ManagerUser;
  readonly tenant: ManagerTenant | null;
} {
  const appMeta = (supabaseUser.app_metadata ?? {}) as Record<string, unknown>;
  const userMeta = (supabaseUser.user_metadata ?? {}) as Record<
    string,
    unknown
  >;

  const firstName =
    readMetaString(userMeta, 'first_name') ??
    readMetaString(userMeta, 'firstName') ??
    '';
  const lastName =
    readMetaString(userMeta, 'last_name') ??
    readMetaString(userMeta, 'lastName') ??
    '';

  const tenantId = readMetaString(appMeta, 'tenant_id');
  const tenantName =
    readMetaString(appMeta, 'tenant_name') ??
    readMetaString(userMeta, 'tenant_name') ??
    '';

  return {
    user: {
      id: supabaseUser.id,
      email: supabaseUser.email ?? readMetaString(userMeta, 'email') ?? '',
      firstName,
      lastName,
      role: readMetaString(appMeta, 'role') ?? readMetaString(userMeta, 'role'),
      avatarUrl: readMetaString(userMeta, 'avatar_url'),
    },
    tenant: tenantId ? { id: tenantId, name: tenantName } : null,
  };
}

/**
 * Push the active access token into the shared api-client bearer so every
 * `*Service` call carries `Authorization`. `setAccessToken` requires a
 * string; when signing out we use `clearTokens()` (the client exposes no
 * `setAccessToken(undefined)`), so callers never pass an empty bearer.
 */
function syncApiClientToken(nextToken: string | null): void {
  if (!hasApiClient()) return;
  const client = getApiClient();
  if (nextToken) {
    client.setAccessToken(nextToken);
  } else {
    client.clearTokens();
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ManagerUser | null>(null);
  const [tenant, setTenant] = useState<ManagerTenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    let active = true;

    const applySession = (session: Session | null): void => {
      if (!active) return;
      if (session?.user) {
        const mapped = mapSupabaseUser(session.user);
        setUser(mapped.user);
        setTenant(mapped.tenant);
        setToken(session.access_token);
        syncApiClientToken(session.access_token);
      } else {
        setUser(null);
        setTenant(null);
        setToken(null);
        syncApiClientToken(null);
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

  const signInWithEmailPassword = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const trimmedEmail = email.trim();
      if (!trimmedEmail || !password) {
        return { success: false, message: 'Email and password are required.' };
      }
      try {
        const { data, error } = await getSupabase().auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) {
          return { success: false, message: error.message };
        }
        // Hydrate eagerly so callers that navigate on `success` see an
        // authenticated context immediately, without waiting for the
        // onAuthStateChange callback to fire.
        if (data.session?.user) {
          const mapped = mapSupabaseUser(data.session.user);
          setUser(mapped.user);
          setTenant(mapped.tenant);
          setToken(data.session.access_token);
          syncApiClientToken(data.session.access_token);
        }
        return { success: true };
      } catch (err) {
        return {
          success: false,
          message:
            err instanceof Error
              ? err.message
              : 'Could not sign in. Please try again.',
        };
      }
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await getSupabase().auth.signOut();
    } catch {
      // Network failure on sign-out: supabase-js still clears the local
      // session, so the user is logged out client-side regardless.
    }
    setToken(null);
    setUser(null);
    setTenant(null);
    syncApiClientToken(null);
    // Reset per-user cache so the next operator on the same device never
    // sees the previous user's scoped data.
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      tenant,
      token,
      isAuthenticated: !!token,
      loading,
      signInWithEmailPassword,
      logout,
    }),
    [user, tenant, token, loading, signInWithEmailPassword, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
