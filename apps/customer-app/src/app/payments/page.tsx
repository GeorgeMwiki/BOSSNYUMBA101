'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  Filter,
  ChevronDown,
  Calendar,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useI18n } from '@bossnyumba/i18n';
import type { Payment } from '@/lib/payment-types';
import {
  MOCK_PAYMENTS,
  CURRENT_BALANCE,
  DATE_RANGE_OPTIONS,
  filterPaymentsByDateRange,
} from '@/lib/payments-data';

export default function PaymentsPage() {
  const { t } = useI18n();
  const [dateRange, setDateRange] = useState('all');
  const [showFilter, setShowFilter] = useState(false);

  const statusConfig = {
    paid: { label: t('common.status.completed'), icon: CheckCircle, color: 'badge-success' },
    pending: { label: t('common.status.pending'), icon: Clock, color: 'badge-warning' },
    overdue: { label: t('common.status.overdue'), icon: AlertCircle, color: 'badge-danger' },
    processing: { label: t('payments.status.processing'), icon: Clock, color: 'badge-info' },
    failed: { label: t('payments.status.failed'), icon: AlertCircle, color: 'badge-danger' },
  };

  const typeLabels: Record<string, string> = {
    rent: t('customer.payments.title'),
    utilities: t('customer.utilities.title'),
    deposit: t('customer.lease.deposit'),
    late_fee: t('common.status.overdue'),
    other: t('maintenance.categories.other'),
  };

  const filteredPayments = filterPaymentsByDateRange(MOCK_PAYMENTS, dateRange);
  const pendingPayments = filteredPayments.filter(
    (p) => p.status === 'pending' || p.status === 'overdue'
  );
  const completedPayments = filteredPayments.filter((p) => p.status === 'paid');

  return (
    <>
      <PageHeader
        title={t('customer.payments.title')}
        action={
          <div className="relative">
            <button
              onClick={() => setShowFilter(!showFilter)}
              className="p-2 rounded-lg hover:bg-gray-100 flex items-center gap-1"
              aria-label={t('common.actions.filter')}
            >
              <Filter className="w-5 h-5" />
              <ChevronDown className="w-4 h-4" />
            </button>
            {showFilter && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowFilter(false)}
                  aria-hidden
                />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-200 py-2 min-w-[180px]">
                  {DATE_RANGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setDateRange(opt.value);
                        setShowFilter(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-gray-50 ${
                        dateRange === opt.value ? 'text-primary-600 font-medium bg-primary-50' : ''
                      }`}
                    >
                      <Calendar className="w-4 h-4 opacity-50" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        }
      />

      <div className="px-4 py-4 space-y-6 pb-24">
        {/* Balance Card */}
        <div className="card p-6 bg-gradient-to-br from-primary-600 to-primary-700 text-white shadow-lg">
          <div className="text-sm opacity-90 mb-1">{t('customer.payments.amountDue')}</div>
          <div className="text-4xl font-bold mb-6">
            KES {CURRENT_BALANCE.toLocaleString()}
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href="/payments/pay"
              className="btn bg-white text-primary-700 w-full py-5 text-lg font-semibold justify-center flex items-center gap-2 min-h-[56px] active:scale-[0.98] transition-transform"
            >
              <CreditCard className="w-6 h-6" />
              {t('customer.payments.payNow')}
            </Link>
            <div className="flex gap-2">
              <Link
                href="/payments/history"
                className="btn bg-primary-500/80 text-white py-3 px-4 flex-1 flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                {t('customer.payments.paymentHistory')}
              </Link>
              <Link
                href={`/payments/plan?amount=${CURRENT_BALANCE}`}
                className="btn bg-primary-500/80 text-white py-3 px-4 flex-1 flex items-center justify-center gap-2"
              >
                <Calendar className="w-5 h-5" />
                {t('customer.payments.paymentPlan')}
              </Link>
            </div>
          </div>
        </div>

        {/* Payment History */}
        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">{t('customer.payments.paymentHistory')}</h2>
          <div className="space-y-3">
            {pendingPayments.length > 0 && (
              <>
                <div className="text-xs text-gray-400 mb-2">
                  {t('common.status.pending')} ({pendingPayments.length})
                </div>
                {pendingPayments.map((payment) => (
                  <PaymentCard key={payment.id} payment={payment} statusConfig={statusConfig} typeLabels={typeLabels} t={t} />
                ))}
              </>
            )}
            {completedPayments.map((payment) => (
              <PaymentCard key={payment.id} payment={payment} statusConfig={statusConfig} typeLabels={typeLabels} t={t} />
            ))}
            {filteredPayments.length === 0 && (
              <div className="card p-8 text-center text-gray-500">
                <CreditCard className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p>{t('common.empty.noResults')}</p>
              </div>
            )}
          </div>
        </section>

        <Link
          href="/payments/history"
          className="block text-center text-sm text-primary-600 py-4"
        >
          {t('common.actions.showMore')} &rarr;
        </Link>
      </div>
    </>
  );
}

function PaymentCard({
  payment,
  statusConfig,
  typeLabels,
  t,
}: {
  payment: Payment;
  statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }>;
  typeLabels: Record<string, string>;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const status = statusConfig[payment.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <Link href={`/payments/invoice/${payment.id}`}>
      <div className="card p-4 active:scale-[0.98] transition-transform">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="font-medium">{typeLabels[payment.type]}</div>
            <div className="text-sm text-gray-500">
              {t('customer.payments.dueDate')}: {new Date(payment.dueDate).toLocaleDateString()}
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold">KES {payment.amount.toLocaleString()}</div>
            <span className={status.color}>
              <StatusIcon className="w-3 h-3 mr-1 inline" />
              {status.label}
            </span>
          </div>
        </div>
        {payment.paidDate && (
          <div className="text-xs text-gray-400 mt-2">
            {t('customer.payments.paidOn')} {new Date(payment.paidDate).toLocaleDateString()} via {payment.channel}
          </div>
        )}
      </div>
    </Link>
  );
}
