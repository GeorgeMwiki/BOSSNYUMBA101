'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, CreditCard, FileText, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { invoicesService } from '@bossnyumba/api-client';

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  dueDate: string;
  paidDate?: string;
  lineItems: { description: string; amount: number; quantity?: number }[];
  property: string;
  unit: string;
  createdAt: string;
  channel?: string;
  reference?: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  paid: { label: 'Paid', color: 'badge-success' },
  pending: { label: 'Pending', color: 'badge-warning' },
  overdue: { label: 'Overdue', color: 'badge-danger' },
  failed: { label: 'Failed', color: 'badge-danger' },
  processing: { label: 'Processing', color: 'badge-info' },
};

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvoice() {
      try {
        const response = await invoicesService.get(id);
        const inv = response.data as Record<string, unknown>;
        setInvoice({
          id: (inv.id as string) ?? id,
          invoiceNumber: (inv.invoiceNumber as string) ?? '',
          amount: (inv.amount as number) ?? 0,
          status: (inv.status as string) ?? 'pending',
          dueDate: (inv.dueDate as string) ?? '',
          paidDate: inv.paidDate as string | undefined,
          lineItems: (inv.lineItems as InvoiceData['lineItems']) ?? [],
          property: ((inv.property as Record<string, unknown>)?.name as string) ?? (inv.property as string) ?? '',
          unit: ((inv.unit as Record<string, unknown>)?.unitNumber as string) ?? (inv.unit as string) ?? '',
          createdAt: (inv.createdAt as string) ?? '',
          channel: inv.channel as string | undefined,
          reference: inv.reference as string | undefined,
        });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load invoice');
      } finally {
        setLoading(false);
      }
    }
    loadInvoice();
  }, [id]);

  if (loading) {
    return (
      <>
        <PageHeader title="Invoice" showBack />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      </>
    );
  }

  if (loadError || !invoice) {
    return (
      <>
        <PageHeader title="Invoice" showBack />
        <div className="px-4 py-8 text-center">
          <p className="text-gray-600">{loadError ?? 'Invoice not found'}</p>
          <button onClick={() => router.back()} className="btn-primary mt-4">
            Go Back
          </button>
        </div>
      </>
    );
  }

  const status = statusConfig[invoice.status] || statusConfig.pending;
  const canPay = invoice.status === 'pending' || invoice.status === 'overdue' || invoice.status === 'failed';

  return (
    <>
      <PageHeader title="Invoice" showBack />

      <div className="px-4 py-4 space-y-6 pb-24">
        {/* Invoice Header */}
        <div className="card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs text-gray-500">{invoice.invoiceNumber}</div>
              <h2 className="text-lg font-semibold mt-1">{invoice.property}</h2>
              <div className="text-sm text-gray-500">{invoice.unit}</div>
            </div>
            <span className={status.color}>{status.label}</span>
          </div>
          <div className="text-2xl font-bold text-primary-600">
            KES {invoice.amount.toLocaleString()}
          </div>
        </div>

        {/* Line Items */}
        <section className="card">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Invoice Details
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {invoice.lineItems.map((item, index) => (
              <div key={index} className="p-4 flex justify-between">
                <div>
                  <div className="font-medium">{item.description}</div>
                  {item.quantity && item.quantity > 1 && (
                    <div className="text-sm text-gray-500">Qty: {item.quantity}</div>
                  )}
                </div>
                <div className="font-medium">KES {item.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-gray-50 border-t border-gray-100">
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>KES {invoice.amount.toLocaleString()}</span>
            </div>
          </div>
        </section>

        {/* Payment Info for paid invoices */}
        {invoice.status === 'paid' && invoice.paidDate && (
          <div className="card p-4">
            <h3 className="font-medium mb-3">Payment Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Paid on</span>
                <span>{new Date(invoice.paidDate).toLocaleDateString()}</span>
              </div>
              {invoice.channel && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Method</span>
                  <span>{invoice.channel}</span>
                </div>
              )}
              {invoice.reference && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Reference</span>
                  <span className="font-mono text-xs">{invoice.reference}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {canPay && (
            <Link href={`/payments/pay?amount=${invoice.amount}`}>
              <button className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2">
                <CreditCard className="w-5 h-5" />
                Pay this Invoice
              </button>
            </Link>
          )}
          <button
            onClick={() => window.print()}
            className="btn-secondary w-full py-4 flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Download PDF
          </button>
        </div>
      </div>
    </>
  );
}
