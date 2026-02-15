'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, FileText, ChevronRight, Calendar, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { MoneyDisplay } from '@/components/MoneyDisplay';
import { DateDisplay } from '@/components/DateDisplay';
import { SearchInput } from '@/components/SearchInput';
import { Pagination } from '@/components/Pagination';
import type { StatusType } from '@/components/StatusBadge';
import { leasesService } from '@bossnyumba/api-client';

export interface Lease {
  id: string;
  leaseNumber: string;
  unit: string;
  property: string;
  tenantName: string;
  status: StatusType;
  monthlyRent: number;
  startDate: string;
  endDate: string;
  deposit?: number;
}

const fallbackLeases: Lease[] = [
  { id: '1', leaseNumber: 'LSE-2024-001', unit: 'A-204', property: 'Sunset Apartments', tenantName: 'John Kamau', status: 'active', monthlyRent: 45000, startDate: '2024-01-01', endDate: '2025-12-31', deposit: 90000 },
  { id: '2', leaseNumber: 'LSE-2024-002', unit: 'B-102', property: 'Sunset Apartments', tenantName: 'Mary Wanjiku', status: 'active', monthlyRent: 52000, startDate: '2024-02-15', endDate: '2025-02-14', deposit: 104000 },
  { id: '3', leaseNumber: 'LSE-2023-018', unit: 'C-301', property: 'Sunset Apartments', tenantName: 'Peter Ochieng', status: 'pending', monthlyRent: 48000, startDate: '2024-03-01', endDate: '2025-02-28', deposit: 96000 },
  { id: '4', leaseNumber: 'LSE-2022-005', unit: 'A-105', property: 'Sunset Apartments', tenantName: 'Jane Akinyi', status: 'expired', monthlyRent: 42000, startDate: '2022-06-01', endDate: '2024-01-31' },
];

const statusFilterOptions = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
];

const statusMap: Record<string, StatusType> = {
  ACTIVE: 'active', PENDING: 'pending', EXPIRED: 'expired',
  TERMINATED: 'terminated', DRAFT: 'pending', RENEWED: 'active',
};

export function LeasesList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Fetch leases from API
  const { data: apiData, isLoading } = useQuery({
    queryKey: ['leases', 'list', { status: statusFilter !== 'all' ? statusFilter.toUpperCase() : undefined, page }],
    queryFn: () => leasesService.list({
      page,
      pageSize: perPage,
      status: statusFilter !== 'all' ? statusFilter.toUpperCase() : undefined,
    }),
    retry: false,
  });

  // Map API data or use fallback
  const leases: Lease[] = useMemo(() => {
    const raw = apiData?.data;
    if (!raw || !Array.isArray(raw) || raw.length === 0) return fallbackLeases;

    return raw.map((l) => ({
      id: l.id,
      leaseNumber: `LSE-${l.id.slice(0, 8)}`,
      unit: l.unit?.unitNumber ?? '',
      property: l.property?.name ?? '',
      tenantName: l.customer?.name ?? 'Tenant',
      status: statusMap[String(l.status)] ?? String(l.status).toLowerCase() as StatusType,
      monthlyRent: l.rentAmount ?? 0,
      startDate: l.startDate,
      endDate: l.endDate,
      deposit: l.depositAmount,
    }));
  }, [apiData]);

  const pagination = apiData?.pagination;

  const filteredLeases = leases.filter((lease) => {
    const matchesSearch =
      !searchQuery ||
      lease.tenantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lease.leaseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lease.unit.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const totalPages = pagination?.totalPages ?? Math.ceil(filteredLeases.length / perPage);

  return (
    <>
      <PageHeader
        title="Leases"
        subtitle={`${pagination?.totalItems ?? filteredLeases.length} lease${filteredLeases.length !== 1 ? 's' : ''}`}
        action={
          <Link href="/leases/new" className="btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Lease</span>
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchInput
              onChange={setSearchQuery}
              placeholder="Search by tenant, unit, or lease number..."
              debounceMs={200}
            />
          </div>
          <select
            className="w-full sm:w-auto px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            {statusFilterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLeases.length === 0 ? (
              <div className="card p-8 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No leases found</p>
                <p className="text-sm mt-1">
                  {searchQuery || statusFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Create your first lease to get started'}
                </p>
              </div>
            ) : (
              filteredLeases.map((lease) => (
                <Link key={lease.id} href={`/leases/${lease.id}`}>
                  <div className="card p-4 hover:border-primary-200 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-500 font-mono">{lease.leaseNumber}</span>
                          <StatusBadge status={lease.status} />
                        </div>
                        <div className="font-medium mt-1 truncate">{lease.tenantName}</div>
                        <div className="text-sm text-gray-500 mt-0.5">
                          Unit {lease.unit} &bull; {lease.property}
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <Calendar className="w-3.5 h-3.5" />
                          <DateDisplay date={lease.endDate} format="short" />
                          <span>Expires</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-semibold"><MoneyDisplay amount={lease.monthlyRent} /></div>
                        <div className="text-xs text-gray-500">/month</div>
                        <ChevronRight className="w-5 h-5 text-gray-400 mt-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {totalPages > 1 && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </div>
    </>
  );
}
