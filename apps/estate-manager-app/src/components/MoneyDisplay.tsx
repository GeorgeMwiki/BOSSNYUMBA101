'use client';

import { cn } from '@bossnyumba/design-system';

export type Currency = 'TZS' | 'KES' | 'USD' | 'EUR';

const currencyConfig: Record<
  Currency,
  { symbol: string; locale: string; decimals?: number }
> = {
  TZS: { symbol: 'TZS', locale: 'en-TZ', decimals: 0 },
  KES: { symbol: 'KES', locale: 'en-KE', decimals: 0 },
  USD: { symbol: 'USD', locale: 'en-US', decimals: 2 },
  EUR: { symbol: '€', locale: 'de-DE', decimals: 2 },
};

interface MoneyDisplayProps {
  amount: number;
  currency?: Currency;
  showSymbol?: boolean;
  compact?: boolean;
  className?: string;
}

export function MoneyDisplay({
  amount,
  currency = 'TZS',
  showSymbol = true,
  compact = false,
  className,
}: MoneyDisplayProps) {
  const config = currencyConfig[currency];

  const formatted = new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: config.decimals ?? 0,
    maximumFractionDigits: config.decimals ?? 0,
    ...(compact && { notation: 'compact', compactDisplay: 'short' }),
  }).format(amount);

  const isPrefixCurrency = currency === 'TZS' || currency === 'KES';

  return (
    <span className={cn('tabular-nums', className)}>
      {showSymbol && isPrefixCurrency ? `${config.symbol} ` : ''}
      {formatted}
      {showSymbol && !isPrefixCurrency ? ` ${config.symbol}` : ''}
    </span>
  );
}
