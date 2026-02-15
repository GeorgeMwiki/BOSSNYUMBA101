import React, { useState } from 'react';
import {
  BarChart3,
  Plus,
  Search,
  Filter,
  Play,
  Pause,
  MoreVertical,
  Users,
  Mail,
  CheckCircle,
  Clock,
} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused';
  channel: 'email' | 'sms' | 'both';
  targetAudience: string;
  sentCount: number;
  openRate: number;
  clickRate: number;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const campaigns: Campaign[] = [
  {
    id: '1',
    name: 'Q1 Rent Reminder Campaign',
    status: 'running',
    channel: 'email',
    targetAudience: 'All tenants with rent due',
    sentCount: 2450,
    openRate: 68,
    clickRate: 12,
    scheduledAt: null,
    completedAt: null,
    createdAt: '2025-01-28',
  },
  {
    id: '2',
    name: 'New Feature Announcement',
    status: 'scheduled',
    channel: 'email',
    targetAudience: 'Property managers',
    sentCount: 0,
    openRate: 0,
    clickRate: 0,
    scheduledAt: '2025-02-15T09:00:00',
    completedAt: null,
    createdAt: '2025-02-01',
  },
  {
    id: '3',
    name: 'Maintenance SMS Blast',
    status: 'completed',
    channel: 'sms',
    targetAudience: 'Westlands residents',
    sentCount: 156,
    openRate: 94,
    clickRate: 0,
    scheduledAt: null,
    completedAt: '2025-01-25',
    createdAt: '2025-01-24',
  },
  {
    id: '4',
    name: 'Lease Renewal Promo',
    status: 'draft',
    channel: 'both',
    targetAudience: 'Expiring leases (60 days)',
    sentCount: 0,
    openRate: 0,
    clickRate: 0,
    scheduledAt: null,
    completedAt: null,
    createdAt: '2025-02-05',
  },
  {
    id: '5',
    name: 'Payment Success Thank You',
    status: 'paused',
    channel: 'email',
    targetAudience: 'All paying tenants',
    sentCount: 890,
    openRate: 72,
    clickRate: 8,
    scheduledAt: null,
    completedAt: null,
    createdAt: '2025-01-20',
  },
];

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  running: 'bg-green-100 text-green-700',
  completed: 'bg-violet-100 text-violet-700',
  paused: 'bg-amber-100 text-amber-700',
};

export default function CommunicationsCampaignsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Marketing Campaigns
          </h1>
          <p className="text-gray-500">
            Create and manage email/SMS campaigns
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">
          <Plus className="h-4 w-4" />
          New Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{campaigns.length}</p>
          <p className="text-sm text-gray-500">Total Campaigns</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-green-600">
            {campaigns.filter((c) => c.status === 'running').length}
          </p>
          <p className="text-sm text-gray-500">Running</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-blue-600">
            {campaigns.filter((c) => c.status === 'scheduled').length}
          </p>
          <p className="text-sm text-gray-500">Scheduled</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">
            {campaigns.filter((c) => c.status === 'completed').length}
          </p>
          <p className="text-sm text-gray-500">Completed</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
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
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="paused">Paused</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <Filter className="h-4 w-4" />
          More Filters
        </button>
      </div>

      {/* Campaigns Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Campaign
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Channel
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sent
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Open Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Click Rate
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredCampaigns.map((campaign) => (
              <tr key={campaign.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{campaign.name}</p>
                    <p className="text-sm text-gray-500 truncate max-w-xs">
                      {campaign.targetAudience}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      statusColors[campaign.status]
                    }`}
                  >
                    {campaign.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="capitalize">{campaign.channel}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {campaign.sentCount.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {campaign.openRate}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {campaign.clickRate}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-2">
                    {campaign.status === 'draft' && (
                      <button className="p-2 text-green-600 hover:bg-green-50 rounded-lg">
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    {campaign.status === 'running' && (
                      <button className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg">
                        <Pause className="h-4 w-4" />
                      </button>
                    )}
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

      {filteredCampaigns.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No campaigns found
        </div>
      )}
    </div>
  );
}
