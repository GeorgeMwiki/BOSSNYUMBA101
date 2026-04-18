'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { vendorsService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

export default function VendorsList() {
  const vendorsQuery = useQuery({
    queryKey: ['vendors-list-live'],
    queryFn: () => vendorsService.list({ page: 1, pageSize: 50 }),
    retry: false,
  });

  const vendors = vendorsQuery.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle={`${vendors.length} vendors`}
        action={<Link href="/vendors/new" className="btn-primary text-sm flex items-center gap-1"><Plus className="w-4 h-4" />Add</Link>}
      />
      <div className="space-y-3 px-4 py-4 max-w-4xl mx-auto">
        {vendorsQuery.isLoading && <div className="card p-4 text-sm text-gray-500">Loading vendors...</div>}
        {vendorsQuery.error && <div className="card p-4 text-sm text-danger-600">{(vendorsQuery.error as Error).message}</div>}
        {vendors.map((vendor: any) => (
          <Link key={vendor.id} href={`/vendors/${vendor.id}`} className="card block p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{vendor.companyName || vendor.name}</div>
                <div className="text-sm text-gray-500">{vendor.email || vendor.phone || 'No primary contact'}</div>
              </div>
              <div className="text-right">
                <div className="badge-info text-xs">{vendor.status}</div>
                <div className="mt-1 text-sm text-gray-500">{(vendor.categories || []).join(', ') || 'General'}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
