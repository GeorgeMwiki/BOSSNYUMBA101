export function formatTzs(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `TZS ${(amount / 1_000_000_000).toFixed(2)}B`
  }
  if (amount >= 1_000_000) {
    return `TZS ${(amount / 1_000_000).toFixed(2)}M`
  }
  if (amount >= 1_000) {
    return `TZS ${(amount / 1_000).toFixed(1)}K`
  }
  return `TZS ${amount.toFixed(0)}`
}

/**
 * Currency-aware money render (BossNyumba hard rule: never hard-code a
 * jurisdiction's currency in a money path). The currency code is taken from
 * the data row and prefixed to a grouped integer amount. When the row carries
 * no currency, we fall back to the platform launch default (TZS) rather than
 * dropping the unit — but the code is never assumed in logic.
 */
const DEFAULT_CURRENCY = 'TZS'

export function formatCurrency(
  amount: number | string,
  currencyCode?: string | null
): string {
  const numeric = typeof amount === 'string' ? Number(amount) : amount
  const safe = Number.isFinite(numeric) ? numeric : 0
  const code = currencyCode && currencyCode.trim().length > 0 ? currencyCode : DEFAULT_CURRENCY
  const grouped = Math.round(safe).toLocaleString('en-US')
  return `${code} ${grouped}`
}

export function formatSqm(sqm: number): string {
  if (sqm >= 10_000) {
    return `${(sqm / 10_000).toFixed(2)} ha`
  }
  return `${sqm.toFixed(sqm < 10 ? 1 : 0)} m²`
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
}

// East-Africa convention is DD/MM and 24-hour time. The English branch uses
// `en-GB` (DD/MM) rather than `en-US` (MM/DD) so an English user sees the same
// day-first ordering as the rest of the app; the Swahili branch uses `sw-TZ`,
// which is also day-first. We never hard-code a single locale.
function localeFor(lang: 'sw' | 'en'): string {
  return lang === 'sw' ? 'sw-TZ' : 'en-GB'
}

export function formatDateTime(iso: string, lang: 'sw' | 'en'): string {
  const date = new Date(iso)
  return date.toLocaleString(localeFor(lang), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

export function formatTime(iso: string, lang: 'sw' | 'en'): string {
  const date = new Date(iso)
  return date.toLocaleTimeString(localeFor(lang), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}
