/**
 * useTenantCurrency — resolves the active ISO-4217 display currency for
 * the owner-portal session.
 *
 * Why this hook exists
 * --------------------
 *
 *   Wave 4-I locked `@bossnyumba/api-client#formatCurrency` so it now
 *   throws when `currency` is missing instead of silently defaulting to
 *   `'USD'` (which was hostile to every non-US tenant in the platform).
 *   Owner-portal had ~135 `formatCurrency(amount)` callsites that would
 *   blow up at render time without this remediation.
 *
 *   This hook threads the active tenant currency through every screen
 *   that displays money. It follows the platform currency-resolution
 *   chain (user override → tenant default → undefined) but reads from
 *   the in-process `AuthContext` (owner-portal's tenant identity is
 *   already bound at login) instead of going back to the server.
 *
 * Resolution chain
 * ----------------
 *
 *   1. User override in `localStorage` (`OWNER_DISPLAY_CURRENCY`)
 *      — persisted by the /settings page when the operator picks a
 *      display currency. Wins over everything so an operator who wants
 *      to view their portfolio in USD can do so without changing
 *      tenant config.
 *   2. Tenant `defaultCurrency` from `AuthContext`
 *      — the canonical per-tenant choice, set by the platform at
 *      onboarding and surfaced through `/auth/me`.
 *   3. `undefined`
 *      — when neither source has a value (loading, logged-out, or a
 *      tenant seeded before the migration ran). The hook deliberately
 *      does NOT pick a hard-coded fallback — that's the bug Wave 4-I
 *      fixed. Consumers must render a placeholder (`'—'`) instead of
 *      calling `formatCurrency` with a guessed code.
 *
 * Usage
 * -----
 *
 *   const currency = useTenantCurrency();
 *   // …
 *   <p>{currency ? formatCurrency(amount, currency) : '—'}</p>
 *
 * Or with the convenience formatter:
 *
 *   const { format } = useTenantCurrencyFormatter();
 *   <p>{format(amount)}</p>
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatCurrency as sharedFormatCurrency } from '@bossnyumba/api-client';
import { useAuth } from '../contexts/AuthContext';

/**
 * localStorage key for the per-user owner-portal override. Namespaced
 * to the owner surface so its preference never collides with another
 * surface's display-currency override for the same user.
 */
export const OWNER_CURRENCY_STORAGE_KEY = 'owner_display_currency';

/** ISO-4217 currency code, e.g. `'KES'`, `'TZS'`, `'USD'`, `'BHD'`. */
export type CurrencyCode = string;

/**
 * Safe synchronous read of the persisted user override. Returns
 * `undefined` on the server or when the value is unset / unreadable.
 *
 * Exported for the test suite and for the optional non-component
 * `getStoredCurrencyOverride()` accessor below.
 */
export function readStoredCurrency(): CurrencyCode | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(OWNER_CURRENCY_STORAGE_KEY);
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim().toUpperCase();
    return trimmed.length === 0 ? undefined : trimmed;
  } catch {
    // localStorage can throw in private-mode Safari and a few embedded
    // contexts. Falling back to `undefined` keeps render safe (the
    // caller shows a placeholder rather than guessing a currency).
    return undefined;
  }
}

/**
 * Pure helper that picks the active currency from the two known
 * sources. Extracted so the test suite can exercise the precedence
 * rules without mounting a React tree.
 *
 * @param override Result of `readStoredCurrency()` (or `undefined`).
 * @param tenantCurrency The `defaultCurrency` field from the tenant
 *                       payload returned by `/auth/me` (or `undefined`
 *                       for legacy tenants).
 * @returns The resolved ISO-4217 code, or `undefined` if neither
 *          source has a value. Always upper-cased and trimmed.
 */
export function resolveCurrency(
  override: CurrencyCode | undefined,
  tenantCurrency: CurrencyCode | undefined,
): CurrencyCode | undefined {
  const fromOverride = sanitiseCode(override);
  if (fromOverride) return fromOverride;
  const fromTenant = sanitiseCode(tenantCurrency);
  if (fromTenant) return fromTenant;
  return undefined;
}

function sanitiseCode(code: CurrencyCode | undefined | null): CurrencyCode | undefined {
  if (typeof code !== 'string') return undefined;
  const trimmed = code.trim().toUpperCase();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * React hook that returns the resolved owner-portal display currency.
 *
 * Returns `undefined` when the resolution chain has nothing — callers
 * MUST handle this case (typically by rendering a placeholder rather
 * than calling `formatCurrency`).
 *
 * The returned value is memo-stable across renders provided neither
 * the tenant nor the localStorage override change.
 */
export function useTenantCurrency(): CurrencyCode | undefined {
  const { tenant } = useAuth();
  // Eager read so first paint already has the persisted override.
  const [override, setOverride] = useState<CurrencyCode | undefined>(() =>
    readStoredCurrency(),
  );

  useEffect(() => {
    // Pick up any change the /settings page wrote AFTER the initial
    // read. The `storage` event also fires on cross-tab updates so an
    // operator who flips their preference in one tab sees it
    // immediately in another.
    const sync = () => setOverride(readStoredCurrency());
    if (typeof window === 'undefined') return;
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  return useMemo(
    () => resolveCurrency(override, tenant?.defaultCurrency),
    [override, tenant?.defaultCurrency],
  );
}

/**
 * Convenience companion to {@link useTenantCurrency} that returns a
 * bound formatter. Renders the placeholder `'—'` whenever the
 * resolution chain is empty, so consumers can drop the explicit
 * `currency ? formatCurrency(amount, currency) : '—'` ternary.
 *
 * @example
 *   const { format } = useTenantCurrencyFormatter();
 *   return <p>{format(invoice.total)}</p>;
 */
export function useTenantCurrencyFormatter(): {
  readonly code: CurrencyCode | undefined;
  readonly format: (amount: number) => string;
} {
  const code = useTenantCurrency();
  const format = useCallback(
    (amount: number): string => {
      if (!code) return '—';
      return sharedFormatCurrency(amount, code);
    },
    [code],
  );
  return { code, format };
}

/**
 * Non-React accessor for the persisted override. Some helper modules
 * (e.g. csv/pdf exporters) format currency outside of a React tree and
 * cannot use hooks. They should accept a `currency` parameter from
 * their caller, but for read-only side-channels this provides the
 * override directly.
 */
export function getStoredCurrencyOverride(): CurrencyCode | undefined {
  return readStoredCurrency();
}
