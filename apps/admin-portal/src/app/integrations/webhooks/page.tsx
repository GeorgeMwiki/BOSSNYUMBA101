import React, { useState } from 'react';
import {
  Webhook,
  Plus,
  Search,
  Filter,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  Copy,
  Trash2,
} from 'lucide-react';
import { formatDateTime } from '../../../lib/api';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  tenantId: string | null;
  tenantName: string | null;
  status: 'active' | 'inactive' | 'failing';
  lastTriggered: string | null;
  successRate: number;
  createdAt: string;
}

const webhooks: WebhookConfig[] = [
  {
    id: '1',
    name: 'Payment Success',
    url: 'https://acmeproperties.co.ke/webhooks/payments',
    events: ['payment.completed', 'payment.refunded'],
    tenantId: 't1',
    tenantName: 'Acme Properties Ltd',
    status: 'active',
    lastTriggered: new Date(Date.now() - 3600000).toISOString(),
    successRate: 99.2,
    createdAt: '2024-06-15',
  },
  {
    id: '2',
    name: 'Tenant Created',
    url: 'https://api.bossnyumba.com/internal/tenant-events',
    events: ['tenant.created', 'tenant.updated'],
    tenantId: null,
    tenantName: null,
    status: 'active',
    lastTriggered: new Date(Date.now() - 86400000).toISOString(),
    successRate: 100,
    createdAt: '2024-01-01',
  },
  {
    id: '3',
    name: 'Property Sync',
    url: 'https://highland.co.ke/api/sync/properties',
    events: ['property.created', 'property.updated', 'property.deleted'],
    tenantId: 't5',
    tenantName: 'Highland Properties',
    status: 'failing',
    lastTriggered: new Date(Date.now() - 7200000).toISOString(),
    successRate: 72.5,
    createdAt: '2024-09-20',
  },
  {
    id: '4',
    name: 'Lease Expiry Alert',
    url: 'https://sunriserealty.co.ke/webhooks/leases',
    events: ['lease.expiring', 'lease.expired'],
    tenantId: 't2',
    tenantName: 'Sunrise Realty',
    status: 'inactive',
    lastTriggered: null,
    successRate: 0,
    createdAt: '2024-08-10',
  },
];

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-700',
  failing: 'bg-red-100 text-red-700',
};

export default function IntegrationsWebhooksPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredWebhooks = webhooks.filter((wh) => {
    const matchesSearch =
      wh.name.toLowerCase().includes(search.toLowerCase()) ||
      wh.url.toLowerCase().includes(search.toLowerCase()) ||
      (wh.tenantName?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === 'all' || wh.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Webhooks
          </h1>
          <p className="text-gray-500">
            Manage outbound webhook endpoints for events
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">
          <Plus className="h-4 w-4" />
          Add Webhook
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{webhooks.length}</p>
          <p className="text-sm text-gray-500">Total Webhooks</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-green-600">
            {webhooks.filter((w) => w.status === 'active').length}
          </p>
          <p className="text-sm text-gray-500">Active</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-red-600">
            {webhooks.filter((w) => w.status === 'failing').length}
          </p>
          <p className="text-sm text-gray-500">Failing</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">
            {webhooks.filter((w) => w.tenantId === null).length}
          </p>
          <p className="text-sm text-gray-500">Platform-level</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search webhooks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="failing">Failing</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <Filter className="h-4 w-4" />
          More Filters
        </button>
      </div>

      {/* Webhooks Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Webhook
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                URL
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tenant
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Events
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Success Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Triggered
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredWebhooks.map((webhook) => (
              <tr key={webhook.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Webhook className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900">
                      {webhook.name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] truncate">
                  {webhook.url}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {webhook.tenantName || 'Platform'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {webhook.events.length} events
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      statusColors[webhook.status]
                    }`}
                  >
                    {webhook.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {webhook.successRate}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {webhook.lastTriggered
                    ? formatDateTime(webhook.lastTriggered)
                    : '-'}
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

      {filteredWebhooks.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No webhooks found
        </div>
      )}
    </div>
  );
}
