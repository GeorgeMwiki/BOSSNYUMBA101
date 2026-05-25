'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Clock, ArrowRight } from 'lucide-react';
import { useCurrencyPreference } from '@/lib/hooks/useCurrencyPreference';
import { ROUTES } from '@/lib/routes';

const SAMPLE_TOTAL = 45000;
const SAMPLE_RENT = 40000;
const SAMPLE_SERVICE = 3000;
const SAMPLE_WATER = 2000;

export function UpcomingPayment() {
  const t = useTranslations('upcomingPayment');
  const { format: formatCurrency } = useCurrencyPreference();
  const dueInDays = 5;
  const dueDate = t('sampleDueDate');

  return (
    <section>
      <h2 className="text-sm font-medium text-gray-500 mb-3">{t('heading')}</h2>
      <div className="card p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(SAMPLE_TOTAL)}</div>
            <div className="text-sm text-gray-500">{t('duePrefix')}: {dueDate}</div>
          </div>
          <div className="badge-warning">
            <Clock className="w-3 h-3 mr-1" />
            {t('daysCount', { days: dueInDays })}
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('monthlyRent')}</span>
            <span>{formatCurrency(SAMPLE_RENT)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('serviceCharge')}</span>
            <span>{formatCurrency(SAMPLE_SERVICE)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('waterBill')}</span>
            <span>{formatCurrency(SAMPLE_WATER)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Link href={ROUTES.payments.pay} className="btn-primary flex-1">
            {t('payNow')}
          </Link>
          <Link href={ROUTES.payments.root} className="btn-secondary">
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
