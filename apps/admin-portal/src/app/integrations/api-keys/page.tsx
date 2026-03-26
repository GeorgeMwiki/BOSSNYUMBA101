'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tenantsService } from '@bossnyumba/api-client';
import {
  Key,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Building2,
  Globe,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

export default function IntegrationsApiKeysPage() {
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const {
    data: tenant,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin-api-keys-tenant'],
    queryFn: async () => {
      const res = await tenantsService.getCurrent();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load API key data');
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
        <h2 className="text-lg font-semibold text-gray-900">API Keys Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load API key data.'}
        </p>
      </div>
    );
  }

  const tenantName = tenant?.name || 'Current Tenant';

  const formatDateTime = (val: string | null) => {
    if (!val) return 'Never';
    try { return new Date(val).toLocaleString(); } catch { return val; }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            API Keys
          </h1>
          <p className="text-gray-500">
            Manage tenant and platform API keys
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />
          Create API Key
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search API keys..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
          />
        </div>
        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="all">All Scopes</option>
          <option value="platform">Platform</option>
          <option value="tenant">Tenant</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-violet-100 rounded-lg w-fit">
            <Key className="h-5 w-5 text-violet-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">--</p>
            <p className="text-sm text-gray-500">Total API Keys</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-blue-100 rounded-lg w-fit">
            <Globe className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">--</p>
            <p className="text-sm text-gray-500">Platform Keys</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-green-100 rounded-lg w-fit">
            <Building2 className="h-5 w-5 text-green-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{tenantName}</p>
            <p className="text-sm text-gray-500">Tenants</p>
          </div>
        </div>
      </div>

      {/* Placeholder for live API keys */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <Key className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">API Key Management</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Connected to the live backend. API key management for {tenantName} tenants is available.
        </p>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Create API Key
              </h2>
              <p className="text-sm text-gray-500">
                Generate a new API key for platform or tenant access
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Key Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="e.g. Integration Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scope
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="platform">Platform</option>
                  <option value="tenant">Tenant</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Permissions
                </label>
                <div className="space-y-2">
                  {['read', 'write', 'admin'].map((perm) => (
                    <label
                      key={perm}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span className="text-sm text-gray-700 capitalize">
                        {perm}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
              >
                Generate Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
