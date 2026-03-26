'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, ChevronRight, Calendar, DollarSign } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery } from '@tanstack/react-query';
import { invoicesService } from '@bossnyumba/api-client';

type BillStatus = 'paid' | 'pending' | 'overdue';

interface UtilityBill {
  id: string;
  period: string;
  utilityType: 'water' | 'electricity' | 'gas';
  property: string;
  amount: number;
  status: BillStatus;
  dueDate: string;
  paidAt?: string;
}

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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function UtilityBillsPage() {
  const [filter, setFilter] = useState<string>('all');

  const { data: billsData, isLoading } = useQuery({
    queryKey: ['utility-bills'],
    queryFn: async () => {
      const response = await invoicesService.list();
      return response.data;
    },
  });

  const bills: UtilityBill[] = (billsData ?? []).map((inv: any) => ({
    id: inv.id,
    period: new Date(inv.dueDate ?? inv.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    utilityType: inv.utilityType ?? 'electricity',
    property: inv.propertyName ?? inv.description ?? '',
    amount: inv.totalAmount ?? inv.amount ?? 0,
    status: inv.status?.toLowerCase() === 'paid' ? 'paid' as const : inv.status?.toLowerCase() === 'overdue' ? 'overdue' as const : 'pending' as const,
    dueDate: inv.dueDate ?? '',
    paidAt: inv.paidAt,
  }));

  const filteredBills = bills.filter((b) => {
    if (filter === 'all') return true;
    return b.status === filter;
  });

  const pendingAmount = bills.filter((b) => b.status === 'pending').reduce((acc, b) => acc + b.amount, 0);

  return (
    <>
      <PageHeader
        title="Utility Bills"
        subtitle="Bill history & payments"
        showBack
      />

      <div className="px-4 py-4 space-y-6">
        {/* Summary */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Pending Amount</div>
              <div className="text-2xl font-bold">{formatCurrency(pendingAmount)}</div>
            </div>
            {pendingAmount > 0 && (
              <Link href="/utilities/bills/pay" className="btn-primary text-sm">
                Pay Now
              </Link>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'pending', label: 'Pending' },
            { value: 'paid', label: 'Paid' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`btn text-sm ${filter === tab.value ? 'btn-primary' : 'btn-secondary'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Bills List */}
        <div className="space-y-3">
          {filteredBills.map((bill) => {
            const status = statusConfig[bill.status];
            return (
              <Link key={bill.id} href={`/utilities/bills/${bill.id}`}>
                <div className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary-50 rounded-lg">
                        <FileText className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <div className="font-medium">{utilityLabels[bill.utilityType]} - {bill.period}</div>
                        <div className="text-sm text-gray-500">{bill.property}</div>
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
              </Link>
            );
          })}
        </div>

        {filteredBills.length === 0 && (
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
