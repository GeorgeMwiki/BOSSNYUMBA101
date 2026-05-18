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

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const dispatch = (event: CrossPortalEvent): void => {
      switch (event.kind) {
        case 'announcement':
          toast({
            title: 'Announcement',
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
            title: 'Mr. Mwikila needs your attention',
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
