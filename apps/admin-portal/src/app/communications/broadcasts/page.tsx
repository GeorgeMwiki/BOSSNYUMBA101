import React, { useState } from 'react';
import { Radio, Plus, Search, Send, Clock, CheckCircle, Users, Building2 } from 'lucide-react';

interface Broadcast {
  id: string;
  title: string;
  message: string;
  channel: 'sms' | 'email' | 'push' | 'all';
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  audience: string;
  recipients: number;
  sentAt?: string;
  scheduledAt?: string;
  createdBy: string;
}

const mockBroadcasts: Broadcast[] = [
  { id: '1', title: 'System Maintenance Notice', message: 'Scheduled maintenance on Sunday 2AM-4AM EAT', channel: 'all', status: 'sent', audience: 'All Tenants', recipients: 1247, sentAt: '2026-02-12T08:00:00Z', createdBy: 'admin@bossnyumba.com' },
  { id: '2', title: 'New Feature: E-Signatures', message: 'We are excited to announce electronic signature support...', channel: 'email', status: 'scheduled', audience: 'Enterprise Tenants', recipients: 450, scheduledAt: '2026-02-15T09:00:00Z', createdBy: 'admin@bossnyumba.com' },
  { id: '3', title: 'Payment Reminder', message: 'Reminder: Subscription payments due by Feb 15', channel: 'sms', status: 'draft', audience: 'Pending Payment', recipients: 23, createdBy: 'admin@bossnyumba.com' },
];

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const channelColors: Record<string, string> = {
  sms: 'bg-amber-100 text-amber-700',
  email: 'bg-blue-100 text-blue-700',
  push: 'bg-violet-100 text-violet-700',
  all: 'bg-green-100 text-green-700',
};

export default function CommunicationsBroadcastsPage() {
  const [search, setSearch] = useState('');

  const filtered = mockBroadcasts.filter((b) => b.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Broadcasts</h1>
          <p className="text-sm text-gray-500 mt-1">Send messages to tenants and users</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">
          <Plus className="h-4 w-4" />
          New Broadcast
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-green-600 mb-2"><CheckCircle className="h-4 w-4" /><span className="text-sm font-medium">Sent</span></div>
          <p className="text-2xl font-bold text-gray-900">{mockBroadcasts.filter((b) => b.status === 'sent').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-2"><Clock className="h-4 w-4" /><span className="text-sm font-medium">Scheduled</span></div>
          <p className="text-2xl font-bold text-gray-900">{mockBroadcasts.filter((b) => b.status === 'scheduled').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-600 mb-2"><Users className="h-4 w-4" /><span className="text-sm font-medium">Total Recipients</span></div>
          <p className="text-2xl font-bold text-gray-900">{mockBroadcasts.reduce((s, b) => s + b.recipients, 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" placeholder="Search broadcasts..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
      </div>

      <div className="space-y-3">
        {filtered.map((broadcast) => (
          <div key={broadcast.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{broadcast.title}</h3>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[broadcast.status]}`}>{broadcast.status}</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${channelColors[broadcast.channel]}`}>{broadcast.channel.toUpperCase()}</span>
                </div>
                <p className="text-sm text-gray-500 mb-2">{broadcast.message}</p>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{broadcast.recipients} recipients</span>
                  <span>{broadcast.audience}</span>
                  {broadcast.sentAt && <span>Sent {new Date(broadcast.sentAt).toLocaleDateString()}</span>}
                  {broadcast.scheduledAt && <span>Scheduled {new Date(broadcast.scheduledAt).toLocaleDateString()}</span>}
                </div>
              </div>
              {broadcast.status === 'draft' && (
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50">
                  <Send className="h-4 w-4" />
                  Send
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
