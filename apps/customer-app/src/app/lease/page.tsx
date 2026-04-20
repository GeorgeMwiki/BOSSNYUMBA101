'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Calendar, FileText, Home } from 'lucide-react';
import { EmptyState } from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';

export default function LeasePage() {
  const t = useTranslations('leaseIndex');
  const leaseQuery = useQuery({
    queryKey: ['customer-current-lease'],
    queryFn: () => api.lease.getCurrent(),
  });

  const lease = leaseQuery.data as any;

  return (
    <>
      <PageHeader title={t('title')} showSettings />

      <div className="space-y-4 px-4 py-4 pb-24">
        {leaseQuery.isLoading && <div className="card p-4 text-sm text-gray-400">{t('loadingLease')}</div>}
        {leaseQuery.error && (
          <div className="card border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100 flex items-center justify-between gap-3">
            <span>{(leaseQuery.error as Error).message || t('errorLoad')}</span>
            <button
              type="button"
              onClick={() => leaseQuery.refetch()}
              className="rounded border border-red-400/60 px-3 py-1 text-xs hover:bg-red-500/20"
            >
              {t('retry')}
            </button>
          </div>
        )}

        {!leaseQuery.isLoading && !leaseQuery.error && !lease && (
          <EmptyState
            icon={<Home className="h-8 w-8" />}
            title={t('emptyTitle')}
            description={t('emptyDesc')}
          />
        )}

        {lease && (
          <>
            <div className="card p-4">
              <div className="mb-2 flex items-center gap-2 text-gray-400">
                <Home className="h-4 w-4" />
                {t('currentLease')}
              </div>
              <div className="text-xl font-semibold text-white">{lease.property?.name || t('activeLease')}</div>
              <div className="mt-2 text-sm text-gray-400">
                {t('unitPrefix')} {lease.unit?.unitNumber || lease.unitId}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-white/10 p-3">
                  <div className="text-gray-400">{t('start')}</div>
                  <div className="mt-1 text-white">{new Date(lease.startDate).toLocaleDateString()}</div>
                </div>
                <div className="rounded-xl border border-white/10 p-3">
                  <div className="text-gray-400">{t('end')}</div>
                  <div className="mt-1 text-white">{new Date(lease.endDate).toLocaleDateString()}</div>
                </div>
                <div className="rounded-xl border border-white/10 p-3">
                  <div className="text-gray-400">{t('rent')}</div>
                  <div className="mt-1 text-white">KES {Number(lease.rentAmount).toLocaleString()}</div>
                </div>
                <div className="rounded-xl border border-white/10 p-3">
                  <div className="text-gray-400">{t('status')}</div>
                  <div className="mt-1 text-white">{lease.status}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link href="/lease/renewal" className="card p-4">
                <Calendar className="mb-2 h-5 w-5 text-white" />
                <div className="font-medium text-white">{t('renewal')}</div>
                <div className="text-sm text-gray-400">{t('renewalDesc')}</div>
              </Link>
              <Link href="/lease/move-out" className="card p-4">
                <FileText className="mb-2 h-5 w-5 text-white" />
                <div className="font-medium text-white">{t('moveOut')}</div>
                <div className="text-sm text-gray-400">{t('moveOutDesc')}</div>
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
