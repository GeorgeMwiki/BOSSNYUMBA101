import React from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  Activity,
  ArrowUpRight,
  CheckCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '../../../lib/api';

const revenueData = [
  { month: 'Aug', value: 2100000 },
  { month: 'Sep', value: 2350000 },
  { month: 'Oct', value: 2600000 },
  { month: 'Nov', value: 2900000 },
  { month: 'Dec', value: 3200000 },
  { month: 'Jan', value: 3500000 },
];

const tenantGrowthData = [
  { month: 'Aug', active: 85, trial: 12 },
  { month: 'Sep', active: 92, trial: 15 },
  { month: 'Oct', active: 98, trial: 18 },
  { month: 'Nov', active: 104, trial: 14 },
  { month: 'Dec', active: 110, trial: 12 },
  { month: 'Jan', active: 118, trial: 10 },
];

export default function PlatformOverviewPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>
          <p className="text-gray-500">KPIs, active tenants, and revenue metrics</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Building2 className="h-5 w-5 text-violet-600" />
            </div>
            <span className="flex items-center gap-1 text-sm text-green-600">
              <TrendingUp className="h-4 w-4" />
              +12%
            </span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">118</p>
            <p className="text-sm text-gray-500">Active Tenants</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">104 paying, 14 trial</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">1,247</p>
            <p className="text-sm text-gray-500">Platform Users</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">Across all tenants</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-green-100 rounded-lg">
              <CreditCard className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(3750000)}
            </p>
            <p className="text-sm text-gray-500">Monthly Revenue</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">MRR from subscriptions</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Activity className="h-5 w-5 text-amber-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">4,536</p>
            <p className="text-sm text-gray-500">Units Managed</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">892 properties</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Revenue Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorPlatformRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={12}
                  tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ color: '#374151' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#colorPlatformRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Tenant Growth</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tenantGrowthData}>
                <defs>
                  <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorTrial" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip labelStyle={{ color: '#374151' }} />
                <Area
                  type="monotone"
                  dataKey="active"
                  name="Active"
                  stroke="#8b5cf6"
                  fill="url(#colorActive)"
                />
                <Area
                  type="monotone"
                  dataKey="trial"
                  name="Trial"
                  stroke="#3b82f6"
                  fill="url(#colorTrial)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/platform/subscriptions"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
          >
            <CheckCircle className="h-5 w-5 text-violet-600" />
            <span className="text-sm font-medium text-gray-700">
              Subscriptions
            </span>
            <ArrowUpRight className="h-4 w-4 text-gray-400 ml-auto" />
          </Link>
          <Link
            to="/platform/billing"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
          >
            <CreditCard className="h-5 w-5 text-violet-600" />
            <span className="text-sm font-medium text-gray-700">Billing</span>
            <ArrowUpRight className="h-4 w-4 text-gray-400 ml-auto" />
          </Link>
          <Link
            to="/platform/feature-flags"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
          >
            <Activity className="h-5 w-5 text-violet-600" />
            <span className="text-sm font-medium text-gray-700">
              Feature Flags
            </span>
            <ArrowUpRight className="h-4 w-4 text-gray-400 ml-auto" />
          </Link>
          <Link
            to="/tenants"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
          >
            <Building2 className="h-5 w-5 text-violet-600" />
            <span className="text-sm font-medium text-gray-700">
              View Tenants
            </span>
            <ArrowUpRight className="h-4 w-4 text-gray-400 ml-auto" />
          </Link>
        </div>
      </div>
    </div>
  );
}
