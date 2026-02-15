import React from 'react';
import { Link } from 'react-router-dom';
import {
  Plug,
  Webhook,
  Key,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  Settings,
} from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'disconnected' | 'error';
  description: string;
  lastSync: string | null;
}

const integrations: Integration[] = [
  {
    id: '1',
    name: 'M-Pesa',
    type: 'Payment',
    status: 'connected',
    description: 'Mobile money payments via Safaricom',
    lastSync: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'SendGrid',
    type: 'Email',
    status: 'connected',
    description: 'Transactional email delivery',
    lastSync: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Africa\'s Talking',
    type: 'SMS',
    status: 'connected',
    description: 'SMS delivery across East Africa',
    lastSync: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '4',
    name: 'Stripe',
    type: 'Payment',
    status: 'disconnected',
    description: 'Card payments (optional)',
    lastSync: null,
  },
  {
    id: '5',
    name: 'Google Analytics',
    type: 'Analytics',
    status: 'connected',
    description: 'Platform analytics tracking',
    lastSync: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '6',
    name: 'Slack',
    type: 'Notifications',
    status: 'disconnected',
    description: 'Admin alert notifications',
    lastSync: null,
  },
];

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
  connected: { color: 'text-green-600', icon: CheckCircle },
  disconnected: { color: 'text-gray-400', icon: AlertTriangle },
  error: { color: 'text-red-600', icon: AlertTriangle },
};

export default function IntegrationsPage() {
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
              {integration.lastSync && (
                <p className="text-xs text-gray-400 mt-3">
                  Last sync: {new Date(integration.lastSync).toLocaleString()}
                </p>
              )}
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
