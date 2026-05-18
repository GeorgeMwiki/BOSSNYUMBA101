/**
 * CrossPortalListenerMount — owner-scoped SSE listener.
 *
 * Boots the gateway's `/api/v1/cross-portal/subscribe` channel for the
 * owner-portal (Vite + react-router-dom). Owner operators see tenant-
 * scoped announcements + state-mutation invalidations.
 *
 * Auth: reads the bearer from `localStorage['token']` — same path the
 * api-client + JarvisShell use. Re-arms whenever the token changes via
 * a 60s poll (no AuthContext event-bus exists yet).
 */

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@bossnyumba/design-system';
import {
  startCrossPortalListener,
  type CrossPortalEvent,
  type CrossPortalListenerHandle,
} from '../lib/cross-portal-listener';

const GATEWAY_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const COOKIE_POLL_MS = 60_000;

function readBearer(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem('token') ?? '';
  } catch {
    return '';
  }
}

export function CrossPortalListenerMount(): null {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string>(() => readBearer());
  const handleRef = useRef<CrossPortalListenerHandle | null>(null);

  // Polls localStorage; AuthContext doesn't yet emit token change events.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = window.setInterval(() => {
      const next = readBearer();
      setToken((prev) => (prev === next ? prev : next));
    }, COOKIE_POLL_MS);
    return (): void => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!token) return;
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
            title: 'Mr. Mwikila is asking for you',
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
          console.warn('cross-portal-listener (owner) error:', err);
        },
      });
      handleRef.current = handle;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('cross-portal-listener (owner) failed to start:', err);
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
