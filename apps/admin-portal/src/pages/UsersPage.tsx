/**
 * UsersPage — directory of admin/operator users across tenants.
 *
 * Assumed backend endpoints (platform admin API):
 *   GET    /users?role=<role>&search=<q>
 *          -> { data: { items: AdminUser[], total: number } }
 *   POST   /users/:id/impersonate
 *          -> { data: { impersonationToken: string, expiresAt: string } }
 *   PATCH  /users/:id                     (body: Partial<AdminUser>)
 *
 * The api client normalizes responses to { success, data, error }.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCog,
  UserX,
  Users as UsersIcon,
} from 'lucide-react';
import { api, formatDate } from '../lib/api';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'support' | 'analyst' | 'operator' | string;
  tenantId: string | null;
  tenantName: string | null;
  status: 'active' | 'disabled' | 'invited' | string;
  lastLoginAt: string | null;
  createdAt: string;
}

interface UserListResponse {
  items: AdminUser[];
  total: number;
}

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'support', label: 'Support' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'operator', label: 'Operator' },
];

const statusBadge: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  invited: 'bg-blue-100 text-blue-700',
  disabled: 'bg-gray-200 text-gray-600',
};

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (role) qs.set('role', role);
    if (search) qs.set('search', search);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    api
      .get<UserListResponse>(`/users${suffix}`)
      .then((res) => {
        if (res.success && res.data) {
          setUsers(res.data.items);
        } else {
          setError(res.error ?? 'Failed to load users.');
          setUsers([]);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [role, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const handleImpersonate = async (user: AdminUser) => {
    if (!window.confirm(`Impersonate ${user.email}? This is audited.`)) return;
    setActingOn(user.id);
    const res = await api.post<{ impersonationToken: string }>(
      `/users/${user.id}/impersonate`,
      {}
    );
    setActingOn(null);
    if (!res.success) {
      setError(res.error ?? 'Failed to start impersonation.');
    } else if (res.data?.impersonationToken) {
      localStorage.setItem('impersonation_token', res.data.impersonationToken);
      window.location.href = '/';
    }
  };

  const handleDisable = async (user: AdminUser) => {
    if (!window.confirm(`Disable ${user.email}?`)) return;
    setActingOn(user.id);
    const res = await api.patch<AdminUser>(`/users/${user.id}`, {
      status: 'disabled',
    });
    setActingOn(null);
    if (res.success) {
      fetchUsers();
    } else {
      setError(res.error ?? 'Failed to disable user.');
    }
  };

  const totalLabel = useMemo(
    () => `${users.length.toLocaleString()} user${users.length === 1 ? '' : 's'}`,
    [users.length]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">{totalLabel}</p>
        </div>
      </div>

      <form
        onSubmit={handleSearch}
        className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200 p-3"
      >
        <label htmlFor="user-role" className="sr-only">
          Filter by role
        </label>
        <select
          id="user-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <label htmlFor="user-search" className="sr-only">
          Search users
        </label>
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            id="user-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email"
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
          onClick={fetchUsers}
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
            onClick={fetchUsers}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white rounded-xl border border-gray-200">
          <UsersIcon className="h-10 w-10 text-gray-300" />
          <p className="text-gray-500">No users yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tenant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last login</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{u.name}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-violet-500" />
                      <span className="capitalize">{u.role.replace('_', ' ')}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {u.tenantName ?? <span className="text-gray-400">Platform</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${statusBadge[u.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleImpersonate(u)}
                        disabled={actingOn === u.id || u.status !== 'active'}
                        className="inline-flex items-center gap-1 text-sm text-violet-600 hover:text-violet-700 disabled:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 rounded px-2 py-1"
                      >
                        <UserCog className="h-4 w-4" />
                        Impersonate
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDisable(u)}
                        disabled={actingOn === u.id || u.status === 'disabled'}
                        className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-2 py-1"
                      >
                        <UserX className="h-4 w-4" />
                        Disable
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default UsersPage;
