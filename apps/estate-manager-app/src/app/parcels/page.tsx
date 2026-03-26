'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, MapPin, ChevronRight, Landmark } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { parcelsService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

export default function ParcelsListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['parcels', { page, pageSize: 20, search: search || undefined, type: typeFilter || undefined, status: statusFilter || undefined }],
    queryFn: () => parcelsService.list({ page, pageSize: 20, search: search || undefined, type: typeFilter || undefined, status: statusFilter || undefined }),
    retry: false,
  });

  const parcels = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <>
      <PageHeader
        title="Land Parcels"
        subtitle={`${pagination?.totalItems ?? parcels.length} parcels`}
        action={
          <Link href="/parcels/new" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Add Parcel
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search parcels..."
              className="input pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input w-full sm:w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            <option value="bareland">Bareland</option>
            <option value="railway_reserve">Railway Reserve</option>
            <option value="commercial">Commercial</option>
            <option value="residential">Residential</option>
            <option value="industrial">Industrial</option>
          </select>
          <select className="input w-full sm:w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="available">Available</option>
            <option value="leased">Leased</option>
            <option value="partially_leased">Partially Leased</option>
            <option value="subdivided">Subdivided</option>
            <option value="reserved">Reserved</option>
          </select>
        </div>

        {/* Parcels List */}
        {isLoading ? (
          <div className="card p-8 text-center text-gray-500">Loading...</div>
        ) : parcels.length === 0 ? (
          <div className="card p-8 text-center">
            <Landmark className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No land parcels found</p>
            <p className="text-sm text-gray-400 mt-1">Add your first land parcel to get started</p>
            <Link href="/parcels/new" className="btn-primary mt-4 inline-block">Add Parcel</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {parcels.map((parcel: { id: string; name: string; parcelCode: string; type?: string; status?: string; totalAreaSqm?: number; availableAreaSqm?: number; region?: string; city?: string; nearRailwayReserve?: boolean }) => (
              <Link key={parcel.id} href={`/parcels/${parcel.id}`}>
                <div className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-50 rounded-lg">
                        <MapPin className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium">{parcel.name}</div>
                        <div className="text-sm text-gray-500">
                          {parcel.parcelCode} • {parcel.region ?? parcel.city} • {Number(parcel.totalAreaSqm ?? 0).toLocaleString()} sqm
                        </div>
                        {parcel.nearRailwayReserve && (
                          <span className="text-xs text-orange-600 font-medium">Railway Reserve</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge-info text-xs">{parcel.status ?? 'available'}</span>
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
            <button className="btn-secondary" disabled={!pagination.hasPreviousPage} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
            <span className="py-2 text-sm text-gray-500">Page {pagination.page} of {pagination.totalPages}</span>
            <button className="btn-secondary" disabled={!pagination.hasNextPage} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </>
  );
}
