/**
 * TenantsPage — directory of tenants on the platform.
 *
 * Assumed backend endpoints (served by the platform admin API):
 *   GET    /tenants?search=<q>&page=<n>&pageSize=<n>
 *          -> { data: { items: Tenant[], total: number, page: number, pageSize: number } }
 *   GET    /tenants/:id
 *   POST   /tenants                       (body: { name, slug, plan, ownerEmail })
 *   PATCH  /tenants/:id                   (body: Partial<Tenant>)
 *   POST   /tenants/:id/suspend           (body: { reason: string })
 *
 * The api client already normalizes to { success, data } shape.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  PauseCircle,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { api, formatDate } from '../lib/api';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'starter' | 'pro' | 'enterprise' | string;
  status: 'active' | 'suspended' | 'trialing' | 'pending' | string;
  ownerEmail: string;
  userCount: number;
  unitCount: number;
  createdAt: string;
}

interface TenantListResponse {
  items: Tenant[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

const statusBadge: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  trialing: 'bg-blue-100 text-blue-700',
  suspended: 'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700',
};

export function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suspending, setSuspending] = useState<string | null>(null);

  const fetchTenants = useCallback(() => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (search) qs.set('search', search);
    api
      .get<TenantListResponse>(`/tenants?${qs.toString()}`)
      .then((res) => {
        if (res.success && res.data) {
          setTenants(res.data.items);
          setTotal(res.data.total);
        } else {
          setError(res.error ?? 'Failed to load tenants.');
          setTenants([]);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleSuspend = async (tenant: Tenant) => {
    const reason = window.prompt(`Suspend ${tenant.name}? Enter reason:`);
    if (!reason) return;
    setSuspending(tenant.id);
    const res = await api.post(`/tenants/${tenant.id}/suspend`, { reason });
    setSuspending(null);
    if (res.success) {
      fetchTenants();
    } else {
      setError(res.error ?? 'Failed to suspend tenant.');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total.toLocaleString()} tenant{total === 1 ? '' : 's'} on the platform
          </p>
        </div>
        <Link
          to="/tenants/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          New Tenant
        </Link>
      </div>

      <form
        onSubmit={handleSearch}
        className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3"
      >
        <label htmlFor="tenant-search" className="sr-only">
          Search tenants
        </label>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            id="tenant-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, slug, or owner email"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Search
        </button>
        <button
          type="button"
          onClick={fetchTenants}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          aria-label="Refresh list"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </form>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 bg-white rounded-xl border border-gray-200">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <p className="text-gray-600">{error}</p>
          <button
            type="button"
            onClick={fetchTenants}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      ) : tenants.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white rounded-xl border border-gray-200">
          <Building2 className="h-10 w-10 text-gray-300" />
          <p className="text-gray-500">No tenants yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tenant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Users</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Units</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/tenants/${t.id}`} className="font-medium text-gray-900 hover:text-violet-700">
                      {t.name}
                    </Link>
                    <div className="text-xs text-gray-500">{t.ownerEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 capitalize">{t.plan}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${statusBadge[t.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{t.userCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{t.unitCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(t.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSuspend(t)}
                      disabled={suspending === t.id || t.status === 'suspended'}
                      className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-2 py-1"
                    >
                      <PauseCircle className="h-4 w-4" />
                      {suspending === t.id ? 'Suspending...' : 'Suspend'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm">
            <span className="text-gray-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TenantsPage;
