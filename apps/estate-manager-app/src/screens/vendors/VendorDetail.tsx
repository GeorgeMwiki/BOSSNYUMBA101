'use client';

import { useQuery } from '@tanstack/react-query';
import { vendorsService } from '@bossnyumba/api-client';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';

interface VendorDetailProps {
  vendorId: string;
}

export default function VendorDetail({ vendorId }: VendorDetailProps) {
  const t = useTranslations('vendorDetail');
  const vendorQuery = useQuery({
    queryKey: ['vendor-detail-live', vendorId],
    queryFn: () => vendorsService.get(vendorId),
    enabled: !!vendorId,
    retry: false,
  });

  const vendor = vendorQuery.data?.data as any;

  return (
    <>
      <PageHeader title={vendor?.companyName || vendor?.name || t('titleFallback')} showBack />
      <div className="space-y-4 px-4 py-4 max-w-3xl mx-auto">
        {vendorQuery.isLoading && <div className="card p-4 text-sm text-gray-500">{t('loading')}</div>}
        {vendorQuery.error && <div className="card p-4 text-sm text-danger-600">{(vendorQuery.error as Error).message}</div>}
        {vendor && (
          <div className="card p-4 grid grid-cols-2 gap-4">
            <div><div className="text-sm text-gray-500">{t('company')}</div><div className="font-medium">{vendor.companyName || vendor.name}</div></div>
            <div><div className="text-sm text-gray-500">{t('status')}</div><div className="font-medium">{vendor.status}</div></div>
            <div><div className="text-sm text-gray-500">{t('email')}</div><div className="font-medium">{vendor.email || t('na')}</div></div>
            <div><div className="text-sm text-gray-500">{t('phone')}</div><div className="font-medium">{vendor.phone || t('na')}</div></div>
            <div className="col-span-2"><div className="text-sm text-gray-500">{t('categories')}</div><div className="font-medium">{(vendor.categories || []).join(', ') || t('categoryGeneral')}</div></div>
          </div>
        )}
      </div>
    </>
  );
}
