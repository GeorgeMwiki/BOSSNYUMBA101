'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Download, CreditCard, FileText, AlertCircle, RefreshCw } from 'lucide-react';
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

function InvoiceSkeleton() {
  return (
    <div className="px-4 py-4 space-y-6 pb-24">
      {/* Header card skeleton */}
      <div className="card p-5 animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-2">
            <div className="h-3 w-24 bg-surface-card rounded" />
            <div className="h-5 w-40 bg-surface-card rounded" />
            <div className="h-3 w-20 bg-surface-card rounded" />
          </div>
          <div className="h-6 w-16 bg-surface-card rounded-full" />
        </div>
        <div className="h-8 w-36 bg-surface-card rounded" />
      </div>

      {/* Line items skeleton */}
      <div className="card animate-pulse">
        <div className="p-4 border-b border-white/10">
          <div className="h-4 w-32 bg-surface-card rounded" />
        </div>
        <div className="divide-y divide-white/10">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 flex justify-between">
              <div className="h-4 w-28 bg-surface-card rounded" />
              <div className="h-4 w-20 bg-surface-card rounded" />
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-white/10">
          <div className="flex justify-between">
            <div className="h-5 w-12 bg-surface-card rounded" />
            <div className="h-5 w-24 bg-surface-card rounded" />
          </div>
        </div>
      </div>

      {/* Action buttons skeleton */}
      <div className="space-y-3 animate-pulse">
        <div className="h-14 bg-surface-card rounded-lg" />
        <div className="h-14 bg-surface-card rounded-lg" />
      </div>
    </div>
  );
}

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadInvoice = async () => {
    setLoading(true);
    setLoadError(null);
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
  };

  useEffect(() => {
    loadInvoice();
  }, [id]);

  if (loading) {
    return (
      <>
        <PageHeader title="Invoice" showBack />
        <InvoiceSkeleton />
      </>
    );
  }

  if (loadError || !invoice) {
    return (
      <>
        <PageHeader title="Invoice" showBack />
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-16 h-16 bg-surface-card rounded-2xl flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">
            {loadError ? 'Something went wrong' : 'Invoice not found'}
          </h3>
          <p className="text-sm text-gray-400 max-w-xs mb-6">
            {loadError ?? 'The invoice you are looking for could not be found.'}
          </p>
          <div className="flex gap-3">
            {loadError && (
              <button onClick={loadInvoice} className="btn-primary text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            )}
            <button onClick={() => router.back()} className="btn-secondary text-sm">
              Go Back
            </button>
          </div>
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
              <h2 className="text-lg font-semibold text-white mt-1">{invoice.property}</h2>
              <div className="text-sm text-gray-400">{invoice.unit}</div>
            </div>
            <span className={status.color}>{status.label}</span>
          </div>
          <div className="text-2xl font-bold text-primary-400">
            TZS {invoice.amount.toLocaleString()}
          </div>
        </div>

        {/* Line Items */}
        <section className="card">
          <div className="p-4 border-b border-white/10">
            <h3 className="font-medium text-white flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Invoice Details
            </h3>
          </div>
          <div className="divide-y divide-white/10">
            {invoice.lineItems.map((item, index) => (
              <div key={index} className="p-4 flex justify-between">
                <div>
                  <div className="font-medium text-white">{item.description}</div>
                  {item.quantity && item.quantity > 1 && (
                    <div className="text-sm text-gray-400">Qty: {item.quantity}</div>
                  )}
                </div>
                <div className="font-medium text-white">TZS {item.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-white/5 border-t border-white/10">
            <div className="flex justify-between font-semibold text-white">
              <span>Total</span>
              <span>TZS {invoice.amount.toLocaleString()}</span>
            </div>
          </div>
        </section>

        {/* Payment Info for paid invoices */}
        {invoice.status === 'paid' && invoice.paidDate && (
          <div className="card p-4">
            <h3 className="font-medium text-white mb-3">Payment Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Paid on</span>
                <span className="text-white">{new Date(invoice.paidDate).toLocaleDateString()}</span>
              </div>
              {invoice.channel && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Method</span>
                  <span className="text-white">{invoice.channel}</span>
                </div>
              )}
              {invoice.reference && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Reference</span>
                  <span className="font-mono text-xs text-white">{invoice.reference}</span>
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
