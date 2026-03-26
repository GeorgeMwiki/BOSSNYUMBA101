'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { invoicesService } from '@bossnyumba/api-client';

export function InvoicesList() {
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: () => invoicesService.list({ status: statusFilter || undefined }),
  });

  const invoices = data?.data ?? [];

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Invoices</h1>

      <div className="flex gap-2 overflow-x-auto">
        {['', 'unpaid', 'paid', 'overdue', 'cancelled'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`btn text-sm whitespace-nowrap ${statusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
          >
            {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Failed to load invoices: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && invoices.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No invoices found</p>
          <p className="text-sm mt-1">Invoices will appear here once created.</p>
        </div>
      )}

      <div className="space-y-3">
        {invoices.map((invoice: any) => (
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
                  KES {(invoice.amount || invoice.totalAmount)?.toLocaleString()}
                </p>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    invoice.status === 'paid'
                      ? 'bg-green-100 text-green-700'
                      : invoice.status === 'overdue'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {invoice.status || 'unpaid'}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
