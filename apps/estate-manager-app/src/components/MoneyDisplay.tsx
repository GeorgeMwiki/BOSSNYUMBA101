'use client';

import { cn } from '@bossnyumba/design-system';

/**
 * Display a money amount for any ISO-4217 currency. The component is
 * now region-agnostic: callers pass the tenant's currency + locale
 * (resolved from region-config). There is no KES default.
 */
interface MoneyDisplayProps {
  amount: number;
  /** ISO-4217 currency code (e.g. 'KES', 'TZS', 'UGX'). Required. */
  currency: string;
  /** BCP-47 locale tag (e.g. 'en-KE', 'sw-TZ'). Defaults to browser default. */
  locale?: string;
  /** Override decimal places; defaults to the currency's standard minor units. */
  decimals?: number;
  showSymbol?: boolean;
  compact?: boolean;
  className?: string;
}

function resolveDecimals(currency: string, override?: number): number {
  if (override !== undefined) return override;
  try {
    // Intl tells us how many minor units the currency uses.
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).resolvedOptions();
    return parts.maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function MoneyDisplay({
  amount,
  currency,
  locale,
  decimals,
  showSymbol = true,
  compact = false,
  className,
}: MoneyDisplayProps) {
  const fractionDigits = resolveDecimals(currency, decimals);
  const formatted = new Intl.NumberFormat(locale, {
    style: showSymbol ? 'currency' : 'decimal',
    currency: showSymbol ? currency : undefined,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    ...(compact && { notation: 'compact', compactDisplay: 'short' }),
  }).format(amount);

  return <span className={cn('tabular-nums', className)}>{formatted}</span>;
}
