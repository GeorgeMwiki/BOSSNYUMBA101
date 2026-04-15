import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Building2,
  Mail,
  Phone,
  ArrowRight,
  MessageSquare,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/api';
import { tenantsApi, type OwnerTenant } from '../../lib/api/index';

type SortKey = 'name' | 'rentAmount' | 'leaseEndDate';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 10;

export default function TenantsPage() {
  const [tenants, setTenants] = useState<OwnerTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'INACTIVE'>(
    'all'
  );
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await tenantsApi.list();
        if (cancelled) return;
        if (res.success && res.data) {
          setTenants(res.data);
        } else {
          setTenants([]);
          setError(res.error?.message ?? 'Unable to load tenants');
        }
      } catch (err) {
        if (cancelled) return;
        setTenants([]);
        setError(err instanceof Error ? err.message : 'Unable to load tenants');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants.filter((t) => {
      const matchesQuery =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.propertyName?.toLowerCase().includes(q) ||
        t.unitNumber?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [tenants, search, statusFilter]);

  const sorted = useMemo(() => {
    const multiplier = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * multiplier;
      return String(av ?? '').localeCompare(String(bv ?? '')) * multiplier;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="text-gray-500">All tenants across your properties</p>
        </div>
        <Link
          to="/tenants/communications"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          <MessageSquare className="h-4 w-4" />
          Communications
        </Link>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as typeof statusFilter);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No tenants match the current filters</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => toggleSort('name')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none"
                  >
                    Tenant {sortKey === 'name' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Property / Unit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Contact
                  </th>
                  <th
                    onClick={() => toggleSort('rentAmount')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none"
                  >
                    Rent {sortKey === 'rentAmount' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th
                    onClick={() => toggleSort('leaseEndDate')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none"
                  >
                    Lease End {sortKey === 'leaseEndDate' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pageItems.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <span className="font-medium text-gray-900">{tenant.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <Link
                          to={`/properties/${tenant.propertyId}`}
                          className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1"
                        >
                          <Building2 className="h-4 w-4" />
                          {tenant.propertyName}
                        </Link>
                        <p className="text-sm text-gray-500">Unit {tenant.unitNumber}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 text-sm text-gray-600">
                        {tenant.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-4 w-4" />
                            {tenant.email}
                          </span>
                        )}
                        {tenant.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-4 w-4" />
                            {tenant.phone}
                          </span>
                        )}
                        {!tenant.email && !tenant.phone && '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatCurrency(tenant.rentAmount || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {tenant.leaseEndDate ? formatDate(tenant.leaseEndDate) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          tenant.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {tenant.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/tenants/${tenant.id}`}
                        className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        View <ArrowRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
              <span>
                Page {page} of {totalPages} ({sorted.length} tenants)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-white"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-white"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
