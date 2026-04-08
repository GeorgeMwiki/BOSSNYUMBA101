'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { WifiOff } from 'lucide-react';
import {
  flushMutationQueue,
  getMutationQueueLength,
  flushMutationQueueOnNextOnline,
  type FlushResult,
} from './pwa/offline-storage';

// ----------------------------------------------------------------------------
// OfflineQueueProvider
// ----------------------------------------------------------------------------
//
// Colocated here (rather than in a dedicated contexts/ file) because the
// worktree owner for this change is restricted to `offline-storage.ts` plus
// this single `OfflineBanner.tsx` under `src/lib/`. Consumers can still
// import `{ OfflineQueueProvider, useOfflineQueue }` from this module.

interface OfflineQueueContextValue {
  isOffline: boolean;
  queueLength: number;
  flush: () => Promise<FlushResult>;
  refresh: () => Promise<void>;
}

const OfflineQueueContext = createContext<OfflineQueueContextValue | null>(null);

export function OfflineQueueProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );
  const [queueLength, setQueueLength] = useState<number>(0);

  const refresh = useCallback(async () => {
    try {
      const len = await getMutationQueueLength();
      setQueueLength(len);
    } catch {
      // IndexedDB unavailable (SSR, private mode) — degrade silently.
    }
  }, []);

  const flush = useCallback(async () => {
    const result = await flushMutationQueue();
    await refresh();
    return result;
  }, [refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    void refresh();

    const handleOnline = async () => {
      setIsOffline(false);
      try {
        await flush();
      } catch {
        // Individual entries are retried with backoff by the queue.
      }
    };
    const handleOffline = () => {
      setIsOffline(true);
      flushMutationQueueOnNextOnline();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!navigator.onLine) {
      flushMutationQueueOnNextOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flush, refresh]);

  return (
    <OfflineQueueContext.Provider
      value={{ isOffline, queueLength, flush, refresh }}
    >
      {children}
    </OfflineQueueContext.Provider>
  );
}

export function useOfflineQueue(): OfflineQueueContextValue {
  const ctx = useContext(OfflineQueueContext);
  if (!ctx) {
    throw new Error('useOfflineQueue must be used within OfflineQueueProvider');
  }
  return ctx;
}

// ----------------------------------------------------------------------------
// OfflineBanner
// ----------------------------------------------------------------------------

/**
 * Small amber banner shown when the browser reports offline or when there are
 * pending queued mutations. Falls back to its own `navigator.onLine` listener
 * when rendered outside [OfflineQueueProvider], so it is safe to drop into
 * layouts that haven't wired the provider yet.
 */
export function OfflineBanner(): React.ReactElement | null {
  const ctx = useContext(OfflineQueueContext);
  const [standaloneOffline, setStandaloneOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );

  useEffect(() => {
    if (ctx) return; // provider handles its own listeners
    if (typeof window === 'undefined') return;
    const handleOnline = () => setStandaloneOffline(false);
    const handleOffline = () => setStandaloneOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [ctx]);

  const isOffline = ctx?.isOffline ?? standaloneOffline;
  const queueLength = ctx?.queueLength ?? 0;

  if (!isOffline && queueLength === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-500/95 px-4 py-2 text-sm font-medium text-amber-950"
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      {isOffline ? (
        <span>
          You&apos;re offline.{' '}
          {queueLength > 0
            ? `${queueLength} change${queueLength === 1 ? '' : 's'} will sync when reconnected.`
            : 'Changes will sync when you reconnect.'}
        </span>
      ) : (
        <span>
          Syncing {queueLength} pending change{queueLength === 1 ? '' : 's'}...
        </span>
      )}
    </div>
  );
}
