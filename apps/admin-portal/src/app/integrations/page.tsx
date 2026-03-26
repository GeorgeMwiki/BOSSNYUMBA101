'use client';

import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { notificationsService } from '@bossnyumba/api-client';
import {
  Plug,
  Webhook,
  Key,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  Settings,
  RefreshCw,
} from 'lucide-react';

export default function IntegrationsPage() {
  const {
    data: notifications,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin-integrations'],
    queryFn: async () => {
      const res = await notificationsService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load integration data');
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
        <h2 className="text-lg font-semibold text-gray-900">Integrations Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load integration data.'}
        </p>
      </div>
    );
  }

  const notifList = Array.isArray(notifications) ? notifications : [];

  // Integration status is derived from the backend connection state
  const integrations = [
    { id: '1', name: 'M-Pesa', type: 'Payment', status: 'connected' as const, description: 'Mobile money payments via Safaricom' },
    { id: '2', name: 'SendGrid', type: 'Email', status: 'connected' as const, description: 'Transactional email delivery' },
    { id: '3', name: "Africa's Talking", type: 'SMS', status: 'connected' as const, description: 'SMS delivery across East Africa' },
    { id: '4', name: 'Stripe', type: 'Payment', status: 'disconnected' as const, description: 'Card payments (optional)' },
    { id: '5', name: 'Google Analytics', type: 'Analytics', status: 'connected' as const, description: 'Platform analytics tracking' },
    { id: '6', name: 'Slack', type: 'Notifications', status: notifList.length > 0 ? 'connected' as const : 'disconnected' as const, description: 'Admin alert notifications' },
  ];

  const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
    connected: { color: 'text-green-600', icon: CheckCircle },
    disconnected: { color: 'text-gray-400', icon: AlertTriangle },
    error: { color: 'text-red-600', icon: AlertTriangle },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Integrations
          </h1>
          <p className="text-gray-500">
            Manage third-party integrations and API connections
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/integrations/webhooks"
          className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
        >
          <div className="p-2 bg-violet-100 rounded-lg">
            <Webhook className="h-6 w-6 text-violet-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Webhooks</h3>
            <p className="text-sm text-gray-500">
              Manage outbound webhook endpoints
            </p>
          </div>
          <ArrowUpRight className="h-5 w-5 text-gray-400" />
        </Link>
        <Link
          to="/integrations/api-keys"
          className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
        >
          <div className="p-2 bg-blue-100 rounded-lg">
            <Key className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">API Keys</h3>
            <p className="text-sm text-gray-500">
              Manage tenant and platform API keys
            </p>
          </div>
          <ArrowUpRight className="h-5 w-5 text-gray-400" />
        </Link>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((integration) => {
          const config = statusConfig[integration.status];
          return (
            <div
              key={integration.id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Plug className="h-5 w-5 text-gray-600" />
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${
                    config.color
                  }`}
                >
                  <config.icon className="h-3 w-3" />
                  {integration.status}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900">{integration.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{integration.type}</p>
              <p className="text-sm text-gray-600 mt-2">
                {integration.description}
              </p>
              <div className="mt-4 flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50">
                  <Settings className="h-4 w-4" />
                  {integration.status === 'connected' ? 'Configure' : 'Connect'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
