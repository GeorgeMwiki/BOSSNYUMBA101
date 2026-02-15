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

const revenueData = [
  { month: 'Jul', value: 2100000 },
  { month: 'Aug', value: 2350000 },
  { month: 'Sep', value: 2500000 },
  { month: 'Oct', value: 2800000 },
  { month: 'Nov', value: 3100000 },
  { month: 'Dec', value: 3400000 },
  { month: 'Jan', value: 3750000 },
];

const tenantGrowthData = [
  { month: 'Jul', tenants: 45 },
  { month: 'Aug', tenants: 52 },
  { month: 'Sep', tenants: 61 },
  { month: 'Oct', tenants: 75 },
  { month: 'Nov', tenants: 89 },
  { month: 'Dec', tenants: 104 },
  { month: 'Jan', tenants: 118 },
];

const statusDistribution = [
  { name: 'Active', value: 85, color: '#22c55e' },
  { name: 'Trial', value: 12, color: '#3b82f6' },
  { name: 'Suspended', value: 2, color: '#f59e0b' },
  { name: 'Churned', value: 1, color: '#ef4444' },
];

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardData>('/dashboard/admin').then((response) => {
      if (response.success && response.data) {
        setData(response.data);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  const kpis = data?.kpis || {
    totalTenants: 118,
    activeTenants: 104,
    totalUsers: 1247,
    totalProperties: 892,
    totalUnits: 4536,
    monthlyRevenue: 3750000,
    growthRate: 13.5,
  };

  const alerts = data?.alerts || [
    {
      id: '1',
      severity: 'critical' as const,
      message: 'High API error rate detected in payment service',
      timestamp: new Date().toISOString(),
    },
    {
      id: '2',
      severity: 'warning' as const,
      message: '5 tenants with overdue subscriptions',
      timestamp: new Date().toISOString(),
    },
    {
      id: '3',
      severity: 'info' as const,
      message: 'System maintenance scheduled for Sunday 2AM',
      timestamp: new Date().toISOString(),
    },
  ];

  const recentActivity = data?.recentActivity || [
    {
      id: '1',
      type: 'tenant_created',
      description: 'New tenant "Makini Properties" created',
      timestamp: new Date().toISOString(),
      user: 'admin@bossnyumba.com',
    },
    {
      id: '2',
      type: 'user_role_changed',
      description: 'User role updated to PROPERTY_MANAGER',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      user: 'support@bossnyumba.com',
    },
    {
      id: '3',
      type: 'config_updated',
      description: 'Payment gateway configuration updated',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      user: 'admin@bossnyumba.com',
    },
    {
      id: '4',
      type: 'tenant_suspended',
      description: 'Tenant "Test Corp" suspended for non-payment',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      user: 'admin@bossnyumba.com',
    },
  ];

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
              <AreaChart data={revenueData}>
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
              <BarChart data={tenantGrowthData}>
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
