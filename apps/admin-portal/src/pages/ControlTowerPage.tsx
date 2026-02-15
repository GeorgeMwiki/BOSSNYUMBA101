import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Brain,
  Zap,
  TrendingUp,
  TrendingDown,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Filter,
  ChevronRight,
  Server,
  Database,
  CreditCard,
  MessageSquare,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

interface HealthMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
  icon: React.ElementType;
}

interface ExceptionItem {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  tenant: string;
  timestamp: string;
  status: 'pending' | 'in_review' | 'resolved' | 'escalated';
  assignedTo?: string;
}

interface AIDecision {
  id: string;
  type: string;
  decision: string;
  confidence: number;
  context: string;
  timestamp: string;
  outcome: 'approved' | 'rejected' | 'pending_review';
  overridden: boolean;
  tenant: string;
}

const healthMetrics: HealthMetric[] = [
  { id: '1', name: 'API Response Time', value: 145, unit: 'ms', status: 'healthy', trend: 'down', trendValue: 12, icon: Zap },
  { id: '2', name: 'Active Sessions', value: 1247, unit: '', status: 'healthy', trend: 'up', trendValue: 8, icon: Activity },
  { id: '3', name: 'Payment Success Rate', value: 98.5, unit: '%', status: 'healthy', trend: 'up', trendValue: 0.3, icon: CreditCard },
  { id: '4', name: 'Database Connections', value: 85, unit: '%', status: 'warning', trend: 'up', trendValue: 15, icon: Database },
  { id: '5', name: 'Message Queue Depth', value: 342, unit: '', status: 'healthy', trend: 'stable', trendValue: 0, icon: MessageSquare },
  { id: '6', name: 'Error Rate', value: 0.12, unit: '%', status: 'healthy', trend: 'down', trendValue: 0.05, icon: AlertTriangle },
];

const mockExceptions: ExceptionItem[] = [
  {
    id: '1',
    type: 'PAYMENT_FAILED',
    severity: 'high',
    title: 'M-Pesa callback timeout',
    description: 'Multiple payment confirmations pending for over 30 minutes',
    tenant: 'Acme Properties Ltd',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    status: 'pending',
  },
  {
    id: '2',
    type: 'DATA_ANOMALY',
    severity: 'medium',
    title: 'Unusual rent collection pattern',
    description: 'Rent collection dropped 40% below average for this period',
    tenant: 'Sunrise Realty',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    status: 'in_review',
    assignedTo: 'John Mwangi',
  },
  {
    id: '3',
    type: 'SECURITY',
    severity: 'critical',
    title: 'Multiple failed login attempts',
    description: '15 failed login attempts from unknown IP address',
    tenant: 'Metro Housing',
    timestamp: new Date(Date.now() - 900000).toISOString(),
    status: 'escalated',
  },
  {
    id: '4',
    type: 'INTEGRATION',
    severity: 'medium',
    title: 'SMS delivery failures',
    description: 'SMS delivery rate dropped to 75% in the last hour',
    tenant: 'System-wide',
    timestamp: new Date(Date.now() - 2700000).toISOString(),
    status: 'pending',
  },
  {
    id: '5',
    type: 'COMPLIANCE',
    severity: 'low',
    title: 'Document expiry notification',
    description: '3 tenant compliance documents expiring in 7 days',
    tenant: 'Highland Properties',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    status: 'resolved',
  },
];

const mockAIDecisions: AIDecision[] = [
  {
    id: '1',
    type: 'LATE_FEE_WAIVER',
    decision: 'Approve late fee waiver request',
    confidence: 92,
    context: 'Tenant has 24-month perfect payment history, first-time late payment due to bank processing delay',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    outcome: 'approved',
    overridden: false,
    tenant: 'Acme Properties Ltd',
  },
  {
    id: '2',
    type: 'LEASE_RENEWAL',
    decision: 'Recommend 5% rent increase',
    confidence: 87,
    context: 'Market analysis shows 8% area increase, tenant retention risk moderate',
    timestamp: new Date(Date.now() - 1200000).toISOString(),
    outcome: 'pending_review',
    overridden: false,
    tenant: 'Sunrise Realty',
  },
  {
    id: '3',
    type: 'MAINTENANCE_PRIORITY',
    decision: 'Elevate to urgent priority',
    confidence: 95,
    context: 'Water heater failure affecting 12 units, weather forecast shows temperature drop',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    outcome: 'approved',
    overridden: false,
    tenant: 'Highland Properties',
  },
  {
    id: '4',
    type: 'PAYMENT_PLAN',
    decision: 'Reject payment plan request',
    confidence: 78,
    context: 'Tenant has 3 previous payment plan defaults, current arrears exceed threshold',
    timestamp: new Date(Date.now() - 2400000).toISOString(),
    outcome: 'rejected',
    overridden: true,
    tenant: 'Metro Housing',
  },
  {
    id: '5',
    type: 'FRAUD_DETECTION',
    decision: 'Flag transaction for review',
    confidence: 88,
    context: 'Payment pattern anomaly detected, amount 3x typical payment',
    timestamp: new Date(Date.now() - 3000000).toISOString(),
    outcome: 'pending_review',
    overridden: false,
    tenant: 'Coastal Estates',
  },
];

const generateChartData = () => {
  const data = [];
  const now = Date.now();
  for (let i = 23; i >= 0; i--) {
    data.push({
      time: new Date(now - i * 3600000).toISOString(),
      requests: Math.floor(Math.random() * 3000) + 1500,
      errors: Math.floor(Math.random() * 30) + 5,
      latency: Math.floor(Math.random() * 100) + 100,
    });
  }
  return data;
};

const severityColors: Record<string, string> = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const statusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  in_review: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  escalated: 'bg-red-100 text-red-700',
};

export function ControlTowerPage() {
  const [chartData, setChartData] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [aiDecisions, setAiDecisions] = useState<AIDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [exceptionFilter, setExceptionFilter] = useState<string>('all');
  const [aiFilter, setAiFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      setChartData(generateChartData());
      setLastRefresh(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setChartData(generateChartData());
      setExceptions(mockExceptions);
      setAiDecisions(mockAIDecisions);
    } catch (err) {
      setError('Failed to load control tower data.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setChartData(generateChartData());
      setLastRefresh(new Date());
      setIsRefreshing(false);
    }, 1000);
  };

  const filteredExceptions =
    exceptionFilter === 'all'
      ? exceptions
      : exceptions.filter((e) => e.status === exceptionFilter);

  const filteredAIDecisions =
    aiFilter === 'all'
      ? aiDecisions
      : aiDecisions.filter((d) => d.outcome === aiFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-red-500" />
        <p className="text-red-600 font-medium">{error}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const pendingCount = exceptions.filter((e) => e.status === 'pending').length;
  const criticalCount = exceptions.filter((e) => e.severity === 'critical').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Control Tower</h1>
          <p className="text-gray-500">Real-time platform monitoring and AI oversight</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {(pendingCount > 0 || criticalCount > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
          <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-800">Attention Required</p>
            <p className="text-sm text-amber-700">
              {pendingCount} pending exceptions
              {criticalCount > 0 && ` • ${criticalCount} critical issues`}
            </p>
          </div>
          <button className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium">
            Review Now
          </button>
        </div>
      )}

      {/* Health Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {healthMetrics.map((metric) => {
          const Icon = metric.icon;
          const statusBg =
            metric.status === 'healthy'
              ? 'bg-green-50 border-green-200'
              : metric.status === 'warning'
              ? 'bg-amber-50 border-amber-200'
              : 'bg-red-50 border-red-200';
          const statusIcon =
            metric.status === 'healthy' ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : metric.status === 'warning' ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            );

          return (
            <div
              key={metric.id}
              className={`rounded-xl border p-4 ${statusBg}`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="h-5 w-5 text-gray-600" />
                {statusIcon}
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {metric.value}
                <span className="text-sm font-normal text-gray-500 ml-1">
                  {metric.unit}
                </span>
              </p>
              <p className="text-sm text-gray-600 mb-2">{metric.name}</p>
              <div className="flex items-center gap-1 text-xs">
                {metric.trend === 'up' ? (
                  <ArrowUpRight className="h-3 w-3 text-green-600" />
                ) : metric.trend === 'down' ? (
                  <ArrowDownRight className="h-3 w-3 text-red-600" />
                ) : (
                  <span className="text-gray-400">—</span>
                )}
                <span
                  className={
                    metric.trend === 'up'
                      ? 'text-green-600'
                      : metric.trend === 'down'
                      ? 'text-red-600'
                      : 'text-gray-500'
                  }
                >
                  {metric.trendValue > 0 ? `${metric.trendValue}%` : 'Stable'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Request Volume (24h)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="time"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickFormatter={(t) =>
                    new Date(t).toLocaleTimeString('en-US', { hour: '2-digit' })
                  }
                />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  labelFormatter={(t) => new Date(t).toLocaleString()}
                  formatter={(value: number) => [value.toLocaleString(), 'Requests']}
                />
                <Area
                  type="monotone"
                  dataKey="requests"
                  stroke="#8b5cf6"
                  fill="url(#colorRequests)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Response Latency (24h)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="time"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickFormatter={(t) =>
                    new Date(t).toLocaleTimeString('en-US', { hour: '2-digit' })
                  }
                />
                <YAxis stroke="#9ca3af" fontSize={12} unit="ms" />
                <Tooltip
                  labelFormatter={(t) => new Date(t).toLocaleString()}
                  formatter={(value: number) => [`${value}ms`, 'Latency']}
                />
                <Line
                  type="monotone"
                  dataKey="latency"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Exception Queue */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-gray-900">Exception Queue</h3>
            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
              {pendingCount} pending
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={exceptionFilter}
              onChange={(e) => setExceptionFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_review">In Review</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {filteredExceptions.map((exception) => (
            <div
              key={exception.id}
              className="p-4 hover:bg-gray-50 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      severityColors[exception.severity]
                    }`}
                  >
                    {exception.severity.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-400 uppercase">
                    {exception.type.replace('_', ' ')}
                  </span>
                </div>
                <p className="font-medium text-gray-900">{exception.title}</p>
                <p className="text-sm text-gray-500 truncate">
                  {exception.description}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span>{exception.tenant}</span>
                  <span>•</span>
                  <span>{new Date(exception.timestamp).toLocaleString()}</span>
                  {exception.assignedTo && (
                    <>
                      <span>•</span>
                      <span>Assigned to {exception.assignedTo}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 text-xs font-medium rounded-full ${
                    statusColors[exception.status]
                  }`}
                >
                  {exception.status.replace('_', ' ')}
                </span>
                <button className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg">
                  <Eye className="h-4 w-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        {filteredExceptions.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-300" />
            <p>No exceptions matching your filter</p>
          </div>
        )}
      </div>

      {/* AI Decision Logs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-violet-600" />
            <h3 className="font-semibold text-gray-900">AI Decision Logs</h3>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={aiFilter}
              onChange={(e) => setAiFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="all">All Outcomes</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="pending_review">Pending Review</option>
            </select>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {filteredAIDecisions.map((decision) => (
            <div
              key={decision.id}
              className="p-4 hover:bg-gray-50"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-violet-100 text-violet-700">
                      {decision.type.replace(/_/g, ' ')}
                    </span>
                    {decision.overridden && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                        OVERRIDDEN
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-gray-900">{decision.decision}</p>
                  <p className="text-sm text-gray-500 mt-1">{decision.context}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{decision.tenant}</span>
                    <span>•</span>
                    <span>{new Date(decision.timestamp).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Confidence:</span>
                    <div className="flex items-center gap-1">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            decision.confidence >= 90
                              ? 'bg-green-500'
                              : decision.confidence >= 75
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${decision.confidence}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {decision.confidence}%
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 text-xs font-medium rounded-full ${
                      decision.outcome === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : decision.outcome === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {decision.outcome.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                      title="Approve Decision"
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </button>
                    <button
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Override Decision"
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </button>
                    <button
                      className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {filteredAIDecisions.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <Brain className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No AI decisions matching your filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
