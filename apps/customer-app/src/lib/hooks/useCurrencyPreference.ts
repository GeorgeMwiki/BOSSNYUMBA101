/**
 * useCurrencyPreference — resolves the active display currency for the
 * customer-app session.
 *
 * Resolution chain (matches `currency-preferences.service` in
 * `@bossnyumba/database`):
 *
 *   user override (localStorage)           ← persisted by /settings page
 *     → user override (server)             ← from currency_preferences row
 *     → tenant default (server)            ← currency_preferences row
 *     → platform-default (server)          ← currency_preferences seed
 *     → ULTIMATE_FALLBACK ('USD')          ← last-resort literal
 *
 * The hook returns the locally-cached value immediately so amounts do
 * not flash on first paint, then upgrades to the server-resolved value
 * once the request settles. If the server returns 404 (endpoint not yet
 * deployed) or any other failure, the local value sticks — currency is
 * a display concern, never worth crashing a screen over.
 *
 * Co-located with this hook because every customer-app surface that
 * shows money depends on it.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { ApiClientError, hasApiClient, getApiClient } from '@bossnyumba/api-client';

/** localStorage key — must match the constant used by /settings page. */
export const CURRENCY_STORAGE_KEY = 'customer_display_currency';

/**
 * Defence-in-depth display fallback for the SSR-first paint when the
 * user has not yet picked a currency, no value is in localStorage, and
 * the server-side resolver has not yet replied. The normal flow always
 * resolves to a real user/tenant/platform-default row via
 * `/preferences/currency`; this literal exists ONLY to keep the UI
 * renderable during the millisecond window before that round-trip
 * completes. AM-4 hardcoded-fallback-purge keeps this as an explicit,
 * documented exception (UX always trumps a crash for display
 * concerns).
 */
export const EMERGENCY_DISPLAY_FALLBACK_CURRENCY = 'USD';
/** @deprecated Use `EMERGENCY_DISPLAY_FALLBACK_CURRENCY`. Same value, clearer name. */
export const FALLBACK_CURRENCY = EMERGENCY_DISPLAY_FALLBACK_CURRENCY;

export interface UseCurrencyPreferenceResult {
  /** ISO-4217 uppercase code (e.g. 'USD', 'KES', 'TZS'). Always defined. */
  readonly code: string;
  /** True while the server-side resolution request is in flight. */
  readonly isLoading: boolean;
  /** Server resolution failure, if any. The local value still works. */
  readonly error: Error | null;
  /**
   * Format a numeric amount in the resolved currency using
   * `Intl.NumberFormat`. Falls back to `${code} ${number}` if the
   * runtime does not support the requested currency.
   */
  readonly format: (amount: number) => string;
}

/**
 * SSR-safe synchronous read of the persisted user override. Returns
 * null on the server, or when the value is unset / unreadable.
 */
function readStoredCurrency(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (!raw) return null;
    const trimmed = raw.trim().toUpperCase();
    return trimmed.length === 0 ? null : trimmed;
  } catch {
    return null;
  }
}

/**
 * Build a memo-stable formatter for the given currency code. Wrapped
 * in try/catch because some browsers reject obscure ISO codes.
 */
function makeFormatter(code: string): (amount: number) => string {
  return (amount: number): string => {
    if (!Number.isFinite(amount)) return `${code} 0`;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code,
        currencyDisplay: 'code',
      }).format(amount);
    } catch {
      return `${code} ${amount.toLocaleString()}`;
    }
  };
}

/**
 * Server-side resolution. Returns null on any failure; never throws so
 * the consumer's local value stays intact.
 *
 * Endpoint: `GET /preferences/currency` — opt-in. The api-gateway will
 * resolve user → tenant → platform-default and reply with
 * `{ data: { currency: 'XXX' } }`. When the route is not yet deployed
 * the call returns null and the hook keeps the local value.
 */
async function resolveFromServer(signal: AbortSignal): Promise<string | null> {
  if (!hasApiClient()) return null;
  try {
    const response = (await getApiClient().get(
      '/preferences/currency',
      { signal },
    )) as { data?: { currency?: string } } | undefined;
    const code = response?.data?.currency;
    if (typeof code !== 'string' || code.trim().length === 0) return null;
    return code.trim().toUpperCase();
  } catch (err) {
    if (err instanceof ApiClientError) return null;
    if (err instanceof Error && err.name === 'AbortError') return null;
    return null;
  }
}

/**
 * Read-only React hook for the user's preferred display currency.
 *
 * Usage:
 *   const { code, format } = useCurrencyPreference();
 *   return <span>{format(invoice.amount)}</span>;
 */
export function useCurrencyPreference(): UseCurrencyPreferenceResult {
  // Read the stored override eagerly so first paint already has the
  // user's choice. SSR returns null → falls back to the emergency
  // display fallback until the server resolver replies.
  const initial = readStoredCurrency() ?? EMERGENCY_DISPLAY_FALLBACK_CURRENCY;
  const [code, setCode] = useState<string>(initial);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Re-sync from localStorage on mount in case the SSR pass returned
    // FALLBACK_CURRENCY but the browser actually has a stored value.
    const stored = readStoredCurrency();
    if (stored && stored !== code) {
      setCode(stored);
    }

    const controller = new AbortController();
    let active = true;

    void (async () => {
      try {
        const resolved = await resolveFromServer(controller.signal);
        if (!active) return;
        if (resolved && resolved !== code) {
          setCode(resolved);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err : new Error('currency-resolve-failed'));
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
    // The hook intentionally resolves only once on mount; re-fetching on
    // every code change would create a feedback loop with setCode.
  }, []);

  const format = useMemo(() => makeFormatter(code), [code]);

  return { code, isLoading, error, format };
}
