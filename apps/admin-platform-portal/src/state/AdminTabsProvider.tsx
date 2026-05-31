'use client';

/**
 * AdminTabsProvider — singleton provider for the admin-platform-portal
 * tab strip. Mounted once at the app root so every surface (Layout
 * strip, chat-tab-bridge, future SpawnTabMenu) shares the same state.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useAdminTabs as useAdminTabsHook, type UseAdminTabsApi } from './useAdminTabs';

const AdminTabsContext = createContext<UseAdminTabsApi | null>(null);

export interface AdminTabsProviderProps {
  readonly children: ReactNode;
}

export function AdminTabsProvider({
  children,
}: AdminTabsProviderProps): JSX.Element {
  const api = useAdminTabsHook();
  return (
    <AdminTabsContext.Provider value={api}>
      {children}
    </AdminTabsContext.Provider>
  );
}

export function useAdminTabs(): UseAdminTabsApi {
  const ctx = useContext(AdminTabsContext);
  if (!ctx) {
    throw new Error(
      'useAdminTabs must be used inside <AdminTabsProvider> — mount it once at the App root.',
    );
  }
  return ctx;
}

export function useOptionalAdminTabs(): UseAdminTabsApi | null {
  return useContext(AdminTabsContext);
}
