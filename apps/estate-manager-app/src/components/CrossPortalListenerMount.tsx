'use client';

/**
 * CrossPortalListenerMount — manager-scoped SSE listener.
 *
 * Boots the gateway's `/api/v1/cross-portal/subscribe` SSE channel for
 * the estate-manager-app. Auto-reconnects on transient drops; tears
 * down cleanly on logout / unmount.
 *
 * Manager surface dispatch rules (S4 sweep — same four kinds as the
 * customer-app but with toast variants tuned for ops):
 *   - announcement  → toast (info)
 *   - notification  → toast
 *   - state-mutation → React-Query invalidation (queryKey on payload)
 *   - wake-trigger  → toast prompting the manager to open Mr. Mwikila
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@bossnyumba/design-system';
import { useAuth } from '@/providers/AuthProvider';
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
  // Closes round-3 H-3: track the live bearer in a ref so reconnects
  // pick up rotations without re-running the whole effect.
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
          if (Array.isArray(event.payload.queryKey)) {
            void queryClient.invalidateQueries({
              queryKey: event.payload.queryKey as ReadonlyArray<unknown>,
            });
          }
          return;
        case 'wake-trigger':
          toast({
            title: 'Mr. Mwikila needs your attention',
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
          console.warn('cross-portal-listener (estate-manager) error:', err);
        },
      });
      handleRef.current = handle;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        'cross-portal-listener (estate-manager) failed to start:',
        err,
      );
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
