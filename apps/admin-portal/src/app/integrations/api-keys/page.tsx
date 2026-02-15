import React, { useState } from 'react';
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
} from 'lucide-react';
import { formatDateTime } from '../../../lib/api';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scope: 'platform' | 'tenant';
  tenantName: string | null;
  permissions: string[];
  lastUsed: string | null;
  createdAt: string;
  expiresAt: string | null;
}

const apiKeys: ApiKey[] = [
  {
    id: '1',
    name: 'Admin API Key',
    prefix: 'bn_live_...',
    scope: 'platform',
    tenantName: null,
    permissions: ['read', 'write', 'admin'],
    lastUsed: new Date(Date.now() - 3600000).toISOString(),
    createdAt: '2024-01-01',
    expiresAt: null,
  },
  {
    id: '2',
    name: 'Acme Properties Integration',
    prefix: 'bn_live_...',
    scope: 'tenant',
    tenantName: 'Acme Properties Ltd',
    permissions: ['read', 'write'],
    lastUsed: new Date(Date.now() - 86400000).toISOString(),
    createdAt: '2024-06-15',
    expiresAt: '2025-06-15',
  },
  {
    id: '3',
    name: 'Highland Properties API',
    prefix: 'bn_live_...',
    scope: 'tenant',
    tenantName: 'Highland Properties',
    permissions: ['read', 'write'],
    lastUsed: new Date(Date.now() - 43200000).toISOString(),
    createdAt: '2024-09-20',
    expiresAt: '2025-09-20',
  },
  {
    id: '4',
    name: 'Reports Service',
    prefix: 'bn_live_...',
    scope: 'platform',
    tenantName: null,
    permissions: ['read'],
    lastUsed: null,
    createdAt: '2024-11-01',
    expiresAt: '2025-11-01',
  },
];

export default function IntegrationsApiKeysPage() {
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filteredKeys = apiKeys.filter((key) => {
    const matchesSearch =
      key.name.toLowerCase().includes(search.toLowerCase()) ||
      (key.tenantName?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesScope = scopeFilter === 'all' || key.scope === scopeFilter;
    return matchesSearch && matchesScope;
  });

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
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <Filter className="h-4 w-4" />
          More Filters
        </button>
      </div>

      {/* API Keys Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Key
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Scope
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Permissions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Used
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expires
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredKeys.map((key) => (
              <tr key={key.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{key.name}</p>
                      <p className="text-sm text-gray-500 font-mono">
                        {key.prefix}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${
                      key.scope === 'platform'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {key.scope === 'platform' ? (
                      <Globe className="h-3 w-3" />
                    ) : (
                      <Building2 className="h-3 w-3" />
                    )}
                    {key.scope}
                  </span>
                  {key.tenantName && (
                    <p className="text-xs text-gray-500 mt-1">
                      {key.tenantName}
                    </p>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {key.permissions.join(', ')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {key.lastUsed
                    ? formatDateTime(key.lastUsed)
                    : 'Never'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDateTime(key.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {key.expiresAt
                    ? formatDateTime(key.expiresAt)
                    : 'Never'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                      <Copy className="h-4 w-4" />
                    </button>
                    <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredKeys.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No API keys found
        </div>
      )}

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
