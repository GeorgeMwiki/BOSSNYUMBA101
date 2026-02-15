'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Building2, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { propertiesService } from '@bossnyumba/api-client';

export default function PropertiesListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['properties', { page, pageSize: 20, search: search || undefined, status: statusFilter || undefined }],
    queryFn: () =>
      propertiesService.list({
        page,
        pageSize: 20,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
    retry: false,
  });

  const properties = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <>
      <PageHeader
        title="Properties"
        subtitle={`${pagination?.totalItems ?? properties.length} total`}
        action={
          <Link href="/properties/new" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Add
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search properties..."
              className="input pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input w-full sm:w-auto"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="UNDER_CONSTRUCTION">Under Construction</option>
          </select>
        </div>

        {isLoading ? (
          <div className="card p-8 text-center text-gray-500">Loading...</div>
        ) : properties.length === 0 ? (
          <div className="card p-8 text-center">
            <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No properties found</p>
            <Link href="/properties/new" className="btn-primary mt-4 inline-block">
              Add Property
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {properties.map((property: { id: string; name: string; type?: string; address?: { city?: string }; totalUnits?: number; occupiedUnits?: number; status?: string }) => (
              <Link key={property.id} href={`/properties/${property.id}`}>
                <div className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary-50 rounded-lg">
                        <Building2 className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <div className="font-medium">{property.name}</div>
                        <div className="text-sm text-gray-500">
                          {property.address?.city} • {property.totalUnits ?? 0} units •{' '}
                          {property.occupiedUnits ?? 0} occupied
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge-info text-xs">{property.status ?? 'ACTIVE'}</span>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 pt-4">
            <button
              className="btn-secondary"
              disabled={!pagination.hasPreviousPage}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="py-2 text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              className="btn-secondary"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
