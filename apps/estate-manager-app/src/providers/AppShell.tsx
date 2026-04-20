'use client';

import { ErrorBoundary, Toaster } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { QueryProvider } from './QueryProvider';
import { ApiProvider } from './ApiProvider';
import { AuthProvider } from './AuthProvider';
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
 * Wave-21: fixed top-right LocaleSwitcher — the app has no dedicated
 * login page (field-staff flow), so this is the only reliable place to
 * surface the en/sw toggle before / during / after auth.
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
            <main id="main-content" tabIndex={-1}>{children}</main>
            <Toaster />
          </AuthProvider>
        </ApiProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}
