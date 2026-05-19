'use client';

/**
 * CrossPortalListenerMount — boots the SSE listener that consumes the
 * gateway's `/api/v1/cross-portal/subscribe` channel and dispatches
 * `announcement` / `notification` / `state-mutation` / `wake-trigger`
 * events into the in-app toast + cache-invalidation surfaces.
 *
 * Mounted once at the root layout. The listener auto-reconnects on
 * transient gateway restarts (exponential backoff, capped at 30s) and
 * is torn down on unmount.
 *
 * Auth: the listener reads the customer-app bearer from localStorage
 * via the AuthContext. If the user has no token the mount short-
 * circuits — the listener never connects unauthenticated.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@bossnyumba/design-system';
import { useAuth } from '@/contexts/AuthContext';
import {
  startCrossPortalListener,
  type CrossPortalEvent,
  type CrossPortalListenerHandle,
} from '@/lib/cross-portal-listener';

const GATEWAY_BASE_URL =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL?.trim() || '';

export function CrossPortalListenerMount(): null {
  const { token, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const handleRef = useRef<CrossPortalListenerHandle | null>(null);
  // Track the live token in a ref so the listener's reconnect path
  // sees rotations without re-running the whole effect (closes H-3).
  const tokenRef = useRef<string | null>(token);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    const dispatch = (event: CrossPortalEvent): void => {
      switch (event.kind) {
        case 'announcement':
          toast({
            title: 'Announcement',
            // Closes round-3 M-14: cap server-pushed payload lengths.
            description: String(event.payload.message ?? '').slice(0, 280),
          });
          return;
        case 'notification':
          toast({
            title: String(event.payload.title ?? 'Notification').slice(0, 120),
            description: String(event.payload.message ?? '').slice(0, 280),
          });
          return;
        case 'state-mutation':
          // The gateway includes a `queryKey` array we can invalidate.
          // Defensive read — the payload shape is intentionally loose.
          if (Array.isArray(event.payload.queryKey)) {
            void queryClient.invalidateQueries({
              queryKey: event.payload.queryKey as ReadonlyArray<unknown>,
            });
          }
          return;
        case 'wake-trigger':
          // The brain wants the surface to surface proactively. The
          // simplest representation is a low-priority toast; deeper
          // wake-handling lives in the spotlight / widget.
          toast({
            title: 'Mr. Mwikila is asking for you',
            description: String(event.payload.reason ?? '').slice(0, 280),
          });
          return;
      }
    };

    let handle: CrossPortalListenerHandle | null = null;
    try {
      handle = startCrossPortalListener({
        // round-3 H-3: read the bearer fresh on every reconnect.
        getToken: () => tokenRef.current ?? '',
        baseUrl: GATEWAY_BASE_URL,
        onEvent: dispatch,
        onError: (err) => {
          // eslint-disable-next-line no-console
          console.warn('cross-portal-listener (customer-app) error:', err);
        },
      });
      handleRef.current = handle;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('cross-portal-listener (customer-app) failed to start:', err);
    }
    return (): void => {
      try {
        handle?.close();
      } catch {
        // swallow
      }
      handleRef.current = null;
    };
  }, [isAuthenticated, token, queryClient]);

  return null;
}
