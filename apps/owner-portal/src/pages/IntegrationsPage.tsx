import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { Webhook, Key, ArrowUpRight } from 'lucide-react';

/**
 * IntegrationsPage — owner-portal hub for third-party integrations.
 *
 * Acts as a navigation surface only. The previous implementation
 * rendered a hand-built integrations grid (M-Pesa, SendGrid, Stripe…)
 * with hardcoded `connected` / `disconnected` statuses and made-up
 * `lastSync` timestamps. None of that data was real, and the Connect /
 * Configure buttons did nothing. The grid has been removed; reintroduce
 * once the gateway exposes a real
 * `GET /integrations` listing with live status and sync metadata.
 */
export default function IntegrationsPage() {
  const t = useTranslations('integrationsPage');
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
      </div>

      {/* Quick Links — link out to the real subpages where live data lives. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/integrations/webhooks"
          className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
        >
          <div className="p-2 bg-violet-100 rounded-lg">
            <Webhook className="h-6 w-6 text-violet-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{t('webhooksTitle')}</h3>
            <p className="text-sm text-gray-500">
              {t('webhooksDesc')}
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
            <h3 className="font-semibold text-gray-900">{t('apiKeysTitle')}</h3>
            <p className="text-sm text-gray-500">
              {t('apiKeysDesc')}
            </p>
          </div>
          <ArrowUpRight className="h-5 w-5 text-gray-400" />
        </Link>
      </div>
    </div>
  );
}
