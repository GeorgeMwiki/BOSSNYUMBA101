'use client';

import { useQuery } from '@tanstack/react-query';
import { vendorsService } from '@bossnyumba/api-client';

interface VendorRecommendationProps {
  category?: string;
  priority?: string;
  unitId?: string;
  propertyId?: string;
  onSelectVendor?: (vendorId: string) => void;
}

export function VendorRecommendation({ category, onSelectVendor }: VendorRecommendationProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['vendors', 'recommendations', category],
    queryFn: () => vendorsService.list({ category: category || undefined }),
  });

  const vendors = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="card p-4">
        <h3 className="font-semibold mb-3">Recommended Vendors</h3>
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-4">
        <h3 className="font-semibold mb-3">Recommended Vendors</h3>
        <p className="text-sm text-red-600">Failed to load vendor recommendations.</p>
      </div>
    );
  }

  if (vendors.length === 0) {
    return (
      <div className="card p-4">
        <h3 className="font-semibold mb-3">Recommended Vendors</h3>
        <p className="text-sm text-gray-500">
          No vendors found{category ? ` for ${category.replace('_', ' ')}` : ''}.
          <a href="/vendors/new" className="text-primary-600 ml-1">Add a vendor</a>
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <h3 className="font-semibold mb-3">Recommended Vendors</h3>
      <div className="space-y-2">
        {vendors.map((vendor: any) => (
          <button
            key={vendor.id}
            onClick={() => onSelectVendor?.(vendor.id)}
            className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{vendor.name}</p>
                <p className="text-sm text-gray-500 capitalize">
                  {vendor.type || 'Vendor'}
                </p>
                {vendor.phone && (
                  <p className="text-xs text-gray-400 mt-1">{vendor.phone}</p>
                )}
              </div>
              {vendor.rating && (
                <span className="text-sm font-medium text-yellow-600">
                  {vendor.rating}/5
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
