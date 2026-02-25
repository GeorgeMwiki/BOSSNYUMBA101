'use client';

import { useEffect } from 'react';
import { initializeApiClient, getApiClient } from '@bossnyumba/api-client';

function getApiBase(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (url) return url.endsWith('/api/v1') ? url : `${url.replace(/\/$/, '')}/api/v1`;
  if (process.env.NODE_ENV === 'production') return '';
  return 'http://localhost:4000/api/v1';
}
const API_BASE = getApiBase();

function resolveTenantId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('tenant_id') || process.env.NEXT_PUBLIC_TENANT_ID || '';
  }
  return process.env.NEXT_PUBLIC_TENANT_ID || '';
}

(() => {
  if (typeof window !== 'undefined') {
    try {
      getApiClient();
    } catch {
      initializeApiClient({
        baseUrl: API_BASE,
        tenantId: resolveTenantId(),
        accessToken: localStorage.getItem('auth_token') || undefined,
      });
    }
  }
})();

export function ApiProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    try {
      const client = getApiClient();
      if (token) client.setAccessToken(token);
    } catch {
      initializeApiClient({
        baseUrl: API_BASE,
        tenantId: resolveTenantId(),
        accessToken: token || undefined,
      });
    }
  }, []);

  return <>{children}</>;
}
