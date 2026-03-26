'use client';

import React from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: users,
    isLoading,
    error,
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
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-violet-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Users Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load user data.'}
        </p>
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
        <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">
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
            <p className="text-2xl font-bold text-gray-900">--</p>
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
          <div className="p-8 text-center text-gray-500">No users found</div>
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
