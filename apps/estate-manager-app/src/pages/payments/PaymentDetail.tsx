'use client';

import { useQuery } from '@tanstack/react-query';
import { paymentsService } from '@bossnyumba/api-client';

interface PaymentDetailProps {
  paymentId: string;
}

export function PaymentDetail({ paymentId }: PaymentDetailProps) {
  const { data: payment, isLoading, error } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => paymentsService.get(paymentId),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Failed to load payment: {(error as Error).message}
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="p-4 text-center text-gray-500">Payment not found.</div>
    );
  }

  const pay = payment.data ?? payment;

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {pay.reference || pay.transactionId || `Payment ${paymentId}`}
        </h1>
        <span
          className={`text-sm px-3 py-1 rounded-full font-medium ${
            pay.status === 'completed'
              ? 'bg-green-100 text-green-700'
              : pay.status === 'failed'
              ? 'bg-red-100 text-red-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}
        >
          {pay.status || 'pending'}
        </span>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-500">Amount</span>
          <span className="font-semibold text-lg">TZS {pay.amount?.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Payment Method</span>
          <span className="font-medium capitalize">{pay.paymentMethod?.replace('_', ' ') || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Reference</span>
          <span className="font-medium">{pay.reference || pay.transactionId || '-'}</span>
        </div>
        <hr />
        <div className="flex justify-between">
          <span className="text-gray-500">Tenant</span>
          <span className="font-medium">{pay.tenantName || pay.customer?.name || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Invoice</span>
          <span className="font-medium">
            {pay.invoiceNumber || pay.invoiceId ? (
              <a href={`/payments/invoices/${pay.invoiceId}`} className="text-primary-600 underline">
                {pay.invoiceNumber || pay.invoiceId}
              </a>
            ) : '-'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Date</span>
          <span>{pay.createdAt ? new Date(pay.createdAt).toLocaleString() : pay.paidAt ? new Date(pay.paidAt).toLocaleString() : '-'}</span>
        </div>
        {pay.notes && (
          <>
            <hr />
            <div>
              <span className="text-gray-500 text-sm">Notes</span>
              <p className="mt-1 text-sm">{pay.notes}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
