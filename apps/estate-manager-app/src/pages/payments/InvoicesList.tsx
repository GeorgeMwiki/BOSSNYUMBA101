'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  FileText,
  ChevronRight,
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
import { invoicesService } from '@bossnyumba/api-client';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  tenantName: string;
  unit: string;
  amount: number;
  status: StatusType;
  dueDate: string;
  paidDate?: string;
  overdue?: boolean;
}

// Fallback data
const fallbackInvoices: Invoice[] = [
  { id: '1', invoiceNumber: 'INV-2024-010', tenantName: 'John Kamau', unit: 'A-204', amount: 45000, status: 'paid', dueDate: '2024-03-01', paidDate: '2024-02-28' },
  { id: '2', invoiceNumber: 'INV-2024-011', tenantName: 'Mary Wanjiku', unit: 'B-102', amount: 52000, status: 'pending', dueDate: '2024-03-15' },
  { id: '3', invoiceNumber: 'INV-2024-009', tenantName: 'Peter Ochieng', unit: 'C-301', amount: 48000, status: 'overdue', dueDate: '2024-02-28', overdue: true },
  { id: '4', invoiceNumber: 'INV-2024-012', tenantName: 'Jane Akinyi', unit: 'A-105', amount: 42000, status: 'pending', dueDate: '2024-04-01' },
];

const statusMap: Record<string, StatusType> = {
  PAID: 'paid',
  PARTIALLY_PAID: 'pending',
  PENDING: 'pending',
  SENT: 'pending',
  DRAFT: 'pending',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
};

const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'overdue', label: 'Overdue' },
];

export function InvoicesList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Fetch invoices from API
  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices', 'list'],
    queryFn: () => invoicesService.list({ pageSize: 200 }),
    retry: false,
  });

  const allInvoices = useMemo((): Invoice[] => {
    const data = invoicesData?.data;
    if (!data || !Array.isArray(data) || data.length === 0) return fallbackInvoices;

    return data.map((inv: Record<string, unknown>) => {
      const customer = inv.customer as Record<string, unknown> | undefined;
      const unit = inv.unit as Record<string, unknown> | undefined;
      const rawStatus = String(inv.status ?? 'PENDING');
      const mappedStatus = statusMap[rawStatus] ?? 'pending';

      return {
        id: String(inv.id),
        invoiceNumber: String(inv.number ?? inv.invoiceNumber ?? inv.id ?? ''),
        tenantName: customer ? String(customer.name ?? '') : '',
        unit: unit ? String(unit.unitNumber ?? '') : '',
        amount: Number(inv.total ?? inv.subtotal ?? 0),
        status: mappedStatus,
        dueDate: String(inv.dueDate ?? ''),
        paidDate: rawStatus === 'PAID' ? String(inv.updatedAt ?? '') : undefined,
        overdue: rawStatus === 'OVERDUE',
      } as Invoice;
    });
  }, [invoicesData]);

  const filteredInvoices = allInvoices.filter((inv) => {
    const matchesSearch =
      !searchQuery ||
      inv.tenantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.unit.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredInvoices.length / perPage);
  const paginatedInvoices = filteredInvoices.slice(
    (page - 1) * perPage,
    page * perPage
  );

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={`${filteredInvoices.length} invoice${filteredInvoices.length !== 1 ? 's' : ''}`}
      />

      <div className="px-4 py-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchInput
              onChange={setSearchQuery}
              placeholder="Search by tenant, unit, or invoice..."
              debounceMs={200}
            />
          </div>
          <select
            className="w-full sm:w-auto px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedInvoices.length === 0 ? (
              <div className="card p-8 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No invoices found</p>
                <p className="text-sm mt-1">
                  {searchQuery || statusFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Invoices are generated from leases'}
                </p>
              </div>
            ) : (
              paginatedInvoices.map((invoice) => (
                <Link key={invoice.id} href={`/payments/invoices/${invoice.id}`}>
                  <div className={`card p-4 hover:border-primary-200 transition-colors ${
                    invoice.overdue ? 'border-l-4 border-l-red-500' : ''
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-500 font-mono">
                            {invoice.invoiceNumber}
                          </span>
                          <StatusBadge status={invoice.status} />
                        </div>
                        <div className="font-medium mt-1 truncate">
                          {invoice.tenantName}
                        </div>
                        {invoice.unit && (
                          <div className="text-sm text-gray-500 mt-0.5">
                            Unit {invoice.unit}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-2">
                          <DateDisplay date={invoice.dueDate} format="short" />
                          {invoice.paidDate && (
                            <> • Paid: <DateDisplay date={invoice.paidDate} format="short" /></>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold">
                          <MoneyDisplay amount={invoice.amount} />
                        </div>
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
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </div>
    </>
  );
}
