'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { vendorsService } from '@bossnyumba/api-client';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';

export default function VendorsList() {
  const t = useTranslations('vendorsList');
  const vendorsQuery = useQuery({
    queryKey: ['vendors-list-live'],
    queryFn: () => vendorsService.list({ page: 1, pageSize: 50 }),
    retry: false,
  });

  const vendors = vendorsQuery.data?.data ?? [];

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('countLabel', { count: vendors.length })}
        action={<Link href="/vendors/new" className="btn-primary text-sm flex items-center gap-1"><Plus className="w-4 h-4" />{t('add')}</Link>}
      />
      <div className="space-y-3 px-4 py-4 max-w-4xl mx-auto">
        {vendorsQuery.isLoading && <div className="card p-4 text-sm text-gray-500">{t('loading')}</div>}
        {vendorsQuery.error && <div className="card p-4 text-sm text-danger-600">{(vendorsQuery.error as Error).message}</div>}
        {vendors.map((vendor: any) => (
          <Link key={vendor.id} href={`/vendors/${vendor.id}`} className="card block p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{vendor.companyName || vendor.name}</div>
                <div className="text-sm text-gray-500">{vendor.email || vendor.phone || t('noContact')}</div>
              </div>
              <div className="text-right">
                <div className="badge-info text-xs">{vendor.status}</div>
                <div className="mt-1 text-sm text-gray-500">{(vendor.categories || []).join(', ') || t('categoryGeneral')}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
