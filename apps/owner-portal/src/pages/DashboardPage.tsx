import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  DollarSign,
  Home,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  Wrench,
  FileText,
  ArrowRight,
  Users,
  BarChart3,
  RefreshCw,
  Filter,
  ChevronDown,
  Calendar,
  X,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api, formatCurrency, formatDate, formatPercentage } from '../lib/api';
import { ArrearsAgingChart, ArrearsAgingData } from '../components/charts/ArrearsAgingChart';
import { QuickActions } from '../components/QuickActions';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

interface Property {
  id: string;
  name: string;
}

interface OwnerDashboardData {
  portfolio: {
    totalProperties: number;
    totalUnits: number;
    portfolioValue: number;
  };
  financial: {
    currentMonthRevenue: number;
    revenueChange: number;
    outstandingBalance: number;
    collectionRate: number;
    collectionRateChange: number;
    noi: number;
  };
  maintenance: {
    openRequests: number;
    inProgress: number;
    completedThisMonth: number;
    totalCostThisMonth: number;
    pendingApprovals: number;
  };
  occupancy: {
    occupancyRate: number;
    occupancyChange: number;
    vacantUnits: number;
    totalTenants: number;
  };
  arrears: ArrearsAgingData[];
  recentActivity: {
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
  }[];
  alerts: {
    id: string;
    type: string;
    title: string;
    message: string;
    actionUrl?: string;
  }[];
}

type DateRange = '7d' | '30d' | '90d' | '1y';

export function DashboardPage() {
  const [data, setData] = useState<OwnerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [properties, setProperties] = useState<Property[]>([]);
  const navigate = useNavigate();

  const fetchData = async () => {
    setError(null);
    try {
      const propertiesResponse = await api.get<Property[]>('/properties');
      if (propertiesResponse.success && propertiesResponse.data) {
        setProperties(propertiesResponse.data);
      } else {
        setProperties([]);
      }

      const queryParams = new URLSearchParams();
      if (selectedProperty !== 'all') queryParams.append('propertyId', selectedProperty);
      queryParams.append('dateRange', dateRange);

      const response = await api.get<OwnerDashboardData>(`/dashboard/owner?${queryParams.toString()}`);
      if (response.success && response.data) {
        setData(response.data);
      } else {
        setData(null);
        setError(response.error?.message ?? 'Live owner dashboard data is unavailable.');
      }
    } catch (err) {
      setProperties([]);
      setData(null);
      setError(err instanceof Error ? err.message : 'Live owner dashboard data is unavailable.');
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedProperty, dateRange]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleMetricDrillDown = (metricType: string, title: string) => {
    // Navigate to detailed view based on metric type
    switch (metricType) {
      case 'portfolio':
        navigate('/portfolio');
        break;
      case 'revenue':
        navigate('/financial?tab=overview');
        break;
      case 'occupancy':
        navigate('/analytics/occupancy');
        break;
      case 'collection':
        navigate('/financial?tab=invoices&filter=overdue');
        break;
      case 'noi':
        navigate('/financial?tab=statements');
        break;
      case 'arrears':
        navigate('/financial?tab=invoices&filter=overdue');
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 bg-gray-200 rounded w-28" />
            <div className="h-4 bg-gray-200 rounded w-56" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 bg-gray-200 rounded-lg w-24" />
            <div className="h-10 bg-gray-200 rounded-lg w-32" />
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-4">
          <div className="h-8 bg-gray-200 rounded w-16" />
          <div className="h-10 bg-gray-200 rounded-lg w-36" />
          <div className="h-10 bg-gray-200 rounded-lg w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-gray-200 rounded-lg" />
                <div className="h-4 bg-gray-200 rounded w-24" />
              </div>
              <div className="h-7 bg-gray-200 rounded w-28" />
              <div className="h-3 bg-gray-200 rounded w-32" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-6 space-y-3">
            <div className="h-5 bg-gray-200 rounded w-32" />
            <div className="h-64 bg-gray-100 rounded-lg" />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
            <div className="h-5 bg-gray-200 rounded w-28" />
            <div className="h-48 bg-gray-100 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1,2].map(i => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-6 space-y-3">
              <div className="h-5 bg-gray-200 rounded w-32" />
              <div className="grid grid-cols-2 gap-4">
                {[1,2,3,4].map(j => (
                  <div key={j} className="h-20 bg-gray-100 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="p-4 bg-amber-50 rounded-full">
          <AlertCircle className="h-10 w-10 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Dashboard Unavailable</h2>
        <p className="text-sm text-gray-500 max-w-md text-center">{error ?? 'Failed to load dashboard data. Please check your connection and try again.'}</p>
        <button
          onClick={handleRefresh}
          className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      </div>
    );
  }

  const { portfolio, financial, maintenance, occupancy, arrears, recentActivity, alerts } = data;

  const occupancyChartData = [
    { name: 'Occupied', value: occupancy.occupancyRate },
    { name: 'Vacant', value: 100 - occupancy.occupancyRate },
  ];

  const revenueTrendData: Array<{ month: string; revenue: number }> = [];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Overview of your property portfolio</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            to="/reports"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            <FileText className="h-4 w-4" />
            View Reports
          </Link>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-xl border border-gray-200">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters:</span>
        </div>
        <div className="relative">
          <select
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">All Properties</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>{property.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['7d', '30d', '90d', '1y'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  dateRange === range ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : '1 Year'}
              </button>
            ))}
          </div>
        </div>
        {selectedProperty !== 'all' && (
          <button
            onClick={() => setSelectedProperty('all')}
            className="flex items-center gap-1 px-2 py-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <X className="h-3 w-3" />
            Clear filter
          </button>
        )}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center gap-3 p-4 rounded-lg ${
                alert.type === 'WARNING'
                  ? 'bg-yellow-50 border border-yellow-200'
                  : alert.type === 'ACTION_REQUIRED'
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-blue-50 border border-blue-200'
              }`}
            >
              <AlertCircle
                className={`h-5 w-5 flex-shrink-0 ${
                  alert.type === 'WARNING'
                    ? 'text-yellow-600'
                    : alert.type === 'ACTION_REQUIRED'
                    ? 'text-red-600'
                    : 'text-blue-600'
                }`}
              />
              <div className="flex-1">
                <p
                  className={`font-medium ${
                    alert.type === 'WARNING'
                      ? 'text-yellow-800'
                      : alert.type === 'ACTION_REQUIRED'
                      ? 'text-red-800'
                      : 'text-blue-800'
                  }`}
                >
                  {alert.title}
                </p>
                <p
                  className={`text-sm ${
                    alert.type === 'WARNING'
                      ? 'text-yellow-700'
                      : alert.type === 'ACTION_REQUIRED'
                      ? 'text-red-700'
                      : 'text-blue-700'
                  }`}
                >
                  {alert.message}
                </p>
              </div>
              {alert.actionUrl && (
                <Link
                  to={alert.actionUrl}
                  className={`text-sm font-medium flex items-center gap-1 ${
                    alert.type === 'WARNING'
                      ? 'text-yellow-700 hover:text-yellow-800'
                      : alert.type === 'ACTION_REQUIRED'
                      ? 'text-red-700 hover:text-red-800'
                      : 'text-blue-700 hover:text-blue-800'
                  }`}
                >
                  View <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Key Stats - Click for drill-down */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <button
          onClick={() => handleMetricDrillDown('portfolio', 'Portfolio Value')}
          className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:shadow-md hover:border-blue-200 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Portfolio Value</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">{formatCurrency(portfolio.portfolioValue)}</p>
          <p className="text-sm text-gray-500">{portfolio.totalProperties} properties, {portfolio.totalUnits} units</p>
        </button>

        <button
          onClick={() => handleMetricDrillDown('revenue', 'Monthly Revenue')}
          className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:shadow-md hover:border-green-200 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Monthly Revenue</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(financial.currentMonthRevenue)}
          </p>
          <div className="flex items-center gap-1 text-sm">
            {financial.revenueChange >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className={financial.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}>
              {formatPercentage(Math.abs(financial.revenueChange))}
            </span>
            <span className="text-gray-500">vs last month</span>
          </div>
        </button>

        <button
          onClick={() => handleMetricDrillDown('occupancy', 'Occupancy Rate')}
          className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:shadow-md hover:border-purple-200 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
              <Home className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Occupancy</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatPercentage(occupancy.occupancyRate)}
          </p>
          <div className="flex items-center gap-1 text-sm">
            {occupancy.occupancyChange >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className={occupancy.occupancyChange >= 0 ? 'text-green-600' : 'text-red-600'}>
              {formatPercentage(Math.abs(occupancy.occupancyChange))}
            </span>
            <span className="text-gray-500">{occupancy.vacantUnits} vacant</span>
          </div>
        </button>

        <button
          onClick={() => handleMetricDrillDown('collection', 'Collection Rate')}
          className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:shadow-md hover:border-emerald-200 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
              <BarChart3 className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">Collection Rate</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatPercentage(financial.collectionRate)}
          </p>
          <div className="flex items-center gap-1 text-sm">
            {financial.collectionRateChange >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className={financial.collectionRateChange >= 0 ? 'text-green-600' : 'text-red-600'}>
              {formatPercentage(Math.abs(financial.collectionRateChange))}
            </span>
            <span className="text-gray-500">trend</span>
          </div>
        </button>

        <button
          onClick={() => handleMetricDrillDown('noi', 'Net Operating Income')}
          className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:shadow-md hover:border-orange-200 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">NOI</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-gray-900">
            {formatCurrency(financial.noi)}
          </p>
          <p className="text-sm text-gray-500">Net Operating Income</p>
        </button>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Revenue Trend</h3>
            <Link 
              to="/analytics/revenue" 
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View details <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="h-64">
            {revenueTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                  <YAxis
                    stroke="#9CA3AF"
                    fontSize={12}
                    tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#3B82F6" fill="#DBEAFE" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-500">
                Revenue trend is unavailable until live time-series data is wired.
              </div>
            )}
          </div>
        </div>

        {/* Occupancy chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Occupancy Rate</h3>
            <Link 
              to="/analytics/occupancy" 
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Details <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={occupancyChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {occupancyChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm text-gray-600">Occupied ({occupancy.totalTenants})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-600">Vacant ({occupancy.vacantUnits})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Arrears & Quick Actions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Arrears Aging Chart */}
        <button
          onClick={() => handleMetricDrillDown('arrears', 'Arrears Aging')}
          className="bg-white rounded-xl border border-gray-200 p-6 text-left hover:shadow-md transition-all"
        >
          <ArrearsAgingChart data={arrears} />
        </button>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <QuickActions />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Maintenance summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Maintenance</h3>
            <Link
              to="/maintenance"
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Link to="/maintenance?filter=open" className="p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
              <div className="flex items-center gap-2 text-yellow-700">
                <Clock className="h-5 w-5" />
                <span className="text-sm font-medium">Open</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-yellow-800">{maintenance.openRequests}</p>
            </Link>
            <Link to="/maintenance?filter=in-progress" className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
              <div className="flex items-center gap-2 text-blue-700">
                <Wrench className="h-5 w-5" />
                <span className="text-sm font-medium">In Progress</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-blue-800">{maintenance.inProgress}</p>
            </Link>
            <Link to="/maintenance?filter=completed" className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Completed</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-green-800">{maintenance.completedThisMonth}</p>
            </Link>
            <Link to="/maintenance/trends" className="p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
              <div className="flex items-center gap-2 text-purple-700">
                <DollarSign className="h-5 w-5" />
                <span className="text-sm font-medium">Cost</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-purple-800">
                {formatCurrency(maintenance.totalCostThisMonth)}
              </p>
            </Link>
          </div>
          {maintenance.pendingApprovals > 0 && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
              <span className="text-sm text-orange-800">
                {maintenance.pendingApprovals} work orders awaiting approval
              </span>
              <Link to="/approvals" className="text-sm font-medium text-orange-700 hover:text-orange-800">
                Review
              </Link>
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0"
              >
                <div
                  className={`p-2 rounded-lg ${
                    activity.type === 'payment'
                      ? 'bg-green-100'
                      : activity.type === 'work_order'
                      ? 'bg-yellow-100'
                      : 'bg-blue-100'
                  }`}
                >
                  {activity.type === 'payment' ? (
                    <DollarSign className="h-4 w-4 text-green-600" />
                  ) : activity.type === 'work_order' ? (
                    <Wrench className="h-4 w-4 text-yellow-600" />
                  ) : (
                    <FileText className="h-4 w-4 text-blue-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                  <p className="text-sm text-gray-500 truncate">{activity.description}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(activity.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
