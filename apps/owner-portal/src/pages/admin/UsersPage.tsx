import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customersService } from '@bossnyumba/api-client';
import {
  Users,
  Search,
  RefreshCw,
  AlertTriangle,
  Plus,
  CheckCircle,
  Shield,
} from 'lucide-react';
import { useState } from 'react';

export function UsersPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: users,
    isLoading,
    error,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await customersService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load users');
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 bg-gray-200 rounded w-24" />
            <div className="h-4 bg-gray-200 rounded w-40" />
          </div>
          <div className="h-10 bg-gray-200 rounded-lg w-28" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <div className="h-9 w-9 bg-gray-200 rounded-lg" />
              <div className="h-7 bg-gray-200 rounded w-16 mt-4" />
              <div className="h-3 bg-gray-200 rounded w-20" />
            </div>
          ))}
        </div>
        <div className="h-10 bg-gray-200 rounded-lg w-64" />
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex gap-8">
            {[1,2,3,4].map(i => <div key={i} className="h-3 bg-gray-200 rounded w-16" />)}
          </div>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-6 px-6 py-4 border-b border-gray-100">
              <div className="h-4 bg-gray-200 rounded w-32" />
              <div className="h-4 bg-gray-200 rounded w-40" />
              <div className="h-4 bg-gray-200 rounded w-16" />
              <div className="h-5 bg-gray-200 rounded-full w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <div className="p-4 bg-amber-50 rounded-full mb-4">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Users Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load user data. Please check your connection and try again.'}
        </p>
        <button
          onClick={() => refetchUsers()}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  const userList = Array.isArray(users) ? users : [];
  const filtered = userList.filter((u: any) =>
    (u.name || `${u.firstName || ''} ${u.lastName || ''}`).toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">Platform user directory</p>
        </div>
        <button onClick={() => navigate('/users/new')} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-violet-100 rounded-lg w-fit">
            <Users className="h-5 w-5 text-violet-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{userList.length}</p>
            <p className="text-sm text-gray-500">Total Users</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-green-100 rounded-lg w-fit">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">
              {userList.filter((u: any) => u.status === 'ACTIVE').length}
            </p>
            <p className="text-sm text-gray-500">Active</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-blue-100 rounded-lg w-fit">
            <Shield className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-sm text-gray-500">Admins</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-3 bg-gray-100 rounded-full mb-3">
              <Users className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No Users Found</h3>
            <p className="text-sm text-gray-500 max-w-sm">
              {searchQuery ? 'Try adjusting your search query to find users.' : 'No users have been added to the platform yet.'}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.slice(0, 20).map((u: any) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.id}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.email || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.role || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {u.status || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
