import type { Payment } from '@/lib/payment-types';

export const CURRENT_BALANCE = 0;
export const CARD_PAYMENT_ENABLED = false;

export const MOCK_PAYMENTS: Payment[] = [];

/**
 * Date range options for filtering payments by time period.
 *
 * `labelKey` resolves through `useTranslations('p89.paymentsData')` at
 * render time — consumers pass the key to `t()` to get the localised
 * label.
 */
export const DATE_RANGE_OPTIONS = [
  { labelKey: 'allTime', value: 'all' },
  { labelKey: 'last30Days', value: '30' },
  { labelKey: 'last3Months', value: '90' },
  { labelKey: 'last6Months', value: '180' },
  { labelKey: 'thisYear', value: 'year' },
];

export function filterPaymentsByDateRange(items: Payment[], range: string): Payment[] {
  if (range === 'all') return items;

  const now = new Date();
  const cutoff = new Date(now);

  if (range === '30') cutoff.setDate(cutoff.getDate() - 30);
  else if (range === '90') cutoff.setDate(cutoff.getDate() - 90);
  else if (range === '180') cutoff.setDate(cutoff.getDate() - 180);
  else if (range === 'year') cutoff.setFullYear(cutoff.getFullYear() - 1);

  return items.filter((payment) => {
    const date = payment.paidDate ? new Date(payment.paidDate) : new Date(payment.dueDate);
    return date >= cutoff;
  });
}
