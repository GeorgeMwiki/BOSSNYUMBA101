'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Clock, ArrowRight } from 'lucide-react';

export function UpcomingPayment() {
  const t = useTranslations('upcomingPayment');
  const dueInDays = 5;
  const amount = 'KES 45,000';
  const dueDate = t('sampleDueDate');

  return (
    <section>
      <h2 className="text-sm font-medium text-gray-500 mb-3">{t('heading')}</h2>
      <div className="card p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-2xl font-bold text-gray-900">{amount}</div>
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
            <span>KES 40,000</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('serviceCharge')}</span>
            <span>KES 3,000</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('waterBill')}</span>
            <span>KES 2,000</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Link href="/payments/pay" className="btn-primary flex-1">
            {t('payNow')}
          </Link>
          <Link href="/payments" className="btn-secondary">
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
