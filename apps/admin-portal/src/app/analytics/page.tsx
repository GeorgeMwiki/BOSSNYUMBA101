import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  TrendingUp,
  Users,
  Activity,
  ArrowUpRight,
  Download,
  Calendar,
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

const usageData = [
  { date: 'Feb 7', logins: 892, apiCalls: 12500 },
  { date: 'Feb 8', logins: 945, apiCalls: 13200 },
  { date: 'Feb 9', logins: 878, apiCalls: 11800 },
  { date: 'Feb 10', logins: 1023, apiCalls: 14500 },
  { date: 'Feb 11', logins: 967, apiCalls: 12900 },
  { date: 'Feb 12', logins: 1105, apiCalls: 15600 },
];

const featureUsage = [
  { name: 'Property Mgmt', value: 35, color: '#8b5cf6' },
  { name: 'Payments', value: 28, color: '#3b82f6' },
  { name: 'Reports', value: 18, color: '#22c55e' },
  { name: 'Tenant Portal', value: 12, color: '#f59e0b' },
  { name: 'Other', value: 7, color: '#94a3b8' },
];

const topTenants = [
  { name: 'Acme Properties Ltd', activeUsers: 28, apiCalls: 4520 },
  { name: 'Highland Properties', activeUsers: 15, apiCalls: 2890 },
  { name: 'Sunrise Realty', activeUsers: 8, apiCalls: 1560 },
  { name: 'Metro Housing', activeUsers: 5, apiCalls: 780 },
  { name: 'Coastal Estates', activeUsers: 4, apiCalls: 620 },
];

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('last7');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Analytics Dashboard
          </h1>
          <p className="text-gray-500">
            Platform-wide metrics and insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="last7">Last 7 days</option>
            <option value="last30">Last 30 days</option>
            <option value="last90">Last 90 days</option>
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
            <div className="p-2 bg-violet-100 rounded-lg">
              <Users className="h-5 w-5 text-violet-600" />
            </div>
            <span className="text-sm text-green-600">+12%</span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">5,810</p>
            <p className="text-sm text-gray-500">Daily Active Users</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">7-day average</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm text-green-600">+8%</span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">92,450</p>
            <p className="text-sm text-gray-500">API Calls (7d)</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">Requests across platform</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">68%</p>
            <p className="text-sm text-gray-500">Avg. Session Duration</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">5m 24s per session</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-amber-100 rounded-lg">
              <BarChart3 className="h-5 w-5 text-amber-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">94%</p>
            <p className="text-sm text-gray-500">Feature Adoption</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">Core features used</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Daily Activity</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip labelStyle={{ color: '#374151' }} />
                <Bar dataKey="logins" name="Logins" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="apiCalls" name="API Calls" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Feature Usage</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={featureUsage}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {featureUsage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick Links & Top Tenants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Links</h3>
          <div className="space-y-3">
            <Link
              to="/analytics/usage"
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
            >
              <span className="font-medium text-gray-700">Feature Usage</span>
              <ArrowUpRight className="h-4 w-4 text-gray-400" />
            </Link>
            <Link
              to="/analytics/growth"
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
            >
              <span className="font-medium text-gray-700">Growth Metrics</span>
              <ArrowUpRight className="h-4 w-4 text-gray-400" />
            </Link>
            <Link
              to="/analytics/exports"
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
            >
              <span className="font-medium text-gray-700">Export Data</span>
              <ArrowUpRight className="h-4 w-4 text-gray-400" />
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Top Tenants by Usage</h3>
          <div className="space-y-3">
            {topTenants.map((tenant, index) => (
              <div
                key={tenant.name}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                    {index + 1}
                  </span>
                  <span className="font-medium text-gray-900">{tenant.name}</span>
                </div>
                <div className="text-sm text-gray-500">
                  {tenant.activeUsers} users • {tenant.apiCalls.toLocaleString()} API calls
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
