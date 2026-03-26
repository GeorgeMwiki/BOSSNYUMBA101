import type { Payment } from '@/lib/payment-types';

/**
 * Payment data configuration.
 * All payment data is fetched from the API via paymentsService.
 * This file provides utility constants and helpers only.
 */

export const CARD_PAYMENT_ENABLED = false;

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
