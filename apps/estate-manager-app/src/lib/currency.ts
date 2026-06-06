/**
 * Money formatting for the estate-manager app.
 *
 * Thin wrapper over the shared ISO-4217-aware `formatCurrency` from
 * `@bossnyumba/api-client`. Per CLAUDE.md every money render must call
 * `formatCurrency(amount, currencyCode)` and never hard-code KES / TZS /
 * UGX / NGN. Entities (lease, invoice, payment, work order) always carry
 * their own currency — thread it. When a row genuinely lacks a currency
 * we fall back to the deployment's `NEXT_PUBLIC_TENANT_CURRENCY` rather
 * than letting the shared helper throw, so a single missing field never
 * blanks a whole screen.
 */

import { formatCurrency } from '@bossnyumba/api-client';

/** Deployment default currency. Configured per-tenant deploy. */
export const TENANT_CURRENCY: string =
  process.env.NEXT_PUBLIC_TENANT_CURRENCY?.trim() || 'USD';

/** Optional BCP-47 locale for digit grouping; falls back to the user agent. */
const TENANT_LOCALE: string | undefined =
  process.env.NEXT_PUBLIC_TENANT_LOCALE?.trim() || undefined;

/**
 * Format a major-unit amount in `currency`, defaulting to the tenant
 * currency when the caller has no per-entity currency to thread.
 */
export function formatMoney(
  amount: number,
  currency?: string | null
): string {
  const code =
    typeof currency === 'string' && currency.trim().length > 0
      ? currency
      : TENANT_CURRENCY;
  return formatCurrency(amount, code, { locale: TENANT_LOCALE });
}
