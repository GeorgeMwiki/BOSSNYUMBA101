'use client';

/**
 * CrossPortalListenerMount — admin-scoped SSE listener.
 *
 * Boots the gateway's `/api/v1/cross-portal/subscribe` channel for the
 * admin-platform portal. Admin operators see ALL announcements +
 * cross-tenant `state-mutation` invalidations because they routinely
 * read across the platform.
 *
 * Auth: admin-platform-portal reads the bearer from the Supabase
 * cookie (`sb-access-token`) — same path the JarvisConsole already
 * uses. No AuthContext exists, so we poll the cookie on mount + re-
 * authenticate when it changes (every 60s).
 */

import { useEffect, useRef, useState } from 'react';
import { useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from '@bossnyumba/design-system';
import {
  startCrossPortalListener,
  type CrossPortalEvent,
  type CrossPortalListenerHandle,
} from '@/lib/cross-portal-listener';

const GATEWAY_BASE_URL =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL?.trim() || '';
const COOKIE_POLL_MS = 60_000;

function readBearerFromCookie(): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/sb-access-token=([^;]+)/);
  return m ? decodeURIComponent(m[1] ?? '') : '';
}

/**
 * The admin-platform-portal does NOT mount a global `QueryClientProvider`
 * (individual feature pages opt in). To stay hook-safe, the listener
 * mounts a **dedicated** client only for cross-portal state-mutation
 * invalidations. Cache reuse with page-level clients would be ideal
 * but is out of scope — most admin pages refetch on focus anyway.
 */
const SHARED_QUERY_CLIENT = new QueryClient({
  defaultOptions: { queries: { retry: 0 } },
});

export function CrossPortalListenerMount(): JSX.Element {
  return (
    <QueryClientProvider client={SHARED_QUERY_CLIENT}>
      <InnerListenerMount />
    </QueryClientProvider>
  );
}

function InnerListenerMount(): null {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string>('');
  const handleRef = useRef<CrossPortalListenerHandle | null>(null);

  // Poll the cookie so a fresh sign-in / sign-out propagates without
  // forcing a full page reload. 60s cadence keeps the cost negligible.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setToken(readBearerFromCookie());
    const id = window.setInterval(() => {
      setToken(readBearerFromCookie());
    }, COOKIE_POLL_MS);
    return (): void => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!token) return;
    const dispatch = (event: CrossPortalEvent): void => {
      switch (event.kind) {
        case 'announcement':
          toast({
            title: 'Platform announcement',
            description: String(event.payload.message ?? ''),
          });
          return;
        case 'notification':
          toast({
            title: String(event.payload.title ?? 'Notification'),
            description: String(event.payload.message ?? ''),
          });
          return;
        case 'state-mutation':
          if (Array.isArray(event.payload.queryKey)) {
            void queryClient.invalidateQueries({
              queryKey: event.payload.queryKey as ReadonlyArray<unknown>,
            });
          }
          return;
        case 'wake-trigger':
          toast({
            title: 'Mr. Mwikila is asking for an operator',
            description: String(event.payload.reason ?? ''),
          });
          return;
      }
    };

    let handle: CrossPortalListenerHandle | null = null;
    try {
      handle = startCrossPortalListener({
        token,
        baseUrl: GATEWAY_BASE_URL,
        onEvent: dispatch,
        onError: (err) => {
          // eslint-disable-next-line no-console
          console.warn('cross-portal-listener (admin) error:', err);
        },
      });
      handleRef.current = handle;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('cross-portal-listener (admin) failed to start:', err);
    }
    return (): void => {
      try {
        handle?.close();
      } catch {
        // swallow
      }
      handleRef.current = null;
    };
  }, [token, queryClient]);

  return null;
}
