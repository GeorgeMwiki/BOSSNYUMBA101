'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, ChevronRight, Home, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { unitsService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

export default function UnitsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['units', { page, pageSize: 20, search: search || undefined, status: statusFilter || undefined }],
    queryFn: () => unitsService.list({ page, pageSize: 20, search: search || undefined, status: statusFilter || undefined }),
    retry: false,
  });

  const units = (data?.data ?? []) as Array<{
    id: string;
    unitNumber: string;
    propertyId?: string;
    type?: string;
    status?: string;
    floor?: number;
    rentAmount?: { amount: number; currency: string };
    bedrooms?: number;
  }>;
  const pagination = (data as Record<string, unknown>)?.pagination as { totalItems?: number; page?: number; totalPages?: number; hasPreviousPage?: boolean; hasNextPage?: boolean } | undefined;

  return (
    <>
      <PageHeader
        title="Units"
        subtitle={`${pagination?.totalItems ?? units.length} units`}
      />

      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search units..." className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input w-full sm:w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
            <option value="maintenance">Maintenance</option>
            <option value="reserved">Reserved</option>
          </select>
        </div>

        {isLoading ? (
          <div className="card p-8 text-center text-gray-500">Loading...</div>
        ) : units.length === 0 ? (
          <div className="card p-8 text-center">
            <Home className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No units found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {units.map((unit) => (
              <Link key={unit.id} href={`/units/${unit.id}`}>
                <div className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Home className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium">Unit {unit.unitNumber}</div>
                        <div className="text-sm text-gray-500">
                          {unit.type} {unit.floor != null ? `• Floor ${unit.floor}` : ''} {unit.bedrooms ? `• ${unit.bedrooms} BR` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        unit.status === 'available' ? 'bg-green-100 text-green-700' :
                        unit.status === 'occupied' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {unit.status ?? 'unknown'}
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {pagination && (pagination.totalPages ?? 0) > 1 && (
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
