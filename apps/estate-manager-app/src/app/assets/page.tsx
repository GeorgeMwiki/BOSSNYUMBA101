'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, ChevronRight, Package, ClipboardCheck, Plus, AlertTriangle, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { assetsService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

const CONDITION_COLORS: Record<string, string> = {
  excellent: 'bg-green-100 text-green-800',
  good: 'bg-blue-100 text-blue-800',
  fair: 'bg-yellow-100 text-yellow-800',
  poor: 'bg-orange-100 text-orange-800',
  condemned: 'bg-red-100 text-red-800',
  not_assessed: 'bg-gray-100 text-gray-800',
};

export default function AssetRegisterPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [conditionFilter, setConditionFilter] = useState<string>('');
  const [occupancyFilter, setOccupancyFilter] = useState<string>('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['asset-register', { page, pageSize: 20, search: search || undefined, condition: conditionFilter || undefined, occupancyStatus: occupancyFilter || undefined }],
    queryFn: () => assetsService.list({ page, pageSize: 20, search: search || undefined, condition: conditionFilter || undefined, occupancyStatus: occupancyFilter || undefined }),
    retry: false,
  });

  const assets = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <>
      <PageHeader
        title="Asset Register"
        subtitle="Fixed assets & condition tracking"
        action={
          <div className="flex gap-2">
            <Link href="/assets/surveys" className="btn-secondary text-sm flex items-center gap-1">
              <ClipboardCheck className="w-4 h-4" />
              Surveys
            </Link>
            <Link href="/assets/new" className="btn-primary text-sm flex items-center gap-1">
              <Plus className="w-4 h-4" />
              Add Asset
            </Link>
          </div>
        }
      />

      <div className="px-4 py-4 pb-24 space-y-4 max-w-4xl mx-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold">{assets.length}</div>
            <div className="text-xs text-gray-500">Total Assets</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-green-600">
              {assets.filter((a: { occupancyStatus?: string }) => a.occupancyStatus === 'occupied').length}
            </div>
            <div className="text-xs text-gray-500">Occupied</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-2xl font-bold text-red-600">
              {assets.filter((a: { occupancyStatus?: string }) => a.occupancyStatus === 'unoccupied').length}
            </div>
            <div className="text-xs text-gray-500">Unoccupied</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search assets..." className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input w-full sm:w-auto" value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)}>
            <option value="">All Conditions</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
            <option value="condemned">Condemned</option>
            <option value="not_assessed">Not Assessed</option>
          </select>
          <select className="input w-full sm:w-auto" value={occupancyFilter} onChange={(e) => setOccupancyFilter(e.target.value)}>
            <option value="">All Occupancy</option>
            <option value="occupied">Occupied</option>
            <option value="unoccupied">Unoccupied</option>
            <option value="partially_occupied">Partially Occupied</option>
          </select>
        </div>

        {/* Asset List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-5 w-16 bg-gray-200 rounded-full" />
                    <div className="h-5 w-16 bg-gray-200 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Failed to load assets</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-6">Please check your connection and try again.</p>
            <button onClick={() => refetch()} className="btn-secondary text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No assets in register</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-6">Start building your fixed asset register.</p>
            <Link href="/assets/new" className="btn-primary text-sm">Add Asset</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {assets.map((asset: {
              id: string;
              assetCode: string;
              name: string;
              type?: string;
              currentCondition?: string;
              occupancyStatus?: string;
              location?: string;
              monthlyRentAmount?: number;
            }) => (
              <Link key={asset.id} href={`/assets/${asset.id}`}>
                <div className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-50 rounded-lg">
                        <Package className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="font-medium">{asset.name}</div>
                        <div className="text-sm text-gray-500">
                          {asset.assetCode} • {asset.type} • {asset.location ?? '—'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONDITION_COLORS[asset.currentCondition ?? 'not_assessed']}`}>
                        {asset.currentCondition ?? 'not assessed'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        asset.occupancyStatus === 'occupied' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {asset.occupancyStatus ?? 'unknown'}
                      </span>
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
