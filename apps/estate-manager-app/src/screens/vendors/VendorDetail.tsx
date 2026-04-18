'use client';

import { useQuery } from '@tanstack/react-query';
import { vendorsService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

interface VendorDetailProps {
  vendorId: string;
}

export default function VendorDetail({ vendorId }: VendorDetailProps) {
  const vendorQuery = useQuery({
    queryKey: ['vendor-detail-live', vendorId],
    queryFn: () => vendorsService.get(vendorId),
    enabled: !!vendorId,
    retry: false,
  });

  const vendor = vendorQuery.data?.data as any;

  return (
    <>
      <PageHeader title={vendor?.companyName || vendor?.name || 'Vendor'} showBack />
      <div className="space-y-4 px-4 py-4 max-w-3xl mx-auto">
        {vendorQuery.isLoading && <div className="card p-4 text-sm text-gray-500">Loading vendor...</div>}
        {vendorQuery.error && <div className="card p-4 text-sm text-danger-600">{(vendorQuery.error as Error).message}</div>}
        {vendor && (
          <div className="card p-4 grid grid-cols-2 gap-4">
            <div><div className="text-sm text-gray-500">Company</div><div className="font-medium">{vendor.companyName || vendor.name}</div></div>
            <div><div className="text-sm text-gray-500">Status</div><div className="font-medium">{vendor.status}</div></div>
            <div><div className="text-sm text-gray-500">Email</div><div className="font-medium">{vendor.email || 'N/A'}</div></div>
            <div><div className="text-sm text-gray-500">Phone</div><div className="font-medium">{vendor.phone || 'N/A'}</div></div>
            <div className="col-span-2"><div className="text-sm text-gray-500">Categories</div><div className="font-medium">{(vendor.categories || []).join(', ') || 'General'}</div></div>
          </div>
        )}
      </div>
    </>
  );
}
