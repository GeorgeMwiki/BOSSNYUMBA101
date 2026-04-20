import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import {
  Mail,
  MessageSquare,
  Send,
  FileText,
  TrendingUp,
  Users,
  ArrowUpRight,
  CheckCircle,
  Clock,
  BarChart3,
} from 'lucide-react';

function buildStats(t: (k: string) => string) {
  return [
    { label: t('stats.emails'), value: '12,450', change: '+8%', icon: Mail, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: t('stats.sms'), value: '8,230', change: '+12%', icon: MessageSquare, color: 'text-green-600', bg: 'bg-green-100' },
    { label: t('stats.activeCampaigns'), value: '5', change: t('stats.twoRunning'), icon: Send, color: 'text-violet-600', bg: 'bg-violet-100' },
    { label: t('stats.templates'), value: '24', change: t('stats.emailSms'), icon: FileText, color: 'text-amber-600', bg: 'bg-amber-100' },
  ];
}

function buildRecentBroadcasts(t: (k: string) => string) {
  return [
    { id: '1', title: t('broadcasts.rentReminder'), channel: 'email', sentAt: new Date(Date.now() - 3600000).toISOString(), recipients: 1240, openRate: 68 },
    { id: '2', title: t('broadcasts.maintenanceNotice'), channel: 'sms', sentAt: new Date(Date.now() - 86400000).toISOString(), recipients: 156, openRate: 94 },
    { id: '3', title: t('broadcasts.paymentSuccess'), channel: 'email', sentAt: new Date(Date.now() - 172800000).toISOString(), recipients: 890, openRate: 72 },
  ];
}

export default function CommunicationsPage() {
  const t = useTranslations('communicationsPage');
  const stats = buildStats(t);
  const recentBroadcasts = buildRecentBroadcasts(t);
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <div className="flex items-center justify-between">
              <div className={`p-2 ${stat.bg} rounded-lg`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <span className="text-sm text-gray-500">{stat.change}</span>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
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

      {/* Recent Broadcasts */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{t('recentBroadcasts')}</h3>
          <Link
            to="/communications/broadcasts"
            className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1"
          >
            {t('viewAll')}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('cols.broadcast')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('cols.channel')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('cols.recipients')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('cols.openRate')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('cols.sent')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {recentBroadcasts.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                  {b.title}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      b.channel === 'email'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {b.channel.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {b.recipients.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {b.openRate}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(b.sentAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
