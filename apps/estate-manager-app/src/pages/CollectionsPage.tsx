'use client';

import { useQuery } from '@tanstack/react-query';
import { invoicesService } from '@bossnyumba/api-client';

export default function CollectionsPage() {
  const { data: overdueData, isLoading: loadingOverdue, error: overdueError } = useQuery({
    queryKey: ['invoices', 'overdue'],
    queryFn: () => invoicesService.list({ status: 'overdue' }),
  });

  const { data: unpaidData, isLoading: loadingUnpaid } = useQuery({
    queryKey: ['invoices', 'unpaid'],
    queryFn: () => invoicesService.list({ status: 'unpaid' }),
  });

  const overdueInvoices = overdueData?.data ?? [];
  const unpaidInvoices = unpaidData?.data ?? [];
  const isLoading = loadingOverdue || loadingUnpaid;

  const totalOverdue = overdueInvoices.reduce(
    (sum: number, inv: any) => sum + (inv.balanceDue || inv.amount || inv.totalAmount || 0),
    0
  );
  const totalUnpaid = unpaidInvoices.reduce(
    (sum: number, inv: any) => sum + (inv.balanceDue || inv.amount || inv.totalAmount || 0),
    0
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (overdueError) {
    return (
      <div className="p-4">
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Failed to load collections data: {(overdueError as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">Collections</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 text-center border-red-200 bg-red-50">
          <p className="text-2xl font-bold text-red-600">
            TZS {totalOverdue.toLocaleString()}
          </p>
          <p className="text-sm text-red-500 mt-1">Overdue ({overdueInvoices.length})</p>
        </div>
        <div className="card p-4 text-center border-yellow-200 bg-yellow-50">
          <p className="text-2xl font-bold text-yellow-600">
            TZS {totalUnpaid.toLocaleString()}
          </p>
          <p className="text-sm text-yellow-500 mt-1">Unpaid ({unpaidInvoices.length})</p>
        </div>
      </div>

      {/* Overdue Invoices */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-red-700">Overdue Invoices</h2>
        {overdueInvoices.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <p className="text-sm">No overdue invoices. Great job!</p>
          </div>
        )}
        {overdueInvoices.map((invoice: any) => (
          <a
            key={invoice.id}
            href={`/payments/invoices/${invoice.id}`}
            className="card p-4 block hover:shadow-md transition-shadow border-red-100"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{invoice.invoiceNumber || `INV-${invoice.id}`}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {invoice.tenantName || invoice.customer?.name || 'Tenant'}
                </p>
                <p className="text-xs text-red-500 mt-1">
                  Due: {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-red-600">
                  TZS {(invoice.balanceDue || invoice.amount || invoice.totalAmount)?.toLocaleString()}
                </p>
                <span className="text-xs px-2 py-1 rounded-full font-medium bg-red-100 text-red-700">
                  overdue
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Unpaid Invoices */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-yellow-700">Unpaid Invoices</h2>
        {unpaidInvoices.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <p className="text-sm">No unpaid invoices.</p>
          </div>
        )}
        {unpaidInvoices.map((invoice: any) => (
          <a
            key={invoice.id}
            href={`/payments/invoices/${invoice.id}`}
            className="card p-4 block hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{invoice.invoiceNumber || `INV-${invoice.id}`}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {invoice.tenantName || invoice.customer?.name || 'Tenant'}
                </p>
                {invoice.dueDate && (
                  <p className="text-xs text-gray-400 mt-1">
                    Due: {new Date(invoice.dueDate).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  TZS {(invoice.balanceDue || invoice.amount || invoice.totalAmount)?.toLocaleString()}
                </p>
                <span className="text-xs px-2 py-1 rounded-full font-medium bg-yellow-100 text-yellow-700">
                  unpaid
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>

      <a href="/payments/record" className="btn-primary block text-center">
        Record Payment
      </a>
    </div>
  );
}
