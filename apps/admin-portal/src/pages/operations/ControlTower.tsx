import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Server,
  Database,
  Cpu,
  Zap,
  TrendingUp,
  Eye,
  X,
  RotateCcw,
  Play,
  Pause,
  Brain,
  Building2,
  Users,
  Search,
  Filter,
  Download,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  CreditCard,
  MessageSquare,
  XCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
} from 'recharts';
import { useSystemHealth } from '../../lib/hooks';

// ─── Types ─────────────────────────────────────────────────

interface TenantHealth {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  activeUsers: number;
  apiCalls24h: number;
  errorRate: number;
  paymentSuccessRate: number;
  lastActivity: string;
}

interface ExceptionItem {
  id: string;
  type: 'payment_failed' | 'reconciliation' | 'workflow_stuck' | 'data_sync' | 'security';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  tenant: string;
  status: 'open' | 'investigating' | 'resolved';
  createdAt: string;
  assignee?: string;
  retries: number;
}

interface StuckWorkflow {
  id: string;
  type: string;
  tenant: string;
  description: string;
  step: string;
  stuckSince: string;
  retries: number;
  canRetry: boolean;
  canSkip: boolean;
  canCancel: boolean;
}

interface AIDecisionLog {
  id: string;
  type: string;
  tenant: string;
  decision: string;
  confidence: number;
  reasoning: string;
  timestamp: string;
  overridden: boolean;
  model: string;
}

// ─── Mock Data ─────────────────────────────────────────────

const mockTenantHealth: TenantHealth[] = [
  { id: '1', name: 'Acme Properties Ltd', status: 'healthy', activeUsers: 28, apiCalls24h: 15420, errorRate: 0.1, paymentSuccessRate: 99.2, lastActivity: '2026-02-13T14:30:00Z' },
  { id: '2', name: 'Sunrise Realty', status: 'healthy', activeUsers: 8, apiCalls24h: 4200, errorRate: 0.3, paymentSuccessRate: 98.5, lastActivity: '2026-02-13T14:28:00Z' },
  { id: '3', name: 'Metro Housing', status: 'warning', activeUsers: 2, apiCalls24h: 890, errorRate: 2.1, paymentSuccessRate: 94.0, lastActivity: '2026-02-13T14:15:00Z' },
  { id: '4', name: 'Coastal Estates', status: 'critical', activeUsers: 0, apiCalls24h: 45, errorRate: 15.0, paymentSuccessRate: 75.0, lastActivity: '2026-02-13T10:00:00Z' },
  { id: '5', name: 'Highland Properties', status: 'healthy', activeUsers: 15, apiCalls24h: 9800, errorRate: 0.2, paymentSuccessRate: 99.5, lastActivity: '2026-02-13T14:29:00Z' },
  { id: '6', name: 'Prime Rentals', status: 'healthy', activeUsers: 6, apiCalls24h: 3200, errorRate: 0.5, paymentSuccessRate: 97.8, lastActivity: '2026-02-13T14:25:00Z' },
];

const mockExceptions: ExceptionItem[] = [
  { id: 'EX-001', type: 'payment_failed', severity: 'critical', title: 'M-PESA Bulk Timeout', description: 'M-PESA callback timeout affecting 23 pending payments totaling KES 890,000', tenant: 'Acme Properties', status: 'investigating', createdAt: '2026-02-13T12:45:00Z', assignee: 'John K.', retries: 3 },
  { id: 'EX-002', type: 'reconciliation', severity: 'high', title: 'Bank Reconciliation Mismatch', description: 'KES 45,000 discrepancy between M-PESA records and bank statement', tenant: 'Sunrise Realty', status: 'open', createdAt: '2026-02-13T11:30:00Z', retries: 0 },
  { id: 'EX-003', type: 'workflow_stuck', severity: 'high', title: 'Invoice Generation Queue Stuck', description: 'Monthly invoices for 156 units stuck in generation queue', tenant: 'Prime Rentals', status: 'investigating', createdAt: '2026-02-13T10:00:00Z', assignee: 'Mary W.', retries: 2 },
  { id: 'EX-004', type: 'data_sync', severity: 'medium', title: 'Property Sync Failed', description: 'API rate limit exceeded during property data synchronization', tenant: 'Metro Housing', status: 'open', createdAt: '2026-02-13T09:15:00Z', retries: 5 },
  { id: 'EX-005', type: 'security', severity: 'critical', title: 'Brute Force Detected', description: '47 failed login attempts from IP 103.45.67.89 in last hour', tenant: 'System-wide', status: 'investigating', createdAt: '2026-02-13T14:00:00Z', assignee: 'Security Team', retries: 0 },
];

const mockStuckWorkflows: StuckWorkflow[] = [
  { id: 'WF-001', type: 'Lease Renewal', tenant: 'Acme Properties', description: 'Waiting for owner approval (3 days)', step: 'Owner Approval', stuckSince: '2026-02-10T08:00:00Z', retries: 0, canRetry: false, canSkip: true, canCancel: true },
  { id: 'WF-002', type: 'Payment Processing', tenant: 'Sunset Estates', description: 'M-PESA callback not received', step: 'Payment Confirmation', stuckSince: '2026-02-13T11:00:00Z', retries: 5, canRetry: true, canSkip: false, canCancel: true },
  { id: 'WF-003', type: 'Maintenance Dispatch', tenant: 'Prime Rentals', description: 'No available vendors in area', step: 'Vendor Assignment', stuckSince: '2026-02-12T14:00:00Z', retries: 3, canRetry: true, canSkip: true, canCancel: true },
  { id: 'WF-004', type: 'Document Generation', tenant: 'Urban Living', description: 'Template rendering timeout', step: 'PDF Generation', stuckSince: '2026-02-13T09:30:00Z', retries: 2, canRetry: true, canSkip: false, canCancel: true },
];

const mockAILogs: AIDecisionLog[] = [
  { id: '1', type: 'Late Payment', tenant: 'Acme Properties', decision: 'Send SMS + 5-day grace', confidence: 0.92, reasoning: 'First-time late payer, 24-month good history.', timestamp: '2026-02-13T14:00:00Z', overridden: false, model: 'decision-v3' },
  { id: '2', type: 'Maintenance Priority', tenant: 'Sunset Estates', decision: 'CRITICAL - Immediate dispatch', confidence: 0.98, reasoning: 'Water damage risk. Urgent precedent.', timestamp: '2026-02-13T13:30:00Z', overridden: false, model: 'decision-v3' },
  { id: '3', type: 'Rent Adjustment', tenant: 'Prime Rentals', decision: 'Recommend 8% increase', confidence: 0.78, reasoning: 'Market 12% up, retention risk moderate.', timestamp: '2026-02-13T12:00:00Z', overridden: true, model: 'pricing-v2' },
  { id: '4', type: 'Fraud Detection', tenant: 'Metro Housing', decision: 'Flag & hold disbursement', confidence: 0.85, reasoning: 'Duplicate payment from different M-Pesa numbers.', timestamp: '2026-02-13T09:30:00Z', overridden: false, model: 'fraud-v1' },
];

const generateMetrics = () => {
  const data = [];
  for (let i = 23; i >= 0; i--) {
    data.push({
      time: `${String(24 - i).padStart(2, '0')}:00`,
      requests: Math.floor(Math.random() * 3000) + 1500,
      errors: Math.floor(Math.random() * 30) + 5,
      latency: Math.floor(Math.random() * 80) + 40,
      payments: Math.floor(Math.random() * 200) + 100,
    });
  }
  return data;
};

// ─── Component ─────────────────────────────────────────────

export default function ControlTower() {
  const [activeTab, setActiveTab] = useState('overview');
  const [exceptions, setExceptions] = useState(mockExceptions);
  const [workflows, setWorkflows] = useState(mockStuckWorkflows);
  const [metrics] = useState(generateMetrics);
  const [selectedLog, setSelectedLog] = useState<AIDecisionLog | null>(null);
  const [filterPriority, setFilterPriority] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: healthData } = useSystemHealth();

  const showNotify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleRetry = (wf: StuckWorkflow) => { showNotify('success', `Retrying workflow ${wf.id}...`); };
  const handleSkip = (wf: StuckWorkflow) => { showNotify('success', `Skipping step "${wf.step}" for ${wf.id}`); };
  const handleCancel = (wf: StuckWorkflow) => {
    setWorkflows((prev) => prev.filter((w) => w.id !== wf.id));
    showNotify('success', `Workflow ${wf.id} cancelled`);
  };

  const handleResolveException = (id: string) => {
    setExceptions((prev) => prev.map((e) => (e.id === id ? { ...e, status: 'resolved' as const } : e)));
    showNotify('success', 'Exception marked as resolved');
  };

  const tabs = [
    { id: 'overview', label: 'Cross-Tenant Overview', icon: Activity },
    { id: 'exceptions', label: 'Exception Queue', icon: AlertTriangle, count: exceptions.filter((e) => e.status !== 'resolved').length },
    { id: 'workflows', label: 'Stuck Workflows', icon: Clock, count: workflows.length },
    { id: 'ai', label: 'AI Decision Logs', icon: Brain },
  ];

  const severityColors: Record<string, string> = { critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-blue-100 text-blue-700' };

  const filteredExceptions = exceptions.filter((e) => {
    const matchesPriority = filterPriority === 'all' || e.severity === filterPriority;
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || e.tenant.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPriority && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operations Control Tower</h1>
          <p className="text-sm text-gray-500 mt-1">Cross-tenant monitoring, exceptions, and interventions</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setAutoRefresh(!autoRefresh)} className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm ${autoRefresh ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-300 text-gray-600'}`}>
            {autoRefresh ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <span className="text-sm text-gray-400">{new Date().toLocaleTimeString()}</span>
          <button className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg flex items-center justify-between ${notification.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-red-600" />}
            <span className={notification.type === 'success' ? 'text-green-800' : 'text-red-800'}>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)}><X className="h-4 w-4 text-gray-400" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 py-3 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">{tab.count}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab: Cross-Tenant Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3"><div className="p-2 bg-green-100 rounded-lg"><Server className="h-5 w-5 text-green-600" /></div><div><p className="text-2xl font-bold text-gray-900">{healthData ? healthData.filter((s) => s.status === 'healthy').length : 7}/{healthData?.length || 8}</p><p className="text-sm text-gray-500">Services Healthy</p></div></div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3"><div className="p-2 bg-violet-100 rounded-lg"><Users className="h-5 w-5 text-violet-600" /></div><div><p className="text-2xl font-bold text-gray-900">{mockTenantHealth.reduce((s, t) => s + t.activeUsers, 0)}</p><p className="text-sm text-gray-500">Active Users Now</p></div></div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3"><div className="p-2 bg-blue-100 rounded-lg"><Zap className="h-5 w-5 text-blue-600" /></div><div><p className="text-2xl font-bold text-gray-900">{(mockTenantHealth.reduce((s, t) => s + t.apiCalls24h, 0) / 1000).toFixed(1)}K</p><p className="text-sm text-gray-500">API Calls (24h)</p></div></div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3"><div className="p-2 bg-amber-100 rounded-lg"><AlertTriangle className="h-5 w-5 text-amber-600" /></div><div><p className="text-2xl font-bold text-gray-900">{exceptions.filter((e) => e.status !== 'resolved').length}</p><p className="text-sm text-gray-500">Open Exceptions</p></div></div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Request Volume & Errors (24h)</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics}>
                    <defs>
                      <linearGradient id="ctReqs" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="time" stroke="#9ca3af" fontSize={11} />
                    <YAxis stroke="#9ca3af" fontSize={11} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                    <Area type="monotone" dataKey="requests" name="Requests" stroke="#8b5cf6" fill="url(#ctReqs)" />
                    <Area type="monotone" dataKey="errors" name="Errors" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Payment Volume (24h)</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="time" stroke="#9ca3af" fontSize={11} />
                    <YAxis stroke="#9ca3af" fontSize={11} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                    <Bar dataKey="payments" name="Payments" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tenant Health Grid */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Tenant Health Overview</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Users</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">API Calls</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Error Rate</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Payment Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {mockTenantHealth.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-900 text-sm">{t.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${t.status === 'healthy' ? 'bg-green-500' : t.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'}`} />
                          <span className={`text-xs font-medium ${t.status === 'healthy' ? 'text-green-700' : t.status === 'warning' ? 'text-amber-700' : 'text-red-700'}`}>{t.status}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-700">{t.activeUsers}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-700">{t.apiCalls24h.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center"><span className={`text-sm font-medium ${t.errorRate > 5 ? 'text-red-600' : t.errorRate > 1 ? 'text-amber-600' : 'text-gray-700'}`}>{t.errorRate}%</span></td>
                      <td className="px-4 py-3 text-center"><span className={`text-sm font-medium ${t.paymentSuccessRate < 90 ? 'text-red-600' : t.paymentSuccessRate < 97 ? 'text-amber-600' : 'text-green-600'}`}>{t.paymentSuccessRate}%</span></td>
                      <td className="px-4 py-3 text-sm text-gray-500">{new Date(t.lastActivity).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Exception Queue */}
      {activeTab === 'exceptions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Search exceptions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
            </div>
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500">
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-200">
            <div className="divide-y divide-gray-100">
              {filteredExceptions.map((ex) => (
                <div key={ex.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${ex.severity === 'critical' ? 'bg-red-100' : ex.severity === 'high' ? 'bg-orange-100' : ex.severity === 'medium' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                        <AlertTriangle className={`h-5 w-5 ${ex.severity === 'critical' ? 'text-red-600' : ex.severity === 'high' ? 'text-orange-600' : ex.severity === 'medium' ? 'text-amber-600' : 'text-blue-600'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{ex.title}</span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${severityColors[ex.severity]}`}>{ex.severity}</span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${ex.status === 'resolved' ? 'bg-green-100 text-green-700' : ex.status === 'investigating' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{ex.status}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{ex.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{ex.tenant}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(ex.createdAt).toLocaleString()}</span>
                          {ex.assignee && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{ex.assignee}</span>}
                          {ex.retries > 0 && <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" />{ex.retries} retries</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {ex.status !== 'resolved' && (
                        <>
                          <button onClick={() => handleResolveException(ex.id)} className="px-3 py-1.5 text-sm text-green-600 border border-green-200 rounded-lg hover:bg-green-50">Resolve</button>
                          <button className="px-3 py-1.5 text-sm text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50">Assign</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {filteredExceptions.length === 0 && (
                <div className="p-8 text-center text-gray-500"><CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-300" /><p>No exceptions matching your filter</p></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Stuck Workflows */}
      {activeTab === 'workflows' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Intervention Controls ({workflows.length} stuck)</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {workflows.map((wf) => (
              <div key={wf.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-amber-100 rounded-lg"><Clock className="h-5 w-5 text-amber-600" /></div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{wf.type}</span>
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{wf.id}</code>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{wf.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{wf.tenant}</span>
                        <span className="flex items-center gap-1"><Settings className="h-3 w-3" />Step: {wf.step}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Stuck: {new Date(wf.stuckSince).toLocaleString()}</span>
                        <span className="flex items-center gap-1"><RefreshCw className="h-3 w-3" />{wf.retries} retries</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {wf.canRetry && <button onClick={() => handleRetry(wf)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 border border-green-200 rounded-lg hover:bg-green-50" title="Retry"><RotateCcw className="h-4 w-4" />Retry</button>}
                    {wf.canSkip && <button onClick={() => handleSkip(wf)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50" title="Skip Step"><Play className="h-4 w-4" />Skip</button>}
                    {wf.canCancel && <button onClick={() => handleCancel(wf)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50" title="Cancel"><XCircle className="h-4 w-4" />Cancel</button>}
                  </div>
                </div>
              </div>
            ))}
            {workflows.length === 0 && (
              <div className="p-8 text-center text-gray-500"><CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-300" /><p>No stuck workflows</p></div>
            )}
          </div>
        </div>
      )}

      {/* Tab: AI Decision Logs */}
      {activeTab === 'ai' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3"><Brain className="h-5 w-5 text-violet-600" /><h3 className="font-semibold text-gray-900">AI Decision Log with Explanations</h3></div>
              <button className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700"><Download className="h-4 w-4" />Export</button>
            </div>
            <div className="divide-y divide-gray-100">
              {mockAILogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-violet-100 rounded-lg"><Brain className="h-5 w-5 text-violet-600" /></div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{log.type}</span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${log.confidence >= 0.9 ? 'bg-green-100 text-green-700' : log.confidence >= 0.7 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{(log.confidence * 100).toFixed(0)}% confidence</span>
                          {log.overridden && <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">Overridden</span>}
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{log.model}</code>
                        </div>
                        <p className="text-sm text-gray-900 font-medium mb-1">Decision: {log.decision}</p>
                        <p className="text-sm text-gray-500 mb-1">Reasoning: {log.reasoning}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{log.tenant}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedLog(log)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50"><Eye className="h-4 w-4" />Details</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Decision Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setSelectedLog(null)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-3"><Brain className="h-5 w-5 text-violet-600" /><h3 className="text-lg font-semibold text-gray-900">AI Decision Details</h3></div>
                <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="h-5 w-5 text-gray-500" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-medium text-gray-500 uppercase">Type</label><p className="font-medium text-gray-900">{selectedLog.type}</p></div>
                  <div><label className="text-xs font-medium text-gray-500 uppercase">Model</label><p className="font-medium text-gray-900">{selectedLog.model}</p></div>
                  <div><label className="text-xs font-medium text-gray-500 uppercase">Tenant</label><p className="font-medium text-gray-900">{selectedLog.tenant}</p></div>
                  <div><label className="text-xs font-medium text-gray-500 uppercase">Confidence</label><div className="flex items-center gap-2"><div className="flex-1 h-2 bg-gray-200 rounded-full"><div className={`h-2 rounded-full ${selectedLog.confidence >= 0.9 ? 'bg-green-500' : selectedLog.confidence >= 0.7 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${selectedLog.confidence * 100}%` }} /></div><span className="font-medium">{(selectedLog.confidence * 100).toFixed(0)}%</span></div></div>
                </div>
                <div><label className="text-xs font-medium text-gray-500 uppercase">Decision</label><p className="mt-1 p-3 bg-violet-50 rounded-lg text-violet-900 font-medium">{selectedLog.decision}</p></div>
                <div><label className="text-xs font-medium text-gray-500 uppercase">Reasoning</label><p className="mt-1 p-3 bg-gray-50 rounded-lg text-gray-700">{selectedLog.reasoning}</p></div>
                {selectedLog.overridden && <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-2 text-purple-800"><AlertTriangle className="h-4 w-4" /><span className="font-medium">This decision was manually overridden</span></div>}
              </div>
              <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
                <button onClick={() => setSelectedLog(null)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
