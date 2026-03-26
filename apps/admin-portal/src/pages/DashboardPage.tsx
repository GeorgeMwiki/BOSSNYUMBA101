import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Users,
  CreditCard,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
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
import { api, formatCurrency } from '../lib/api';

interface DashboardData {
  kpis: {
    totalTenants: number;
    activeTenants: number;
    totalUsers: number;
    totalProperties: number;
    totalUnits: number;
    monthlyRevenue: number;
    growthRate: number;
  };
  revenueTrend: Array<{
    month: string;
    value: number;
  }>;
  tenantGrowth: Array<{
    month: string;
    tenants: number;
  }>;
  statusDistribution: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    user: string;
  }>;
  alerts: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    timestamp: string;
  }>;
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardData>('/dashboard/admin')
      .then((response) => {
        if (response.success && response.data) {
          setData(response.data);
          setError(null);
        } else {
          setData(null);
          const responseError = (response as { error?: unknown }).error;
          setError(
            typeof responseError === 'string'
              ? responseError
              : (responseError as { message?: string } | undefined)?.message ??
                  'Live admin dashboard data is unavailable.'
          );
        }
        setLoading(false);
      })
      .catch((err: Error) => {
        setData(null);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-9 w-9 bg-gray-200 rounded-lg" />
                <div className="h-4 bg-gray-200 rounded w-14" />
              </div>
              <div className="h-7 bg-gray-200 rounded w-20 mt-4" />
              <div className="h-3 bg-gray-200 rounded w-24" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1,2].map(i => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <div className="h-5 bg-gray-200 rounded w-32" />
              <div className="h-64 bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
            <div className="h-5 bg-gray-200 rounded w-40" />
            <div className="h-48 bg-gray-100 rounded-lg" />
          </div>
          <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-5 space-y-3">
            <div className="h-5 bg-gray-200 rounded w-32" />
            {[1,2,3,4].map(i => (
              <div key={i} className="flex items-center gap-3 py-3">
                <div className="w-8 h-8 bg-gray-200 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="p-4 bg-amber-50 rounded-full">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Dashboard Unavailable</h2>
        <p className="text-sm text-gray-500 max-w-md text-center">{error ?? 'Live admin dashboard data is unavailable. Please check your connection and try again.'}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700"
        >
          <Activity className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  const {
    kpis,
    alerts,
    recentActivity,
    revenueTrend,
    tenantGrowth,
    statusDistribution,
  } = data;

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                alert.severity === 'critical'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : alert.severity === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm flex-1">{alert.message}</span>
              <button className="text-sm font-medium hover:underline">
                View
              </button>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Building2 className="h-5 w-5 text-violet-600" />
            </div>
            <span className="flex items-center gap-1 text-sm text-green-600">
              <TrendingUp className="h-4 w-4" />
              +{kpis.growthRate}%
            </span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">
              {kpis.totalTenants}
            </p>
            <p className="text-sm text-gray-500">Total Tenants</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            {kpis.activeTenants} active
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{kpis.totalUsers}</p>
            <p className="text-sm text-gray-500">Total Users</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Across all tenants
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-green-100 rounded-lg">
              <CreditCard className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(kpis.monthlyRevenue)}
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
            <p className="text-2xl font-bold text-gray-900">
              {kpis.totalUnits.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500">Units Managed</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            {kpis.totalProperties} properties
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Revenue Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Tenant Growth</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tenantGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip labelStyle={{ color: '#374151' }} />
                <Bar dataKey="tenants" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tenant Status Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            Tenant Status Distribution
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusDistribution}
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
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Recent Activity</h3>
            <Link
              to="/audit"
              className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1"
            >
              View all
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0"
              >
                <div
                  className={`p-2 rounded-lg ${
                    activity.type.includes('created')
                      ? 'bg-green-100'
                      : activity.type.includes('suspended')
                      ? 'bg-red-100'
                      : 'bg-blue-100'
                  }`}
                >
                  {activity.type.includes('created') ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : activity.type.includes('suspended') ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : (
                    <Activity className="h-4 w-4 text-blue-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    {activity.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {activity.user}
                    </span>
                    <span className="text-xs text-gray-300">•</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/tenants"
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
          >
            <Building2 className="h-6 w-6 text-violet-600" />
            <span className="text-sm font-medium text-gray-700">
              New Tenant
            </span>
          </Link>
          <Link
            to="/users"
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
          >
            <Users className="h-6 w-6 text-violet-600" />
            <span className="text-sm font-medium text-gray-700">
              Manage Users
            </span>
          </Link>
          <Link
            to="/support"
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
          >
            <Activity className="h-6 w-6 text-violet-600" />
            <span className="text-sm font-medium text-gray-700">
              Support Cases
            </span>
          </Link>
          <Link
            to="/reports"
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
          >
            <CreditCard className="h-6 w-6 text-violet-600" />
            <span className="text-sm font-medium text-gray-700">
              Generate Report
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
