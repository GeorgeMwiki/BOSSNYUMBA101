'use client';

import { cn } from '@bossnyumba/design-system';

export type Currency = 'KES' | 'USD' | 'EUR';

const currencyConfig: Record<
  Currency,
  { symbol: string; locale: string; decimals?: number }
> = {
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
  currency = 'KES',
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

  const symbol =
    currency === 'KES'
      ? `${config.symbol} `
      : showSymbol
        ? `${config.symbol}`
        : '';

  return (
    <span className={cn('tabular-nums', className)}>
      {showSymbol && currency === 'KES' ? `${config.symbol} ` : ''}
      {formatted}
      {showSymbol && currency !== 'KES' ? ` ${config.symbol}` : ''}
    </span>
  );
}
