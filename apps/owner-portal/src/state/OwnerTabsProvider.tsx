/**
 * OwnerTabsProvider — singleton provider for the owner-cockpit tab strip.
 *
 * Mounted ONCE at the App root so every surface (Layout strip, ChatPanel
 * tap, SpawnTabMenu, brain-SSE listener) shares the same state and the
 * augment-in-place dedup works across all entry points.
 *
 * The hook `useOwnerTabs()` re-exports the singleton; calling it without
 * the provider throws (so missing-provider bugs surface immediately).
 */

import { createContext, useContext, type ReactNode } from 'react';
import {
  useOwnerTabs as useOwnerTabsHook,
  type UseOwnerTabsApi,
} from './useOwnerTabs';

const OwnerTabsContext = createContext<UseOwnerTabsApi | null>(null);

export interface OwnerTabsProviderProps {
  readonly children: ReactNode;
}

export function OwnerTabsProvider({
  children,
}: OwnerTabsProviderProps): JSX.Element {
  const api = useOwnerTabsHook();
  return (
    <OwnerTabsContext.Provider value={api}>
      {children}
    </OwnerTabsContext.Provider>
  );
}

export function useOwnerTabs(): UseOwnerTabsApi {
  const ctx = useContext(OwnerTabsContext);
  if (!ctx) {
    throw new Error(
      'useOwnerTabs must be used inside <OwnerTabsProvider> — mount it once at the App root.',
    );
  }
  return ctx;
}

/**
 * Optional variant — returns null instead of throwing when used outside
 * the provider. Useful for components that mount in both authed and
 * unauthed contexts (the marketing widget never has the provider).
 */
export function useOptionalOwnerTabs(): UseOwnerTabsApi | null {
  return useContext(OwnerTabsContext);
}
