'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Clock, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

interface BalanceBreakdownItem {
  label: string;
  amount: number | string;
}

interface BalanceData {
  totalDue: { amount: number | string; currency: string };
  dueDate?: string;
  breakdown?: BalanceBreakdownItem[];
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24)));
}

export function UpcomingPayment() {
  const balanceQuery = useQuery({
    queryKey: ['customer-dashboard-balance'],
    queryFn: () => api.payments.getBalance(),
  });

  const balance = balanceQuery.data as BalanceData | undefined;

  return (
    <section>
      <h2 className="text-sm font-medium text-gray-500 mb-3">Upcoming Payment</h2>
      {balanceQuery.isLoading && (
        <div className="card p-4 text-sm text-gray-500">Loading balance...</div>
      )}
      {balanceQuery.error && (
        <div className="card border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
          {(balanceQuery.error as Error).message}
        </div>
      )}
      {!balanceQuery.isLoading && !balanceQuery.error && !balance && (
        <div className="card p-4 text-sm text-gray-500">No upcoming payment.</div>
      )}
      {balance && (
        <div className="card p-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {balance.totalDue.currency} {Number(balance.totalDue.amount).toLocaleString()}
              </div>
              {balance.dueDate && (
                <div className="text-sm text-gray-500">
                  Due: {new Date(balance.dueDate).toLocaleDateString()}
                </div>
              )}
            </div>
            {daysUntil(balance.dueDate) !== null && (
              <div className="badge-warning">
                <Clock className="w-3 h-3 mr-1" />
                {daysUntil(balance.dueDate)} days
              </div>
            )}
          </div>

          {balance.breakdown && balance.breakdown.length > 0 && (
            <div className="space-y-2 mb-4">
              {balance.breakdown.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-500">{item.label}</span>
                  <span>
                    {balance.totalDue.currency} {Number(item.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Link href="/payments/pay" className="btn-primary flex-1">
              Pay Now
            </Link>
            <Link href="/payments" className="btn-secondary">
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
