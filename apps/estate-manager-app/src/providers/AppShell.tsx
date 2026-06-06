'use client';

import { ErrorBoundary, Toaster } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { QueryProvider } from './QueryProvider';
import { ApiProvider } from './ApiProvider';
import { AuthProvider } from './AuthProvider';
import { AuthGate } from './AuthGate';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';

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
 *
 * AuthGate wraps the routed children so logged-out operators are bounced
 * to /login instead of rendering protected pages that would 401. The
 * public /login route renders through the gate untouched.
 *
 * Wave-21: fixed top-right LocaleSwitcher — surfaced here so the en/sw
 * toggle is available before / during / after auth (including on the
 * /login page).
 */
export function AppShell({ children }: AppShellProps): JSX.Element {
  const tA11y = useTranslations('a11y');
  return (
    <ErrorBoundary>
      <QueryProvider>
        <ApiProvider>
          <AuthProvider>
            <a href="#main-content" className="skip-link">
              {tA11y('skipToMain')}
            </a>
            <div className="fixed top-[calc(env(safe-area-inset-top)+0.5rem)] right-2 z-40">
              <LocaleSwitcher className="inline-flex items-center gap-2 text-xs text-gray-600 bg-white/90 backdrop-blur rounded shadow-sm px-1" />
            </div>
            <main id="main-content" tabIndex={-1}>
              <AuthGate>{children}</AuthGate>
            </main>
            <Toaster />
          </AuthProvider>
        </ApiProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}
