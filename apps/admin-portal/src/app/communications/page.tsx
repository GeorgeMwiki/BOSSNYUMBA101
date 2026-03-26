'use client';

import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { messagingService, notificationsService } from '@bossnyumba/api-client';
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
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

export default function CommunicationsPage() {
  const {
    data: messages,
    isLoading: loadingMessages,
    error: messagesError,
  } = useQuery({
    queryKey: ['admin-comms-messages'],
    queryFn: async () => {
      const res = await messagingService.listConversations();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load conversations');
    },
    staleTime: 30_000,
  });

  const {
    data: notifications,
    isLoading: loadingNotif,
    error: notifError,
  } = useQuery({
    queryKey: ['admin-comms-notifications'],
    queryFn: async () => {
      const res = await notificationsService.list();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load notifications');
    },
    staleTime: 30_000,
  });

  const isLoading = loadingMessages || loadingNotif;
  const error = messagesError || notifError;

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
        <h2 className="text-lg font-semibold text-gray-900">Communications Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load communications data.'}
        </p>
      </div>
    );
  }

  const messageList = Array.isArray(messages) ? messages : [];
  const notifList = Array.isArray(notifications) ? notifications : [];

  const stats = [
    {
      label: 'Messages',
      value: messageList.length.toLocaleString(),
      change: 'Total',
      icon: Mail,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      label: 'Notifications',
      value: notifList.length.toLocaleString(),
      change: 'Total',
      icon: MessageSquare,
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    {
      label: 'Active Campaigns',
      value: '--',
      change: 'Live data',
      icon: Send,
      color: 'text-violet-600',
      bg: 'bg-violet-100',
    },
    {
      label: 'Templates',
      value: '--',
      change: 'Email + SMS',
      icon: FileText,
      color: 'text-amber-600',
      bg: 'bg-amber-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Communication Dashboard
          </h1>
          <p className="text-gray-500">
            Marketing campaigns, templates, and broadcasts
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
            <h3 className="font-semibold text-gray-900">Templates</h3>
            <p className="text-sm text-gray-500">
              Email and SMS templates
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
            <h3 className="font-semibold text-gray-900">Campaigns</h3>
            <p className="text-sm text-gray-500">
              Marketing campaigns
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
            <h3 className="font-semibold text-gray-900">Broadcasts</h3>
            <p className="text-sm text-gray-500">
              System-wide broadcasts
            </p>
          </div>
          <ArrowUpRight className="h-5 w-5 text-gray-400" />
        </Link>
      </div>

      {/* Recent Messages */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Recent Messages</h3>
          <Link
            to="/communications/broadcasts"
            className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1"
          >
            View all
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        {messageList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No recent messages</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Message
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Channel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sent
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {messageList.slice(0, 5).map((msg: any) => (
                <tr key={msg.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    {msg.subject || msg.title || msg.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
                      {(msg.channel || msg.type || 'email').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {msg.status || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
