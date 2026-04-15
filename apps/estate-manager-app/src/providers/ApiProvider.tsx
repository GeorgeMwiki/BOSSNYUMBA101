'use client';

import { useEffect } from 'react';
import { initializeApiClient, getApiClient, hasApiClient } from '@bossnyumba/api-client';

function getApiBase(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (url) return url.endsWith('/api/v1') ? url : `${url.replace(/\/$/, '')}/api/v1`;
  if (process.env.NODE_ENV === 'production') return '';
  return 'http://localhost:4000/api/v1';
}
const API_BASE = getApiBase();

const AUTH_TOKEN_KEY = 'auth_token';
const ACTIVE_ORG_KEY = 'active_org_id';

function resolveTenantId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('tenant_id') || process.env.NEXT_PUBLIC_TENANT_ID || '';
  }
  return process.env.NEXT_PUBLIC_TENANT_ID || '';
}

// Provider callbacks read fresh from localStorage on every request, so
// changes made elsewhere (login flow, org switcher) take effect immediately
// without needing to re-call setAccessToken / setActiveOrgProvider.
function tokenProvider(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function activeOrgProvider(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_ORG_KEY);
}

function wireProviders(): void {
  if (!hasApiClient()) return;
  const client = getApiClient();
  client.setTokenProvider(tokenProvider);
  client.setActiveOrgProvider(activeOrgProvider);
}

(() => {
  if (typeof window !== 'undefined') {
    if (!hasApiClient()) {
      initializeApiClient({
        baseUrl: API_BASE,
        tenantId: resolveTenantId(),
        accessToken: localStorage.getItem(AUTH_TOKEN_KEY) || undefined,
      });
    }
    wireProviders();
  }
})();

export function ApiProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!hasApiClient()) {
      initializeApiClient({
        baseUrl: API_BASE,
        tenantId: resolveTenantId(),
        accessToken: localStorage.getItem(AUTH_TOKEN_KEY) || undefined,
      });
    }
    wireProviders();

    // Cross-tab sync: if another tab logs in / switches org, pick up the
    // change on focus. The providers themselves re-read on every request,
    // but this is defence in depth for UI that caches headers.
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_TOKEN_KEY || e.key === ACTIVE_ORG_KEY) {
        wireProviders();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return <>{children}</>;
}
