import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Webhook,
  Plus,
  Search,
  MoreVertical,
  Copy,
} from 'lucide-react';
import { EmptyState, Skeleton, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { api, formatDateTime } from '../../../lib/api';

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

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-700',
  failing: 'bg-red-100 text-red-700',
};

export default function IntegrationsWebhooksPage() {
  const t = useTranslations('webhooks');
  const tCommon = useTranslations('common');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [webhooks, setWebhooks] = useState<ReadonlyArray<WebhookConfig>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ReadonlyArray<WebhookConfig>>('/admin/webhooks');
      if (res.success) {
        setWebhooks(res.data ?? []);
      } else {
        setError(res.error ?? t('errorLoad'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorLoad'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
            {t('title')}
          </h1>
          <p className="text-gray-500">
            {t('subtitle')}
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">
          <Plus className="h-4 w-4" />
          {t('addWebhook')}
        </button>
      </div>

      {error && (
        <Alert variant="danger">
          <AlertDescription>
            {error}
            <Button size="sm" variant="link" onClick={() => void load()} className="ml-2">
              {tCommon('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="space-y-3" aria-busy="true" aria-live="polite">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{webhooks.length}</p>
          <p className="text-sm text-gray-500">{t('totalWebhooks')}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-green-600">
            {webhooks.filter((w) => w.status === 'active').length}
          </p>
          <p className="text-sm text-gray-500">{t('active')}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-red-600">
            {webhooks.filter((w) => w.status === 'failing').length}
          </p>
          <p className="text-sm text-gray-500">{t('failing')}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">
            {webhooks.filter((w) => w.tenantId === null).length}
          </p>
          <p className="text-sm text-gray-500">{t('platformLevel')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchWebhooks')}
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
          <option value="all">{t('allStatus')}</option>
          <option value="active">{t('active')}</option>
          <option value="inactive">{t('inactive')}</option>
          <option value="failing">{t('failing')}</option>
        </select>
        {/* "More Filters" button removed; status select is the only
            honest filter dimension currently. */}
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
        <EmptyState
          icon={<Webhook className="h-8 w-8" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      )}
    </div>
  );
}
