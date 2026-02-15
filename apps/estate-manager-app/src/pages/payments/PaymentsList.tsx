'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus,
  CreditCard,
  ChevronRight,
  FileText,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { MoneyDisplay } from '@/components/MoneyDisplay';
import { DateDisplay } from '@/components/DateDisplay';
import { SearchInput } from '@/components/SearchInput';
import { Pagination } from '@/components/Pagination';
import type { StatusType } from '@/components/StatusBadge';
import { paymentsService } from '@bossnyumba/api-client';

export interface Payment {
  id: string;
  reference: string;
  amount: number;
  method: 'mpesa' | 'bank' | 'cash' | 'card';
  status: StatusType;
  tenantName: string;
  unit: string;
  paidAt: string;
  invoiceId?: string;
  type: 'rent' | 'deposit' | 'utilities' | 'late_fee';
}

const fallbackPayments: Payment[] = [
  { id: '1', reference: 'MPESA-ABC123XYZ', amount: 45000, method: 'mpesa', status: 'paid', tenantName: 'John Kamau', unit: 'A-204', paidAt: '2024-02-28T10:30:00Z', type: 'rent' },
  { id: '2', reference: 'MPESA-DEF456UVW', amount: 52000, method: 'mpesa', status: 'paid', tenantName: 'Mary Wanjiku', unit: 'B-102', paidAt: '2024-02-27T14:15:00Z', type: 'rent' },
  { id: '3', reference: 'BANK-GHI789', amount: 90000, method: 'bank', status: 'paid', tenantName: 'Peter Ochieng', unit: 'C-301', paidAt: '2024-02-25T09:00:00Z', type: 'deposit' },
  { id: '4', reference: 'MPESA-PENDING', amount: 48000, method: 'mpesa', status: 'processing', tenantName: 'Jane Akinyi', unit: 'A-105', paidAt: '2024-02-28T16:00:00Z', type: 'rent' },
];

const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'overdue', label: 'Overdue' },
];

const methodOptions = [
  { value: 'all', label: 'All methods' },
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'bank', label: 'Bank' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
];

const methodLabels: Record<string, string> = {
  mpesa: 'M-Pesa', bank: 'Bank Transfer', cash: 'Cash', card: 'Card',
  MPESA: 'M-Pesa', BANK: 'Bank Transfer', CASH: 'Cash', CARD: 'Card',
};

const statusMap: Record<string, StatusType> = {
  PENDING: 'pending', COMPLETED: 'paid', SUCCEEDED: 'paid', PROCESSING: 'processing',
  FAILED: 'overdue', CANCELLED: 'cancelled',
};

export function PaymentsList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Fetch payments from API
  const { data: apiData, isLoading } = useQuery({
    queryKey: ['payments', 'list', { dateFrom, dateTo, page }],
    queryFn: () => paymentsService.list(
      {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      } as never,
      page,
      perPage
    ),
    retry: false,
  });

  // Map API data to display format
  const payments: Payment[] = useMemo(() => {
    const raw = apiData?.data;
    if (!raw || !Array.isArray(raw) || raw.length === 0) return fallbackPayments;

    return raw.map((p: Record<string, unknown>) => {
      const amount = p.amount as Record<string, unknown> | undefined;
      const customer = p.customer as Record<string, unknown> | undefined;
      const lease = p.lease as Record<string, unknown> | undefined;
      const unit = lease?.unit as Record<string, unknown> | undefined;

      return {
        id: String(p.id),
        reference: String(p.reference ?? p.id ?? ''),
        amount: typeof amount === 'object' && amount ? Number(amount.amount ?? 0) : Number(p.amountInCents ? Number(p.amountInCents) / 100 : p.amount ?? 0),
        method: (String(p.channel ?? p.method ?? 'mpesa').toLowerCase()) as Payment['method'],
        status: statusMap[String(p.status ?? '')] ?? String(p.status ?? 'pending').toLowerCase() as StatusType,
        tenantName: customer ? String(customer.name ?? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()) : 'Tenant',
        unit: unit ? String(unit.unitNumber ?? '') : '',
        paidAt: String(p.paidAt ?? p.createdAt ?? ''),
        type: (String(p.paymentType ?? p.type ?? 'rent').toLowerCase()) as Payment['type'],
      };
    });
  }, [apiData]);

  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.tenantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.reference.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesMethod = methodFilter === 'all' || p.method === methodFilter;
    return matchesSearch && matchesStatus && matchesMethod;
  });

  const totalPages = Math.ceil(filteredPayments.length / perPage);
  const paginatedPayments = filteredPayments.slice(0, perPage);

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle={`${filteredPayments.length} payment${filteredPayments.length !== 1 ? 's' : ''}`}
        action={
          <div className="flex items-center gap-2">
            <Link href="/payments/invoices" className="btn-secondary text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Invoices</span>
            </Link>
            <Link href="/payments/record" className="btn-primary text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Record</span>
            </Link>
          </div>
        }
      />

      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        <SearchInput
          onChange={setSearchQuery}
          placeholder="Search by tenant or reference..."
          debounceMs={200}
          className="w-full"
        />

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            {statusOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
          <select
            className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={methodFilter}
            onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
          >
            {methodOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedPayments.length === 0 ? (
              <div className="card p-8 text-center text-gray-500">
                <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No payments found</p>
                <p className="text-sm mt-1">
                  {searchQuery || statusFilter !== 'all' || methodFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Record a payment to get started'}
                </p>
              </div>
            ) : (
              paginatedPayments.map((payment) => (
                <Link key={payment.id} href={`/payments/${payment.id}`}>
                  <div className="card p-4 hover:border-primary-200 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-500 font-mono">{payment.reference}</span>
                          <StatusBadge status={payment.status} />
                        </div>
                        <div className="font-medium mt-1 truncate">{payment.tenantName}</div>
                        <div className="text-sm text-gray-500 mt-0.5">
                          Unit {payment.unit} &bull; {methodLabels[payment.method] ?? payment.method}
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          <DateDisplay date={payment.paidAt} format="dateTime" />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold"><MoneyDisplay amount={payment.amount} /></div>
                        <ChevronRight className="w-5 h-5 text-gray-400 mt-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {totalPages > 1 && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </div>
    </>
  );
}
