'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, DollarSign } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { paymentsService } from '@bossnyumba/api-client';
import { Empty, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';

const TENANT_CURRENCY =
  process.env.NEXT_PUBLIC_TENANT_CURRENCY?.trim() || 'USD';
const TENANT_LOCALE =
  process.env.NEXT_PUBLIC_TENANT_LOCALE?.trim() || 'en';

function formatCurrency(amount: number, currency: string = TENANT_CURRENCY) {
  return new Intl.NumberFormat(TENANT_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(TENANT_LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function PaymentsList() {
  const t = useTranslations('lists');
  const paymentsQuery = useQuery({
    queryKey: ['payments-list-live'],
    queryFn: () => paymentsService.list(undefined, 1, 50),
    retry: false,
  });

  const payments = Array.isArray(paymentsQuery.data?.data) ? paymentsQuery.data!.data! : [];

  return (
    <>
      <PageHeader
        title={t('paymentsTitle')}
        subtitle={paymentsQuery.isLoading ? t('loading') : t('paymentsItems', { count: payments.length })}
        action={
          <Link
            href="/payments/receive"
            className="btn-primary text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />{t('paymentsReceive')}
          </Link>
        }
      />

      <div className="space-y-3 px-4 py-4 max-w-4xl mx-auto">
        {paymentsQuery.isLoading && (
          <div className="card p-4 text-sm text-gray-500">{t('paymentsLoading')}</div>
        )}

        {paymentsQuery.error && (
          <Alert variant="danger">
            <AlertDescription>
              {(paymentsQuery.error as Error).message || t('paymentsFailed')}
              <Button size="sm" onClick={() => paymentsQuery.refetch()} className="ml-2">
                {t('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!paymentsQuery.isLoading && !paymentsQuery.error && payments.length === 0 && (
          <Empty
            variant="default"
            icon={<DollarSign className="h-8 w-8 text-gray-400" />}
            title={t('paymentsEmptyTitle')}
            description={t('paymentsEmptyDesc')}
            action={{
              label: t('paymentsEmptyCta'),
              onClick: () => {
                window.location.href = '/payments/receive';
              },
            }}
          />
        )}

        {payments.map((payment: Record<string, unknown>) => {
          const id = payment.id as string;
          const amountRaw = (payment.amount as { amount?: number } | number | undefined);
          const amount =
            typeof amountRaw === 'number'
              ? amountRaw
              : amountRaw?.amount ??
                ((payment as { amountInCents?: number }).amountInCents ?? 0) / 100;
          const currency =
            (payment as { currency?: string }).currency ??
            (amountRaw as { currency?: string })?.currency ??
            TENANT_CURRENCY;
          const status = (payment as { status?: string }).status ?? 'pending';
          const channel =
            (payment as { channel?: string }).channel ??
            (payment as { paymentChannel?: string }).paymentChannel ??
            '';
          const created =
            (payment as { createdAt?: string }).createdAt ??
            (payment as { completedAt?: string }).completedAt ??
            null;

          return (
            <Link
              key={id}
              href={`/payments/${id}`}
              className="card block p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{formatCurrency(amount, currency)}</div>
                  <div className="text-sm text-gray-500">
                    {channel ? `${channel}` : t('paymentsChannelFallback')}
                    {created ? ` • ${formatDate(created)}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="badge-info text-xs capitalize">{status}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
