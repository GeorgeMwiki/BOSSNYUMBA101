'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  DollarSign,
  FileText,
  CreditCard,
  Search,
  ChevronRight,
  Clock,
  Send,
  Filter,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { invoicesService, paymentsService } from '@bossnyumba/api-client';

type ArrearsSeverity = 'low' | 'medium' | 'high' | 'critical';

function getSeverity(daysOverdue: number): ArrearsSeverity {
  if (daysOverdue > 120) return 'critical';
  if (daysOverdue > 90) return 'high';
  if (daysOverdue > 30) return 'medium';
  return 'low';
}

function getSeverityColor(severity: ArrearsSeverity) {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-800';
    case 'high': return 'bg-orange-100 text-orange-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'low': return 'bg-blue-100 text-blue-800';
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(amount / 100);
}

export default function CollectionsPage() {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data: overdueData, isLoading: overdueLoading } = useQuery({
    queryKey: ['collections-overdue', { page, pageSize: 20, status: 'overdue' }],
    queryFn: () =>
      invoicesService.list({
        page,
        pageSize: 20,
        status: 'overdue',
      }),
    retry: false,
  });

  const { data: paymentsData } = useQuery({
    queryKey: ['collections-recent-payments'],
    queryFn: () =>
      paymentsService.list({
        page: 1,
        pageSize: 5,
      }),
    retry: false,
  });

  const overdueInvoices = overdueData?.data ?? [];
  const recentPayments = paymentsData?.data ?? [];
  const pagination = overdueData?.pagination;

  // Compute summary stats
  const totalArrears = overdueInvoices.reduce((sum: number, inv: { totalAmount?: number; paidAmount?: number }) =>
    sum + ((inv.totalAmount ?? 0) - (inv.paidAmount ?? 0)), 0
  );
  const activeCases = overdueInvoices.filter((inv: { daysOverdue?: number }) => (inv.daysOverdue ?? 0) > 90).length;
  const noticesPending = overdueInvoices.filter((inv: { daysOverdue?: number }) => (inv.daysOverdue ?? 0) > 30).length;

  return (
    <>
      <PageHeader
        title="Collections"
        subtitle="Arrears tracking and recovery"
        action={
          <Link href="/collections/notices" className="btn-primary text-sm flex items-center gap-1">
            <Send className="w-4 h-4" />
            Send Notices
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-red-500" />
              <span className="text-xs text-gray-500">Total Arrears</span>
            </div>
            <div className="text-lg font-bold text-red-600">{formatCurrency(totalArrears)}</div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-gray-500">Critical Cases</span>
            </div>
            <div className="text-lg font-bold">{activeCases}</div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-gray-500">Notices Due</span>
            </div>
            <div className="text-lg font-bold">{noticesPending}</div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-500">Recent Payments</span>
            </div>
            <div className="text-lg font-bold">{recentPayments.length}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer or property..."
              className="input pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input w-full sm:w-auto"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="">All Severity</option>
            <option value="critical">Critical (120+ days)</option>
            <option value="high">High (90+ days)</option>
            <option value="medium">Medium (30+ days)</option>
            <option value="low">Low (&lt;30 days)</option>
          </select>
        </div>

        {/* Arrears Queue */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Arrears Queue
          </h3>

          {overdueLoading ? (
            <div className="card p-8 text-center text-gray-500">Loading arrears data...</div>
          ) : overdueInvoices.length === 0 ? (
            <div className="card p-8 text-center">
              <DollarSign className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No overdue invoices found</p>
              <p className="text-sm text-gray-400 mt-1">All payments are up to date</p>
            </div>
          ) : (
            <div className="space-y-2">
              {overdueInvoices
                .filter((inv: { customerName?: string; propertyName?: string }) => {
                  if (!search) return true;
                  const s = search.toLowerCase();
                  return (inv.customerName?.toLowerCase().includes(s)) ||
                         (inv.propertyName?.toLowerCase().includes(s));
                })
                .filter((inv: { daysOverdue?: number }) => {
                  if (!severityFilter) return true;
                  return getSeverity(inv.daysOverdue ?? 0) === severityFilter;
                })
                .map((invoice: {
                  id: string;
                  customerName?: string;
                  propertyName?: string;
                  unitName?: string;
                  totalAmount?: number;
                  paidAmount?: number;
                  daysOverdue?: number;
                  dueDate?: string;
                }) => {
                  const amountOwed = (invoice.totalAmount ?? 0) - (invoice.paidAmount ?? 0);
                  const daysOverdue = invoice.daysOverdue ?? 0;
                  const severity = getSeverity(daysOverdue);

                  return (
                    <Link key={invoice.id} href={`/collections/${invoice.id}`}>
                      <div className="card p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{invoice.customerName ?? 'Unknown'}</div>
                            <div className="text-sm text-gray-500 truncate">
                              {invoice.propertyName}{invoice.unitName ? ` • ${invoice.unitName}` : ''}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm font-semibold text-red-600">
                                {formatCurrency(amountOwed)}
                              </span>
                              <span className="flex items-center gap-1 text-xs text-gray-400">
                                <Clock className="w-3 h-3" />
                                {daysOverdue}d overdue
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSeverityColor(severity)}`}>
                              {severity}
                            </span>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 pt-4">
            <button
              className="btn-secondary"
              disabled={!pagination.hasPreviousPage}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="py-2 text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              className="btn-secondary"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
