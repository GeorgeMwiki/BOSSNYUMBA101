'use client';

import { useQuery } from '@tanstack/react-query';
import { vendorsService } from '@bossnyumba/api-client';

export default function VendorsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorsService.list({}),
  });

  const vendors = data?.data ?? [];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vendors</h1>
        <a href="/vendors/new" className="btn-primary text-sm">
          Add Vendor
        </a>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Failed to load vendors: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && vendors.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No vendors found</p>
          <p className="text-sm mt-1">Vendors will appear here once added.</p>
        </div>
      )}

      <div className="space-y-3">
        {vendors.map((vendor: any) => (
          <a
            key={vendor.id}
            href={`/vendors/${vendor.id}`}
            className="card p-4 block hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{vendor.name}</h3>
                <p className="text-sm text-gray-500 mt-1 capitalize">
                  {vendor.type || 'Vendor'}
                </p>
                {vendor.phone && (
                  <p className="text-xs text-gray-400 mt-1">{vendor.phone}</p>
                )}
                {vendor.categories && vendor.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {vendor.categories.slice(0, 3).map((cat: string) => (
                      <span
                        key={cat}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded capitalize"
                      >
                        {cat.replace('_', ' ')}
                      </span>
                    ))}
                    {vendor.categories.length > 3 && (
                      <span className="text-xs text-gray-400">
                        +{vendor.categories.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  vendor.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : vendor.status === 'inactive'
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {vendor.status || 'active'}
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
