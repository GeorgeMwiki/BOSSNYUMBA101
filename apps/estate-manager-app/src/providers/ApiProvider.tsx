'use client';

import { useEffect } from 'react';
import { initializeApiClient, getApiClient } from '@bossnyumba/api-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

(() => {
  if (typeof window !== 'undefined') {
    try {
      getApiClient();
    } catch {
      initializeApiClient({
        baseUrl: API_BASE,
        tenantId: 'tenant-001',
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
        tenantId: 'tenant-001',
        accessToken: token || undefined,
      });
    }
  }, []);

  return <>{children}</>;
}
