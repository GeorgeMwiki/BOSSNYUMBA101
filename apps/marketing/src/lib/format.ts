/**
 * Marketing-side currency formatter — TZS-first per CLAUDE.md
 * ("Multi-currency, TZS-primary. Every money render uses
 * formatCurrency(amount, currencyCode).").
 *
 * Defers to the platform Intl.NumberFormat. We never hard-code a
 * currency symbol so adding KES or NGN later is a one-line tier copy
 * change, not a search-replace across pages.
 */
export function formatCurrency(amount: number, currencyCode = 'TZS'): string {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-TZ', { maximumFractionDigits: 0 }).format(value);
}
