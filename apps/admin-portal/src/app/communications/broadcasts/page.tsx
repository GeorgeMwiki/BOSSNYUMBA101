/**
 * BroadcastsPage — outbound broadcast campaigns.
 *
 * Assumed backend endpoints:
 *   GET  /communications/broadcasts?status=<any|draft|scheduled|sending|sent|failed>&channel=<any|email|sms|push|in_app>
 *        -> { data: { items: Broadcast[], total: number } }
 *   POST /communications/broadcasts/:id/cancel
 *
 * The api client normalizes responses to { success, data }.
 */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Megaphone,
  RefreshCw,
} from 'lucide-react';
import { api, formatDateTime } from '../../../lib/api';

type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
type Channel = 'email' | 'sms' | 'push' | 'in_app';

interface Broadcast {
  id: string;
  title: string;
  channel: Channel;
  status: BroadcastStatus;
  recipients: number;
  delivered: number;
  failed: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdBy: string;
}

interface BroadcastsResponse {
  items: Broadcast[];
  total: number;
}

const statusBadge: Record<BroadcastStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  sending: 'bg-amber-100 text-amber-700',
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const channelBadge: Record<Channel, string> = {
  email: 'bg-violet-100 text-violet-700',
  sms: 'bg-indigo-100 text-indigo-700',
  push: 'bg-emerald-100 text-emerald-700',
  in_app: 'bg-amber-100 text-amber-700',
};

export default function BroadcastsPage() {
  const [items, setItems] = useState<Broadcast[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'any' | BroadcastStatus>('any');
  const [channelFilter, setChannelFilter] = useState<'any' | Channel>('any');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const fetchBroadcasts = useCallback(() => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ status: statusFilter, channel: channelFilter });
    api
      .get<BroadcastsResponse>(`/communications/broadcasts?${qs.toString()}`)
      .then((res) => {
        if (res.success && res.data) {
          setItems(res.data.items);
          setTotal(res.data.total);
        } else {
          setError(res.error ?? 'Failed to load broadcasts.');
          setItems([]);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [statusFilter, channelFilter]);

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  const handleCancel = async (b: Broadcast) => {
    if (!window.confirm(`Cancel broadcast "${b.title}"?`)) return;
    setCancelingId(b.id);
    const res = await api.post(`/communications/broadcasts/${b.id}/cancel`, {});
    setCancelingId(null);
    if (res.success) {
      fetchBroadcasts();
    } else {
      setError(res.error ?? 'Failed to cancel broadcast.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Broadcasts</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total.toLocaleString()} broadcast{total === 1 ? '' : 's'} matching current filters.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchBroadcasts}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          aria-label="Refresh broadcasts"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'any' | BroadcastStatus)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="any">Any status</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="sending">Sending</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value as 'any' | Channel)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="any">Any channel</option>
          <option value="email">Email</option>
          <option value="sms">SMS</option>
          <option value="push">Push</option>
          <option value="in_app">In-app</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 bg-white rounded-xl border border-gray-200">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <p className="text-gray-600">{error}</p>
          <button
            type="button"
            onClick={fetchBroadcasts}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white rounded-xl border border-gray-200">
          <Megaphone className="h-10 w-10 text-gray-300" />
          <p className="text-gray-500">No broadcasts match the current filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Channel</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Recipients</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Delivered</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Failed</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Scheduled / Sent</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{b.title}</div>
                    <div className="text-xs text-gray-500">by {b.createdBy}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full uppercase ${channelBadge[b.channel]}`}>
                      {b.channel.replace('_', '-')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${statusBadge[b.status]}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{b.recipients.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-green-600">{b.delivered.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm">
                    <span className={b.failed > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                      {b.failed.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {b.sentAt
                      ? formatDateTime(b.sentAt)
                      : b.scheduledAt
                      ? formatDateTime(b.scheduledAt)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleCancel(b)}
                      disabled={
                        cancelingId === b.id ||
                        b.status === 'sent' ||
                        b.status === 'failed'
                      }
                      className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700 disabled:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-2 py-1"
                    >
                      <Ban className="h-4 w-4" />
                      {cancelingId === b.id ? 'Canceling...' : 'Cancel'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
