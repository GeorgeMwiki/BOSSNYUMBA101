'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { PullToRefresh } from '@/components/payments/PullToRefresh';
import type { Payment } from '@/lib/payment-types';
import { MOCK_PAYMENTS } from '@/lib/payments-data';

const payments: Payment[] = MOCK_PAYMENTS;

const statusConfig = {
  paid: { label: 'Completed', icon: CheckCircle, color: 'badge-success' },
  pending: { label: 'Pending', icon: Clock, color: 'badge-warning' },
  overdue: { label: 'Overdue', icon: AlertCircle, color: 'badge-danger' },
  processing: { label: 'Processing', icon: Clock, color: 'badge-info' },
  failed: { label: 'Failed', icon: AlertCircle, color: 'badge-danger' },
};

const typeLabels: Record<string, string> = {
  rent: 'Monthly Rent',
  utilities: 'Utilities',
  deposit: 'Security Deposit',
  late_fee: 'Late Fee',
  other: 'Other',
};

export default function PaymentHistoryPage() {
  const [items, setItems] = useState(payments);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise((r) => setTimeout(r, 1000));
    setItems([...MOCK_PAYMENTS]);
    setIsRefreshing(false);
  };

  return (
    <>
      <PageHeader title="Payment History" showBack />

      <PullToRefresh onRefresh={handleRefresh}>
      <div className="px-4 py-4 pb-24">
        {/* Pull to refresh indicator */}
        <div className="flex justify-end mb-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-sm text-primary-600 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="space-y-3">
          {items.map((payment) => (
            <PaymentHistoryCard key={payment.id} payment={payment} />
          ))}
        </div>

        {items.length === 0 && (
          <div className="card p-12 text-center text-gray-500">
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No payment history</p>
            <p className="text-sm mt-1">Your payments will appear here</p>
          </div>
        )}
      </div>
      </PullToRefresh>
    </>
  );
}

function PaymentHistoryCard({ payment }: { payment: Payment }) {
  const status = statusConfig[payment.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <Link href={`/payments/invoice/${payment.id}`}>
      <div className="card p-4 active:scale-[0.98] transition-transform">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <CreditCard className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium">{typeLabels[payment.type]}</div>
            <div className="text-sm text-gray-500">
              {payment.paidDate
                ? new Date(payment.paidDate).toLocaleDateString()
                : `Due ${new Date(payment.dueDate).toLocaleDateString()}`}
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold">KES {payment.amount.toLocaleString()}</div>
            <span className={status.color}>
              <StatusIcon className="w-3 h-3 mr-1 inline" />
              {status.label}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    </Link>
  );
}
