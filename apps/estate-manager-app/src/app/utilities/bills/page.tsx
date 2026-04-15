'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FileText, Calendar, DollarSign, Loader2, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { utilitiesApi, formatCurrency, type UtilityBill, type BillStatus } from '@/lib/api';

const statusConfig: Record<BillStatus, { label: string; color: string }> = {
  paid: { label: 'Paid', color: 'badge-success' },
  pending: { label: 'Pending', color: 'badge-warning' },
  overdue: { label: 'Overdue', color: 'badge-danger' },
};

const utilityLabels: Record<string, string> = {
  water: 'Water',
  electricity: 'Electricity',
  gas: 'Gas',
};

export default function UtilityBillsPage() {
  const [filter, setFilter] = useState<BillStatus | 'all'>('all');

  const billsQuery = useQuery({
    queryKey: ['utility-bills', filter],
    queryFn: () =>
      utilitiesApi.listBills(filter === 'all' ? undefined : { status: filter }),
    retry: false,
  });

  const response = billsQuery.data;
  const bills: UtilityBill[] = response?.data ?? [];
  const pendingAmount = bills
    .filter((b) => b.status === 'pending' || b.status === 'overdue')
    .reduce((acc, b) => acc + b.amount, 0);

  const errorMessage =
    billsQuery.error instanceof Error
      ? billsQuery.error.message
      : response && !response.success
      ? response.error?.message
      : undefined;

  return (
    <>
      <PageHeader title="Utility Bills" subtitle="Bill history & payments" showBack />

      <div className="px-4 py-4 space-y-6">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Outstanding</div>
              <div className="text-2xl font-bold">{formatCurrency(pendingAmount)}</div>
            </div>
            {pendingAmount > 0 && (
              <Link href="/payments/receive" className="btn-primary text-sm">
                Record Payment
              </Link>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'overdue', 'paid'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`btn text-sm ${filter === tab ? 'btn-primary' : 'btn-secondary'}`}
            >
              {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {billsQuery.isLoading && (
          <div className="card p-4 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading bills...
          </div>
        )}

        {errorMessage && (
          <div className="card p-4 flex items-start gap-2 border-danger-200 bg-danger-50 text-danger-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Unable to load bills</div>
              <div>{errorMessage}</div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {bills.map((bill) => {
            const status = statusConfig[bill.status];
            return (
              <div key={bill.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary-50 rounded-lg">
                      <FileText className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {utilityLabels[bill.utilityType] ?? bill.utilityType} - {bill.period}
                      </div>
                      <div className="text-sm text-gray-500">{bill.property?.name ?? '—'}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                        <Calendar className="w-3 h-3" />
                        Due {new Date(bill.dueDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(bill.amount)}</div>
                    <span className={status.color}>{status.label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!billsQuery.isLoading && !errorMessage && bills.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No bills found</h3>
            <p className="text-sm text-gray-500 mt-1">
              {filter === 'all' ? 'No utility bills on record' : `No ${filter} bills`}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
