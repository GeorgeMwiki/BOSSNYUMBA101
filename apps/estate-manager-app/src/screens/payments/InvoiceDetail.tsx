'use client';

/**
 * InvoiceDetail — live invoice view with collections actions.
 *
 *   GET  /invoices/:id        canonical invoice + line items.
 *   POST /invoices/:id/send   deliver to the customer (email/sms/whatsapp).
 *   GET  /invoices/:id/pdf    short-lived PDF link (download=1).
 *
 * Amounts render via formatMoney threaded with the invoice currency.
 */

import { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Send, Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { invoicesService } from '@bossnyumba/api-client';
import type {
  Invoice,
  InvoicePdfResponse,
} from '@bossnyumba/api-client/invoices-types';
import { Spinner, toast } from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatMoney } from '@/lib/currency';

interface InvoiceDetailProps {
  readonly invoiceId: string;
}

const STATUS_BADGE: Record<string, string> = {
  PAID: 'badge-success',
  PARTIALLY_PAID: 'badge-warning',
  OVERDUE: 'badge-gray',
  SENT: 'badge-info',
  PENDING: 'badge-info',
  DRAFT: 'badge-info',
  CANCELLED: 'badge-gray',
};

export function InvoiceDetail({ invoiceId }: InvoiceDetailProps) {
  const t = useTranslations('invoiceDetail');
  const [pdfError, setPdfError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['invoice-detail-live', invoiceId],
    queryFn: () => invoicesService.get(invoiceId),
    enabled: invoiceId.length > 0,
    retry: false,
  });
  const invoice = query.data?.data as Invoice | undefined;

  const sendMutation = useMutation({
    mutationFn: () => invoicesService.send(invoiceId, { channel: 'email' }),
    onSuccess: () => {
      toast.success(t('sentToast'));
      void query.refetch();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : t('sendFailed'));
    },
  });

  const pdfMutation = useMutation({
    mutationFn: async (): Promise<InvoicePdfResponse | undefined> => {
      const res = await invoicesService.getPdf(invoiceId, true);
      return res.data;
    },
    onSuccess: (data) => {
      setPdfError(null);
      const url = data?.pdfUrl;
      if (url && typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        setPdfError(t('pdfUnavailable'));
      }
    },
    onError: (err: unknown) => {
      setPdfError(err instanceof Error ? err.message : t('pdfFailed'));
    },
  });

  const lineItems = useMemo(() => invoice?.lineItems ?? [], [invoice]);

  return (
    <>
      <PageHeader
        title={invoice?.number || t('titleFallback')}
        showBack
        action={
          invoice ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => pdfMutation.mutate()}
                disabled={pdfMutation.isPending}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                {t('pdf')}
              </button>
              <button
                type="button"
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
                className="btn-primary text-sm flex items-center gap-1"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                {sendMutation.isPending ? t('sending') : t('send')}
              </button>
            </div>
          ) : null
        }
      />

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {query.isLoading && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" className="text-signal-500" />
          </div>
        )}

        {query.error && (
          <div className="card p-4 text-sm text-danger-600" role="alert">
            {(query.error as Error).message || t('loadFailed')}
          </div>
        )}

        {pdfError && (
          <div className="card p-3 text-sm text-danger-600" role="alert">
            {pdfError}
          </div>
        )}

        {invoice && (
          <>
            <div className="card p-4 grid grid-cols-2 gap-4">
              <div className="col-span-2 flex items-center justify-between">
                <div>
                  <div className="text-sm text-neutral-500">{t('customer')}</div>
                  <div className="font-medium">
                    {invoice.customer?.name ?? invoice.customerId}
                  </div>
                </div>
                <span
                  className={`${STATUS_BADGE[invoice.status] ?? 'badge-info'} capitalize`}
                >
                  {invoice.status}
                </span>
              </div>
              <div>
                <div className="text-sm text-neutral-500">{t('dueDate')}</div>
                <div className="font-medium">
                  {invoice.dueDate
                    ? new Date(invoice.dueDate).toLocaleDateString()
                    : t('na')}
                </div>
              </div>
              <div>
                <div className="text-sm text-neutral-500">{t('amountDue')}</div>
                <div className="font-medium tabular-nums">
                  {formatMoney(
                    Number(invoice.amountDue ?? invoice.total),
                    invoice.currency,
                  )}
                </div>
              </div>
            </div>

            <div className="card p-4">
              <div className="text-sm font-medium mb-3">{t('lineItems')}</div>
              {lineItems.length === 0 ? (
                <div className="text-sm text-neutral-500">{t('noLineItems')}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-neutral-500 border-b border-border">
                      <th className="py-2 pr-3 font-medium">{t('itemDesc')}</th>
                      <th className="py-2 pr-3 font-medium text-right">
                        {t('itemQty')}
                      </th>
                      <th className="py-2 font-medium text-right">
                        {t('itemTotal')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => (
                      <tr key={item.id ?? idx} className="border-b border-border/60">
                        <td className="py-2 pr-3">{item.description}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatMoney(Number(item.total), invoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="mt-4 flex flex-col items-end gap-1 text-sm">
                <div className="flex w-48 justify-between">
                  <span className="text-neutral-500">{t('subtotal')}</span>
                  <span className="tabular-nums">
                    {formatMoney(Number(invoice.subtotal), invoice.currency)}
                  </span>
                </div>
                <div className="flex w-48 justify-between">
                  <span className="text-neutral-500">{t('tax')}</span>
                  <span className="tabular-nums">
                    {formatMoney(Number(invoice.tax), invoice.currency)}
                  </span>
                </div>
                <div className="flex w-48 justify-between font-semibold">
                  <span>{t('total')}</span>
                  <span className="tabular-nums">
                    {formatMoney(Number(invoice.total), invoice.currency)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
