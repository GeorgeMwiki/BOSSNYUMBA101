import type { Payment } from '@/lib/payment-types';

export const CURRENT_BALANCE = 45000;
export const CARD_PAYMENT_ENABLED = false;

export const MOCK_PAYMENTS: Payment[] = [
  {
    id: '1',
    type: 'rent',
    amount: 45000,
    status: 'pending',
    dueDate: '2024-03-01',
  },
  {
    id: '2',
    type: 'rent',
    amount: 45000,
    status: 'paid',
    dueDate: '2024-02-01',
    paidDate: '2024-01-28',
    reference: 'MPESA-ABC123XYZ',
    channel: 'M-Pesa',
  },
  {
    id: '3',
    type: 'rent',
    amount: 45000,
    status: 'paid',
    dueDate: '2024-01-01',
    paidDate: '2023-12-30',
    reference: 'MPESA-DEF456UVW',
    channel: 'M-Pesa',
  },
  {
    id: '4',
    type: 'deposit',
    amount: 90000,
    status: 'paid',
    dueDate: '2023-06-01',
    paidDate: '2023-05-28',
    reference: 'BANK-GHI789RST',
    channel: 'Bank Transfer',
  },
  {
    id: '5',
    type: 'rent',
    amount: 45000,
    status: 'failed',
    dueDate: '2023-12-01',
  },
];

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

  return items.filter((p) => {
    const date = p.paidDate ? new Date(p.paidDate) : new Date(p.dueDate);
    return date >= cutoff;
  });
}
