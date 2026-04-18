'use client';

import { ErrorBoundary, Toaster } from '@bossnyumba/design-system';
import { QueryProvider } from './QueryProvider';
import { ApiProvider } from './ApiProvider';
import { AuthProvider } from './AuthProvider';

export interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Client-side composition of providers for the estate-manager-app.
 * Mounts the shared design-system ErrorBoundary + Toaster so that every
 * route is covered, and every mutation can surface feedback via toast().
 *
 * AuthProvider sits *inside* QueryProvider so logout can call
 * queryClient.clear(); it sits *inside* ApiProvider so the initial
 * bootstrapping of the API client still runs before identity is read.
 */
export function AppShell({ children }: AppShellProps): JSX.Element {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <ApiProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ApiProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}
