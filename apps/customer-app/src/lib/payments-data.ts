import type { Payment } from '@/lib/payment-types';

// AM-4: removed `CURRENT_BALANCE = 0` (silent zero fallback) and
// `MOCK_PAYMENTS = []` (dead-code mock array). Callers must now obtain
// the live balance from the payments API or surface an explicit empty
// state. `CARD_PAYMENT_ENABLED` was a literal `false` constant referenced
// nowhere — also removed. See AM-4 hardcoded-fallback-purge.

export const DATE_RANGE_OPTIONS = [
  { label: 'All time', value: 'all' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 3 months', value: '90' },
  { label: 'Last 6 months', value: '180' },
  { label: 'This year', value: 'year' },
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
