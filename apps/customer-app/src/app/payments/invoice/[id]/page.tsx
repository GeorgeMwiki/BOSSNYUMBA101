'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CreditCard,
  Download,
  FileText,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, type InvoiceRecord } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

const statusConfig: Record<string, { label: string; tone: string }> = {
  paid: { label: 'Paid', tone: 'bg-emerald-500/20 text-emerald-200' },
  pending: { label: 'Pending', tone: 'bg-amber-500/20 text-amber-200' },
  overdue: { label: 'Overdue', tone: 'bg-red-500/20 text-red-200' },
  failed: { label: 'Failed', tone: 'bg-red-500/20 text-red-200' },
  processing: { label: 'Processing', tone: 'bg-blue-500/20 text-blue-200' },
};

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const id = params.id as string;

  const query = useQuery<InvoiceRecord>({
    queryKey: ['invoice', id],
    queryFn: () => api.invoices.get(id),
    enabled: !!id,
  });

  const download = useMutation({
    mutationFn: () => api.invoices.downloadPdfUrl(id),
    onSuccess: (result) => {
      if (result.downloadUrl) {
        window.open(result.downloadUrl, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Download link unavailable');
      }
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : 'Could not generate download link',
        'Download failed'
      ),
  });

  if (query.isLoading) {
    return (
      <>
        <PageHeader title="Invoice" showBack />
        <div className="flex items-center justify-center gap-2 px-4 py-16 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading invoice...
        </div>
      </>
    );
  }

  if (query.error || !query.data) {
    return (
      <>
        <PageHeader title="Invoice" showBack />
        <div className="space-y-3 px-4 py-4">
          <div className="card border-red-500/30 bg-red-500/10 p-4 text-red-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5" />
              <div>
                <p className="font-medium">Invoice not found</p>
                <p className="text-sm">
                  {(query.error as Error | undefined)?.message ?? 'This invoice is unavailable.'}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-primary w-full"
          >
            Go Back
          </button>
        </div>
      </>
    );
  }

  const invoice = query.data;
  const status =
    statusConfig[invoice.status.toLowerCase()] ??
    { label: invoice.status, tone: 'bg-white/10 text-gray-200' };
  const canPay = ['pending', 'overdue', 'failed'].includes(invoice.status.toLowerCase());
  const currency = invoice.currency ?? 'KES';

  return (
    <>
      <PageHeader title="Invoice" showBack />

      <div className="space-y-6 px-4 py-4 pb-24">
        <div className="card p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-gray-400">
                {invoice.invoiceNumber ?? `#${invoice.id.slice(0, 8)}`}
              </div>
              {invoice.propertyName && (
                <h2 className="mt-1 text-lg font-semibold text-white">
                  {invoice.propertyName}
                </h2>
              )}
              {invoice.unitNumber && (
                <div className="text-sm text-gray-400">{invoice.unitNumber}</div>
              )}
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${status.tone}`}
            >
              {status.label}
            </span>
          </div>
          <div className="text-2xl font-bold text-primary-300">
            {currency} {invoice.amount.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-gray-400">
            Due {new Date(invoice.dueDate).toLocaleDateString()}
          </div>
        </div>

        {invoice.lineItems && invoice.lineItems.length > 0 && (
          <section className="card">
            <div className="flex items-center gap-2 border-b border-white/10 p-4 font-medium text-white">
              <FileText className="h-4 w-4" />
              Invoice Details
            </div>
            <div className="divide-y divide-white/10">
              {invoice.lineItems.map((item, index) => (
                <div key={index} className="flex justify-between p-4">
                  <div>
                    <div className="font-medium text-white">{item.description}</div>
                    {item.quantity && item.quantity > 1 && (
                      <div className="text-sm text-gray-400">Qty: {item.quantity}</div>
                    )}
                  </div>
                  <div className="font-medium text-white">
                    {currency} {item.amount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 bg-white/5 p-4">
              <div className="flex justify-between font-semibold text-white">
                <span>Total</span>
                <span>
                  {currency} {invoice.amount.toLocaleString()}
                </span>
              </div>
            </div>
          </section>
        )}

        {invoice.status.toLowerCase() === 'paid' && invoice.paidDate && (
          <div className="card p-4">
            <h3 className="mb-3 font-medium text-white">Payment Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Paid on</span>
                <span className="text-white">
                  {new Date(invoice.paidDate).toLocaleDateString()}
                </span>
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

        <div className="space-y-3">
          {canPay && (
            <Link href={`/payments/pay?amount=${invoice.amount}`}>
              <button
                type="button"
                className="btn-primary flex w-full items-center justify-center gap-2 py-4 text-lg"
              >
                <CreditCard className="h-5 w-5" />
                Pay this invoice
              </button>
            </Link>
          )}
          <button
            type="button"
            onClick={() => download.mutate()}
            disabled={download.isPending}
            className="btn-secondary flex w-full items-center justify-center gap-2 py-4"
          >
            {download.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
            {download.isPending ? 'Preparing download...' : 'Download PDF'}
          </button>
        </div>
      </div>
    </>
  );
}
