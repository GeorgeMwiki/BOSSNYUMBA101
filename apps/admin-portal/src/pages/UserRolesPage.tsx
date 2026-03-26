'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  Shield,
  Users,
  RefreshCw,
  AlertTriangle,
  Search,
  Lock,
} from 'lucide-react';
import { useState } from 'react';

interface RoleRecord {
  id: string;
  name: string;
  description?: string;
  type?: string;
  isSystem?: boolean;
  userCount?: number;
  permissions?: string[];
}

export function UserRolesPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: roles,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin-user-roles'],
    queryFn: async () => {
      const res = await api.get<RoleRecord[]>('/roles');
      if (!res.success || !res.data) throw new Error(res.error || 'Failed to load role data');
      return res.data;
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
        <h2 className="text-lg font-semibold text-gray-900">User Roles Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load role data. Please try again later.'}
        </p>
      </div>
    );
  }

  const roleList = Array.isArray(roles) ? roles : [];

  const filtered = roleList.filter((r) =>
    (r.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUsers = roleList.reduce((s, r) => s + (r.userCount || 0), 0);
  const systemRoleCount = roleList.filter(r => r.isSystem || r.type === 'System').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Roles</h1>
        <p className="text-sm text-gray-500 mt-1">Manage role assignments and RBAC policies</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-violet-100 rounded-lg w-fit">
            <Shield className="h-5 w-5 text-violet-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{roleList.length}</p>
            <p className="text-sm text-gray-500">Total Roles</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-blue-100 rounded-lg w-fit">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
            <p className="text-sm text-gray-500">Assigned Users</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-amber-100 rounded-lg w-fit">
            <Lock className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{systemRoleCount}</p>
            <p className="text-sm text-gray-500">System Roles</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search roles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
        />
      </div>

      {/* Roles Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No roles found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Permissions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((role) => {
                const roleType = role.isSystem ? 'System' : (role.type || 'Custom');
                const permCount = role.permissions ? role.permissions.length : 0;
                return (
                  <tr key={role.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Shield className={`h-5 w-5 ${roleType === 'System' ? 'text-violet-600' : 'text-gray-400'}`} />
                        <span className="text-sm font-medium text-gray-900">{role.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        roleType === 'System' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {roleType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{role.userCount || 0}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{permCount} permissions</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
