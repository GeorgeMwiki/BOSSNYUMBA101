'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { paymentsService } from '@bossnyumba/api-client';

export function PaymentsList() {
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['payments', statusFilter],
    queryFn: () => paymentsService.list({ status: statusFilter || undefined }),
  });

  const payments = data?.data ?? [];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payments</h1>
        <a href="/payments/record" className="btn-primary text-sm">
          Record Payment
        </a>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {['', 'completed', 'pending', 'failed'].map((status) => (
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
          Failed to load payments: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && payments.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No payments found</p>
          <p className="text-sm mt-1">Recorded payments will appear here.</p>
        </div>
      )}

      <div className="space-y-3">
        {payments.map((payment: any) => (
          <a
            key={payment.id}
            href={`/payments/${payment.id}`}
            className="card p-4 block hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">
                  {payment.reference || payment.transactionId || `PAY-${payment.id}`}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {payment.tenantName || payment.customer?.name || 'Tenant'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {payment.paymentMethod?.replace('_', ' ') || 'Payment'} &middot;{' '}
                  {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">TZS {payment.amount?.toLocaleString()}</p>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    payment.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : payment.status === 'failed'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {payment.status || 'pending'}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
