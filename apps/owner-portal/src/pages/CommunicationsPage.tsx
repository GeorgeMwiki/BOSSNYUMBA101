import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import {
  Send,
  FileText,
  ArrowUpRight,
  BarChart3,
} from 'lucide-react';

/**
 * CommunicationsPage — owner-portal hub for owner→tenant comms.
 *
 * Acts as a navigation surface only. Aggregate stats (emails sent,
 * SMS volume, active campaigns, recent broadcast list) used to be
 * rendered from hardcoded sample arrays; that was dishonest and has
 * been removed. Reintroduce when the gateway exposes real comms
 * counters and a `/owner/messaging/broadcasts` listing.
 */
export default function CommunicationsPage() {
  const t = useTranslations('communicationsPage');
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

      {/* Quick Actions — link out to the real subpages where the live
          data lives. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/communications/templates"
          className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
        >
          <div className="p-2 bg-violet-100 rounded-lg">
            <FileText className="h-6 w-6 text-violet-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{t('nav.templates')}</h3>
            <p className="text-sm text-gray-500">
              {t('nav.templatesDesc')}
            </p>
          </div>
          <ArrowUpRight className="h-5 w-5 text-gray-400" />
        </Link>
        <Link
          to="/communications/campaigns"
          className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
        >
          <div className="p-2 bg-blue-100 rounded-lg">
            <BarChart3 className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{t('nav.campaigns')}</h3>
            <p className="text-sm text-gray-500">
              {t('nav.campaignsDesc')}
            </p>
          </div>
          <ArrowUpRight className="h-5 w-5 text-gray-400" />
        </Link>
        <Link
          to="/communications/broadcasts"
          className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
        >
          <div className="p-2 bg-green-100 rounded-lg">
            <Send className="h-6 w-6 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{t('nav.broadcasts')}</h3>
            <p className="text-sm text-gray-500">
              {t('nav.broadcastsDesc')}
            </p>
          </div>
          <ArrowUpRight className="h-5 w-5 text-gray-400" />
        </Link>
      </div>
    </div>
  );
}
