'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export type StkPollState =
  | { kind: 'idle' }
  | { kind: 'polling'; attempt: number }
  | { kind: 'succeeded'; receiptNumber?: string }
  | { kind: 'failed'; reason: string }
  | { kind: 'timeout' };

interface UseStkPollingOptions {
  readonly intentId: string | null;
  /** Hard timeout in ms. Defaults to 60s (Daraja's STK push timeout). */
  readonly timeoutMs?: number;
  /** Base poll interval in ms. Exponential backoff capped at 8s. */
  readonly baseIntervalMs?: number;
}

const TERMINAL_SUCCESS = new Set(['succeeded', 'completed', 'success', 'paid']);
const TERMINAL_FAILURE = new Set([
  'failed',
  'expired',
  'cancelled',
  'canceled',
  'rejected',
]);

/**
 * Poll the api-gateway for STK-push status with exponential backoff and a
 * hard timeout. Resets to `idle` when `intentId` becomes null.
 *
 * Returns immutable state — callers must call `reset()` to clear. The
 * polling loop is reset whenever `intentId` changes.
 */
export function useStkPolling({
  intentId,
  timeoutMs = 60_000,
  baseIntervalMs = 3_000,
}: UseStkPollingOptions): {
  readonly state: StkPollState;
  readonly secondsRemaining: number;
} {
  const [state, setState] = useState<StkPollState>({ kind: 'idle' });
  const [secondsRemaining, setSecondsRemaining] = useState<number>(
    Math.floor(timeoutMs / 1000),
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!intentId) {
      setState({ kind: 'idle' });
      setSecondsRemaining(Math.floor(timeoutMs / 1000));
      return undefined;
    }

    let cancelled = false;
    let attempt = 0;
    const startedAt = Date.now();

    // Countdown for UI
    setSecondsRemaining(Math.floor(timeoutMs / 1000));
    intervalRef.current = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((timeoutMs - (Date.now() - startedAt)) / 1000),
      );
      setSecondsRemaining(remaining);
    }, 1000);

    async function poll() {
      if (cancelled) return;
      attempt += 1;
      setState({ kind: 'polling', attempt });

      try {
        const result = await api.payments.getIntentStatus(intentId!);
        if (cancelled) return;
        const status = String(result?.status ?? '').toLowerCase();
        if (TERMINAL_SUCCESS.has(status)) {
          setState({
            kind: 'succeeded',
            receiptNumber: result?.receiptNumber,
          });
          return;
        }
        if (TERMINAL_FAILURE.has(status)) {
          setState({
            kind: 'failed',
            reason: String(result?.reason ?? status),
          });
          return;
        }
      } catch {
        // Transient errors are swallowed and the loop continues — the
        // hard timeout will eventually fire if the backend stays down.
        if (cancelled) return;
      }

      // Exponential backoff: 3s, 4.5s, 6.75s, capped at 8s.
      const delay = Math.min(baseIntervalMs * 1.5 ** Math.max(0, attempt - 1), 8_000);
      const elapsed = Date.now() - startedAt;
      if (elapsed + delay >= timeoutMs) {
        setState({ kind: 'timeout' });
        return;
      }
      timerRef.current = setTimeout(poll, delay);
    }

    void poll();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [intentId, timeoutMs, baseIntervalMs]);

  return { state, secondsRemaining };
}
