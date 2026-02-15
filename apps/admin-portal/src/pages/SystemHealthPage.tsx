import React, { useState, useEffect } from 'react';
import {
  Server,
  Database,
  Globe,
  Cpu,
  HardDrive,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Zap,
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

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  uptime: number;
  lastCheck: string;
  icon: React.ElementType;
}

interface SystemMetric {
  timestamp: string;
  cpu: number;
  memory: number;
  requests: number;
  errors: number;
}

const services: ServiceStatus[] = [
  {
    name: 'API Gateway',
    status: 'healthy',
    latency: 45,
    uptime: 99.98,
    lastCheck: new Date().toISOString(),
    icon: Server,
  },
  {
    name: 'Database (Primary)',
    status: 'healthy',
    latency: 12,
    uptime: 99.99,
    lastCheck: new Date().toISOString(),
    icon: Database,
  },
  {
    name: 'Database (Replica)',
    status: 'healthy',
    latency: 15,
    uptime: 99.97,
    lastCheck: new Date().toISOString(),
    icon: Database,
  },
  {
    name: 'Redis Cache',
    status: 'healthy',
    latency: 2,
    uptime: 99.99,
    lastCheck: new Date().toISOString(),
    icon: Zap,
  },
  {
    name: 'M-Pesa Integration',
    status: 'degraded',
    latency: 1250,
    uptime: 98.5,
    lastCheck: new Date().toISOString(),
    icon: Globe,
  },
  {
    name: 'Email Service (SendGrid)',
    status: 'healthy',
    latency: 180,
    uptime: 99.95,
    lastCheck: new Date().toISOString(),
    icon: Globe,
  },
  {
    name: 'SMS Service (Twilio)',
    status: 'healthy',
    latency: 220,
    uptime: 99.92,
    lastCheck: new Date().toISOString(),
    icon: Globe,
  },
  {
    name: 'Storage (S3)',
    status: 'healthy',
    latency: 85,
    uptime: 99.99,
    lastCheck: new Date().toISOString(),
    icon: HardDrive,
  },
];

const generateMetricsData = (): SystemMetric[] => {
  const data: SystemMetric[] = [];
  const now = Date.now();
  for (let i = 23; i >= 0; i--) {
    data.push({
      timestamp: new Date(now - i * 3600000).toISOString(),
      cpu: Math.floor(Math.random() * 30) + 20,
      memory: Math.floor(Math.random() * 20) + 55,
      requests: Math.floor(Math.random() * 5000) + 2000,
      errors: Math.floor(Math.random() * 50),
    });
  }
  return data;
};

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  healthy: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  degraded: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  down: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
};

export function SystemHealthPage() {
  const [metricsData, setMetricsData] = useState<SystemMetric[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setMetricsData(generateMetricsData());
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setMetricsData(generateMetricsData());
      setLastRefresh(new Date());
      setIsRefreshing(false);
    }, 1000);
  };

  const healthyCount = services.filter((s) => s.status === 'healthy').length;
  const degradedCount = services.filter((s) => s.status === 'degraded').length;
  const downCount = services.filter((s) => s.status === 'down').length;

  const overallStatus =
    downCount > 0
      ? 'down'
      : degradedCount > 0
      ? 'degraded'
      : 'healthy';

  const currentCpu = metricsData[metricsData.length - 1]?.cpu || 0;
  const currentMemory = metricsData[metricsData.length - 1]?.memory || 0;
  const totalRequests = metricsData.reduce((sum, m) => sum + m.requests, 0);
  const totalErrors = metricsData.reduce((sum, m) => sum + m.errors, 0);
  const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-gray-500">Monitor platform infrastructure</p>
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
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Status Banner */}
      <div
        className={`rounded-xl border p-4 flex items-center gap-4 ${
          statusColors[overallStatus].bg
        } ${statusColors[overallStatus].border}`}
      >
        {overallStatus === 'healthy' ? (
          <CheckCircle
            className={`h-8 w-8 ${statusColors[overallStatus].text}`}
          />
        ) : overallStatus === 'degraded' ? (
          <AlertTriangle
            className={`h-8 w-8 ${statusColors[overallStatus].text}`}
          />
        ) : (
          <XCircle className={`h-8 w-8 ${statusColors[overallStatus].text}`} />
        )}
        <div>
          <p className={`font-semibold ${statusColors[overallStatus].text}`}>
            {overallStatus === 'healthy'
              ? 'All Systems Operational'
              : overallStatus === 'degraded'
              ? 'Partial System Degradation'
              : 'System Outage Detected'}
          </p>
          <p className={`text-sm ${statusColors[overallStatus].text}`}>
            {healthyCount} healthy • {degradedCount} degraded • {downCount} down
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Cpu className="h-4 w-4" />
            <span className="text-sm">CPU Usage</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{currentCpu}%</p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                currentCpu > 80
                  ? 'bg-red-500'
                  : currentCpu > 60
                  ? 'bg-amber-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${currentCpu}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <HardDrive className="h-4 w-4" />
            <span className="text-sm">Memory Usage</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{currentMemory}%</p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                currentMemory > 85
                  ? 'bg-red-500'
                  : currentMemory > 70
                  ? 'bg-amber-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${currentMemory}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Activity className="h-4 w-4" />
            <span className="text-sm">Requests (24h)</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {totalRequests.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            ~{Math.round(totalRequests / 24)}/hour avg
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">Error Rate</span>
          </div>
          <p
            className={`text-2xl font-bold ${
              errorRate > 1
                ? 'text-red-600'
                : errorRate > 0.5
                ? 'text-amber-600'
                : 'text-green-600'
            }`}
          >
            {errorRate.toFixed(2)}%
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {totalErrors} errors total
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            Resource Usage (24h)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metricsData}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="timestamp"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickFormatter={(t) =>
                    new Date(t).toLocaleTimeString('en-US', { hour: '2-digit' })
                  }
                />
                <YAxis stroke="#9ca3af" fontSize={12} domain={[0, 100]} />
                <Tooltip
                  labelFormatter={(t) => new Date(t).toLocaleString()}
                  formatter={(value: number, name: string) => [
                    `${value}%`,
                    name.toUpperCase(),
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="cpu"
                  stroke="#8b5cf6"
                  fill="url(#colorCpu)"
                  name="cpu"
                />
                <Area
                  type="monotone"
                  dataKey="memory"
                  stroke="#3b82f6"
                  fill="url(#colorMemory)"
                  name="memory"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            Request Volume (24h)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metricsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="timestamp"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickFormatter={(t) =>
                    new Date(t).toLocaleTimeString('en-US', { hour: '2-digit' })
                  }
                />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  labelFormatter={(t) => new Date(t).toLocaleString()}
                  formatter={(value: number, name: string) => [
                    value.toLocaleString(),
                    name === 'requests' ? 'Requests' : 'Errors',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="requests"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="errors"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Service Status */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Service Status</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {services.map((service) => {
            const status = statusColors[service.status];
            return (
              <div
                key={service.name}
                className="p-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <service.icon className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{service.name}</p>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {service.latency}ms
                      </span>
                      <span>Uptime: {service.uptime}%</span>
                    </div>
                  </div>
                </div>
                <span
                  className={`flex items-center gap-1.5 px-3 py-1 text-sm font-medium rounded-full ${status.bg} ${status.text}`}
                >
                  {service.status === 'healthy' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : service.status === 'degraded' ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {service.status.charAt(0).toUpperCase() +
                    service.status.slice(1)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Incident History */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Recent Incidents</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {[
            {
              date: 'Feb 10, 2025',
              title: 'M-Pesa API Latency Spike',
              status: 'resolved',
              duration: '45 minutes',
              impact: 'Payment processing delays',
            },
            {
              date: 'Feb 5, 2025',
              title: 'Database Connection Pool Exhaustion',
              status: 'resolved',
              duration: '12 minutes',
              impact: 'API timeouts for some requests',
            },
            {
              date: 'Jan 28, 2025',
              title: 'Scheduled Maintenance',
              status: 'completed',
              duration: '2 hours',
              impact: 'Planned downtime for database upgrade',
            },
          ].map((incident, index) => (
            <div key={index} className="p-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">
                    {incident.title}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      incident.status === 'resolved'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {incident.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{incident.impact}</p>
              </div>
              <div className="text-right text-sm text-gray-500">
                <p>{incident.date}</p>
                <p>Duration: {incident.duration}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
