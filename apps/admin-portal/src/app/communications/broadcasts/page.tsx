'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { messagingService, notificationsService } from '@bossnyumba/api-client';
import {
  Send,
  RefreshCw,
  AlertTriangle,
  Search,
  Mail,
  MessageSquare,
  Plus,
} from 'lucide-react';
import { useState } from 'react';

export default function CommunicationsBroadcastsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: messages,
    isLoading: loadingMessages,
    error: messagesError,
  } = useQuery({
    queryKey: ['admin-broadcasts-messages'],
    queryFn: async () => {
      const res = await messagingService.listConversations();
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load broadcasts');
    },
    staleTime: 30_000,
  });

  const {
    data: notifications,
    isLoading: loadingNotif,
    error: notifError,
  } = useQuery({
    queryKey: ['admin-broadcasts-notifications'],
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
        <h2 className="text-lg font-semibold text-gray-900">Broadcasts Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load broadcast data.'}
        </p>
      </div>
    );
  }

  const messageList = Array.isArray(messages) ? messages : [];
  const notifList = Array.isArray(notifications) ? notifications : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Broadcasts</h1>
          <p className="text-sm text-gray-500 mt-1">System-wide broadcast messaging</p>
        </div>
        <button
          onClick={() => navigate('/communications/broadcasts/new')}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />
          New Broadcast
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-violet-100 rounded-lg w-fit">
            <Send className="h-5 w-5 text-violet-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{messageList.length}</p>
            <p className="text-sm text-gray-500">Total Messages</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-blue-100 rounded-lg w-fit">
            <Mail className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{notifList.length}</p>
            <p className="text-sm text-gray-500">Notifications Sent</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-green-100 rounded-lg w-fit">
            <MessageSquare className="h-5 w-5 text-green-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">--</p>
            <p className="text-sm text-gray-500">Active Campaigns</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search broadcasts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
        />
      </div>

      {/* Messages Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Recent Broadcasts</h3>
        </div>
        {messageList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No broadcasts found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {messageList.slice(0, 10).map((msg: any) => (
                <tr key={msg.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {msg.subject || msg.title || msg.id}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {msg.channel || msg.type || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      msg.status === 'SENT' || msg.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                      msg.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {msg.status || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
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
