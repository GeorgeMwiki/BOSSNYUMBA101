'use client';

import { useQuery } from '@tanstack/react-query';
import { invoicesService } from '@bossnyumba/api-client';

interface InvoiceDetailProps {
  invoiceId: string;
}

export function InvoiceDetail({ invoiceId }: InvoiceDetailProps) {
  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => invoicesService.get(invoiceId),
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
          Failed to load invoice: {(error as Error).message}
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-4 text-center text-gray-500">Invoice not found.</div>
    );
  }

  const inv = invoice.data ?? invoice;

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{inv.invoiceNumber || `Invoice ${invoiceId}`}</h1>
        <span
          className={`text-sm px-3 py-1 rounded-full font-medium ${
            inv.status === 'paid'
              ? 'bg-green-100 text-green-700'
              : inv.status === 'overdue'
              ? 'bg-red-100 text-red-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}
        >
          {inv.status || 'unpaid'}
        </span>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-500">Tenant</span>
          <span className="font-medium">{inv.tenantName || inv.customer?.name || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Property</span>
          <span className="font-medium">{inv.propertyName || inv.property?.name || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Unit</span>
          <span className="font-medium">{inv.unitName || inv.unit?.name || '-'}</span>
        </div>
        <hr />
        <div className="flex justify-between">
          <span className="text-gray-500">Amount</span>
          <span className="font-semibold text-lg">TZS {(inv.amount || inv.totalAmount)?.toLocaleString()}</span>
        </div>
        {inv.balanceDue !== undefined && (
          <div className="flex justify-between">
            <span className="text-gray-500">Balance Due</span>
            <span className="font-semibold">TZS {inv.balanceDue?.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">Due Date</span>
          <span>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Issue Date</span>
          <span>{inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '-'}</span>
        </div>
      </div>

      {inv.lineItems && inv.lineItems.length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold mb-3">Line Items</h2>
          <div className="space-y-2">
            {inv.lineItems.map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>{item.description || item.name}</span>
                <span className="font-medium">TZS {item.amount?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {inv.status !== 'paid' && (
        <a href="/payments/record" className="btn-primary block text-center">
          Record Payment
        </a>
      )}
    </div>
  );
}
