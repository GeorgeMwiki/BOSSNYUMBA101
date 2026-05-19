'use client';

/**
 * CrossPortalListenerMount — admin-scoped SSE listener.
 *
 * Boots the gateway's `/api/v1/cross-portal/subscribe` channel for the
 * admin-platform portal. Admin operators see ALL announcements +
 * cross-tenant `state-mutation` invalidations because they routinely
 * read across the platform.
 *
 * Closes round-3 H-2 (HIGH):
 *   Previous design read `sb-access-token` via `document.cookie` to
 *   build the bearer header. That was a contradiction-in-terms — the
 *   production cookie is httpOnly (correct), so the regex match always
 *   returned empty and the listener silently never connected. The
 *   fallback path (cookie NOT httpOnly) would have been worse: XSS
 *   could read the bearer and the cookie security guarantees were
 *   gone. Both branches are broken.
 *
 *   The new design fetches a short-lived bearer from a same-origin
 *   `/api/auth/token-for-sse` endpoint. The platform session cookie
 *   rides that request (`credentials: 'include'`) so we never read
 *   it from JS. The minted bearer is held only in memory.
 *
 * Closes round-3 H-3 (HIGH):
 *   The bearer was passed as a static `token` string. If silent
 *   refresh rotated it the listener kept the old value. The new
 *   listener API accepts a `getToken: () => string` callback so the
 *   bearer is re-read on every reconnect.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@bossnyumba/design-system';
import {
  startCrossPortalListener,
  type CrossPortalEvent,
  type CrossPortalListenerHandle,
} from '@/lib/cross-portal-listener';

const GATEWAY_BASE_URL =
  process.env.NEXT_PUBLIC_API_GATEWAY_URL?.trim() || '';
const TOKEN_REFRESH_MS = 60_000;

/**
 * Fetch a short-lived SSE bearer from a same-origin route. The
 * platform-session httpOnly cookie rides via `credentials: 'include'`.
 *
 * Returns `''` when the endpoint is unavailable; the caller treats
 * that as "not yet authenticated, do not start the listener".
 */
async function fetchSseBearer(): Promise<string> {
  if (typeof window === 'undefined') return '';
  try {
    const res = await fetch('/api/auth/token-for-sse', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) return '';
    const body = (await res.json().catch(() => null)) as
      | { token?: string }
      | null;
    return typeof body?.token === 'string' ? body.token : '';
  } catch {
    return '';
  }
}

export function CrossPortalListenerMount(): null {
  // Closes round-3 H-2 (the dedicated SHARED_QUERY_CLIENT was a
  // no-op — page-level QueryClientProviders own the real caches).
  // The listener now uses the surrounding page's QueryClient (mounted
  // by the layout); state-mutation invalidations therefore actually
  // hit live pages. If a page sits OUTSIDE a provider the
  // useQueryClient call throws synchronously and the listener silently
  // bails — exactly what we want.
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string>('');
  const handleRef = useRef<CrossPortalListenerHandle | null>(null);
  // A ref keeps the latest token visible to the listener's reconnect
  // path without re-running the effect — closes round-3 H-3.
  const tokenRef = useRef<string>('');

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const refreshToken = useCallback(async () => {
    const next = await fetchSseBearer();
    setToken((prev) => (prev === next ? prev : next));
  }, []);

  useEffect(() => {
    void refreshToken();
    if (typeof window === 'undefined') return;
    const id = window.setInterval(() => {
      void refreshToken();
    }, TOKEN_REFRESH_MS);
    return (): void => window.clearInterval(id);
  }, [refreshToken]);

  useEffect(() => {
    if (!token) return;
    const dispatch = (event: CrossPortalEvent): void => {
      switch (event.kind) {
        case 'announcement':
          toast({
            title: 'Platform announcement',
            // Closes round-3 M-14: cap server-pushed payload length so
            // a malicious / runaway emitter cannot fill the screen.
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
            title: 'Mr. Mwikila is asking for an operator',
            description: String(event.payload.reason ?? '').slice(0, 280),
          });
          return;
      }
    };

    let handle: CrossPortalListenerHandle | null = null;
    try {
      handle = startCrossPortalListener({
        // round-3 H-3: pass a fresh-read callback so reconnects
        // pick up the latest bearer from `tokenRef`.
        getToken: () => tokenRef.current,
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
