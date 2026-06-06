'use client';

import { useEffect } from 'react';
import {
  initializeApiClient,
  getApiClient,
  hasApiClient,
} from '@bossnyumba/api-client';
import { getSupabase, getAccessToken } from '@/lib/supabase';

function getApiBase(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (url) return url.endsWith('/api/v1') ? url : `${url.replace(/\/$/, '')}/api/v1`;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'estate-manager-app: NEXT_PUBLIC_API_URL is required in production builds.'
    );
  }
  return 'http://localhost:4000/api/v1';
}

/**
 * Initialise the shared api-client and bind the Supabase session as the
 * single bearer credential.
 *
 * Unified onto Supabase (CLAUDE.md hard rule): the previous boot read an
 * opaque `auth_token` from localStorage. We now resolve the bearer from
 * the live Supabase session on EVERY request via a request interceptor —
 * the same pattern as customer-app — so data, chat, and brain calls all
 * use one credential and pick up token refreshes automatically. The
 * gateway derives the tenant from the verified JWT `app_metadata.tenant_id`
 * claim, so we never send a (stale) `X-Tenant-ID` from the client.
 */
function ensureClient(): void {
  if (hasApiClient()) return;

  const client = initializeApiClient({
    baseUrl: getApiBase(),
    timeout: 15000,
    retries: 1,
    onAuthError: () => {
      // The Supabase access token is the single credential. On a 401 the
      // session is stale/expired — clear it and bounce to /login. signOut
      // is fire-and-forget; AuthProvider's onAuthStateChange resets React
      // state when it completes.
      void getSupabase()
        .auth.signOut()
        .catch(() => undefined);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    },
  });

  client.addRequestInterceptor(async (config) => {
    const token = await getAccessToken();
    if (token) {
      client.setAccessToken(token);
    } else {
      client.clearTokens();
    }
    return config;
  });
}

export function ApiProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      ensureClient();
    } catch {
      // initializeApiClient throws only when NEXT_PUBLIC_API_URL is unset
      // in production; surfacing here would crash the tree, so we let the
      // first real request fail loudly with a network error instead.
      if (hasApiClient()) {
        // Client already exists from a prior mount — nothing to do.
        return;
      }
    }
  }, []);

  return <>{children}</>;
}
