/**
 * Locale-aware formatters for KPI tiles + table cells.
 *
 * Currency is typed as ISO-4217 string — the supported locale table
 * below is a hint registry, not the authoritative list. Unknown codes
 * fall back to the generic Intl.NumberFormat path (still renders
 * cleanly via `${currency} ${value}`).
 *
 * The user's preferred display currency lives in a separate
 * `currency_preferences` table (see MEMORY.md guidance); the brain
 * SHOULD pass values in the user's preferred currency already, and
 * the formatter only handles the locale rendering.
 *
 * AM-4 hardcoded-fallback-purge: every formatter now accepts an
 * optional `locale` parameter — passing one routes through the
 * user/tenant locale. When absent we use the runtime's default
 * (`undefined` → host environment locale) instead of a hardcoded
 * 'en-US' which forced Western numeric grouping on every tenant.
 */

export type Currency = string;

const CURRENCY_HINT_LOCALES: Readonly<Record<string, string>> = Object.freeze({
  KES: 'en-KE',
  TZS: 'sw-TZ',
  USD: 'en-US',
});

export function formatCurrency(
  value: number,
  currency: Currency,
  locale?: string,
): string {
  // Caller-supplied locale wins; otherwise fall back to the hint table;
  // ultimately Intl uses the host runtime default when locale is undefined.
  const resolvedLocale = locale ?? CURRENCY_HINT_LOCALES[currency];
  try {
    return new Intl.NumberFormat(resolvedLocale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

export function formatPercent(
  value: number,
  fractionDigits = 1,
  locale?: string,
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    return `${(value * 100).toFixed(fractionDigits)}%`;
  }
}

export function formatNumber(value: number, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}

export function formatDate(value: string | number | Date, locale?: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

export function formatCell(
  value: unknown,
  fmt: 'text' | 'currency' | 'percent' | 'number' | 'date' | undefined,
  currency?: Currency,
  locale?: string,
): string {
  if (value === null || value === undefined) return '';
  if (fmt === 'currency' && typeof value === 'number' && currency) {
    return formatCurrency(value, currency, locale);
  }
  if (fmt === 'percent' && typeof value === 'number')
    return formatPercent(value, 1, locale);
  if (fmt === 'number' && typeof value === 'number')
    return formatNumber(value, locale);
  if (fmt === 'date') return formatDate(value as string, locale);
  return String(value);
}
