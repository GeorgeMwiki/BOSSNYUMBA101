import React, { useState } from 'react';
import {
  TrendingUp,
  Users,
  Building2,
  CreditCard,
  Calendar,
  Download,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { formatCurrency } from '../../../lib/api';

const growthData = [
  { month: 'Sep', tenants: 92, newTenants: 12, churned: 2, mrr: 2350000 },
  { month: 'Oct', tenants: 98, newTenants: 15, churned: 3, mrr: 2600000 },
  { month: 'Nov', tenants: 104, newTenants: 18, churned: 2, mrr: 2900000 },
  { month: 'Dec', tenants: 110, newTenants: 20, churned: 4, mrr: 3200000 },
  { month: 'Jan', tenants: 118, newTenants: 25, churned: 5, mrr: 3500000 },
  { month: 'Feb', tenants: 125, newTenants: 22, churned: 3, mrr: 3750000 },
];

const planAcquisition = [
  { plan: 'Starter', count: 18, color: '#22c55e' },
  { plan: 'Professional', count: 45, color: '#3b82f6' },
  { plan: 'Enterprise', count: 35, color: '#8b5cf6' },
  { plan: 'Trial', count: 10, color: '#f59e0b' },
];

const topAcquisitionChannels = [
  { channel: 'Referral', tenants: 35 },
  { channel: 'Organic Search', tenants: 28 },
  { channel: 'Direct', tenants: 22 },
  { channel: 'Partner', tenants: 12 },
  { channel: 'Paid', tenants: 8 },
];

export default function AnalyticsGrowthPage() {
  const [dateRange, setDateRange] = useState('last6');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Growth Metrics
          </h1>
          <p className="text-gray-500">
            Tenant acquisition, churn, and revenue growth
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="last6">Last 6 months</option>
            <option value="last12">Last 12 months</option>
            <option value="ytd">Year to date</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm text-green-600">+12%</span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">25</p>
            <p className="text-sm text-gray-500">New Tenants (MTD)</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">vs 22 last month</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-red-100 rounded-lg">
              <Users className="h-5 w-5 text-red-600" />
            </div>
            <span className="text-sm text-red-600">-0.3%</span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">2.1%</p>
            <p className="text-sm text-gray-500">Churn Rate</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">5 churned this month</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-violet-100 rounded-lg">
              <CreditCard className="h-5 w-5 text-violet-600" />
            </div>
            <span className="text-sm text-green-600">+7%</span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(3750000)}
            </p>
            <p className="text-sm text-gray-500">MRR</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">Monthly recurring</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">125</p>
            <p className="text-sm text-gray-500">Total Tenants</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">18 in trial</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Tenant Growth</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData}>
                <defs>
                  <linearGradient id="colorTenants" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip labelStyle={{ color: '#374151' }} />
                <Area
                  type="monotone"
                  dataKey="tenants"
                  name="Total Tenants"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#colorTenants)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Acquisition vs Churn</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip labelStyle={{ color: '#374151' }} />
                <Bar dataKey="newTenants" name="Acquired" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="churned" name="Churned" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">New Tenants by Plan</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planAcquisition}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  dataKey="count"
                  nameKey="plan"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {planAcquisition.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Acquisition Channels</h3>
          <div className="space-y-3">
            {topAcquisitionChannels.map((channel) => (
              <div
                key={channel.channel}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <span className="font-medium text-gray-900">
                  {channel.channel}
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-600 rounded-full"
                      style={{
                        width: `${(channel.tenants / 35) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-8">
                    {channel.tenants}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
