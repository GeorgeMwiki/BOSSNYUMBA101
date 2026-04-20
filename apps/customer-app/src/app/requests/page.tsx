'use client';

import Link from 'next/link';
import { AlertTriangle, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';

export default function RequestsPage() {
  const t = useTranslations('requestsPage');
  return (
    <>
      <PageHeader title={t('title')} />
      <div className="px-4 py-4 pb-24">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">{t('unavailableTitle')}</p>
              <p className="text-sm text-red-700 mt-1">
                {t('unavailableBody')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Link
        href="/requests/new"
        className="fixed bottom-20 right-4 w-14 h-14 bg-primary-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-primary-600 transition-colors z-30"
        aria-label={t('newAria')}
      >
        <Plus className="w-6 h-6" />
      </Link>
    </>
  );
}
