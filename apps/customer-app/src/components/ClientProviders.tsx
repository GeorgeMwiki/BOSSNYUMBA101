'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { ErrorBoundary, Toaster } from '@bossnyumba/design-system';
import { AuthProvider } from '@/contexts/AuthContext';
import { registerServiceWorker } from '@/lib/pwa/register-sw';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { UpdatePrompt } from '@/components/pwa/UpdatePrompt';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Defaults mirror the other BOSSNYUMBA apps (admin-portal,
  // estate-manager-app, owner-portal). Keep them in sync so cache
  // behaviour is predictable across the whole platform.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      registerServiceWorker().catch(() => {});
    }
  }, []);

  return (
    <>
      {children}
      <OfflineIndicator />
      <InstallPrompt />
      <UpdatePrompt />
    </>
  );
}

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <AuthProvider>
          <PWAProvider>{children}</PWAProvider>
        </AuthProvider>
        <Toaster />
      </QueryProvider>
    </ErrorBoundary>
  );
}
