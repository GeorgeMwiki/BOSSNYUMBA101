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
  HardDrive,
  Zap,
  TrendingUp,
  TrendingDown,
  Play,
  Pause,
  RotateCcw,
  Eye,
  X,
  ChevronRight,
  Bot,
  Brain,
  MessageSquare,
  FileText,
  Users,
  Building2,
  Filter,
  Search,
  Download,
  Settings,
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface SystemHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  uptime: number;
  lastCheck: string;
  errorRate: number;
}

interface ExceptionItem {
  id: string;
  type: string;
  tenant: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'resolved';
  createdAt: string;
  assignee?: string;
  workflowId?: string;
}

interface WorkflowItem {
  id: string;
  type: string;
  tenant: string;
  description: string;
  status: 'stuck' | 'pending_approval' | 'error' | 'timeout';
  step: string;
  stuckSince: string;
  retries: number;
}

interface AIDecision {
  id: string;
  type: string;
  tenant: string;
  input: string;
  decision: string;
  confidence: number;
  reasoning: string;
  timestamp: string;
  overridden: boolean;
}

const COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#6366F1'];

export function OperationsPage() {
  const [activeTab, setActiveTab] = useState('health');
  const [systemHealth, setSystemHealth] = useState<SystemHealth[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [stuckWorkflows, setStuckWorkflows] = useState<WorkflowItem[]>([]);
  const [aiDecisions, setAIDecisions] = useState<AIDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDecision, setSelectedDecision] = useState<AIDecision | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowItem | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [healthMetrics, setHealthMetrics] = useState<any[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    // Mock data
    setSystemHealth([
      { service: 'API Gateway', status: 'healthy', latency: 45, uptime: 99.99, lastCheck: '2026-02-13T14:30:00Z', errorRate: 0.01 },
      { service: 'Auth Service', status: 'healthy', latency: 32, uptime: 99.98, lastCheck: '2026-02-13T14:30:00Z', errorRate: 0.02 },
      { service: 'Payment Service', status: 'healthy', latency: 128, uptime: 99.95, lastCheck: '2026-02-13T14:30:00Z', errorRate: 0.05 },
      { service: 'Notification Service', status: 'degraded', latency: 450, uptime: 98.50, lastCheck: '2026-02-13T14:30:00Z', errorRate: 2.30 },
      { service: 'AI Engine', status: 'healthy', latency: 280, uptime: 99.90, lastCheck: '2026-02-13T14:30:00Z', errorRate: 0.10 },
      { service: 'Database Primary', status: 'healthy', latency: 12, uptime: 99.999, lastCheck: '2026-02-13T14:30:00Z', errorRate: 0.001 },
      { service: 'Database Replica', status: 'healthy', latency: 15, uptime: 99.99, lastCheck: '2026-02-13T14:30:00Z', errorRate: 0.01 },
      { service: 'Redis Cache', status: 'healthy', latency: 3, uptime: 99.99, lastCheck: '2026-02-13T14:30:00Z', errorRate: 0.01 },
      { service: 'Object Storage', status: 'healthy', latency: 85, uptime: 99.95, lastCheck: '2026-02-13T14:30:00Z', errorRate: 0.05 },
      { service: 'Message Queue', status: 'healthy', latency: 8, uptime: 99.98, lastCheck: '2026-02-13T14:30:00Z', errorRate: 0.02 },
    ]);

    setExceptions([
      { id: '1', type: 'Payment Failed', tenant: 'Acme Properties', description: 'M-PESA timeout after 3 retries', priority: 'critical', status: 'investigating', createdAt: '2026-02-13T12:45:00Z', assignee: 'John K.' },
      { id: '2', type: 'Sync Error', tenant: 'Sunset Estates', description: 'Property sync failed - API rate limit exceeded', priority: 'high', status: 'open', createdAt: '2026-02-13T11:30:00Z' },
      { id: '3', type: 'Invoice Generation', tenant: 'Prime Rentals', description: 'Monthly invoices stuck in queue', priority: 'high', status: 'investigating', createdAt: '2026-02-13T10:00:00Z', assignee: 'Mary W.' },
      { id: '4', type: 'Email Delivery', tenant: 'Urban Living', description: 'Bounce rate exceeded threshold (15%)', priority: 'medium', status: 'open', createdAt: '2026-02-13T09:15:00Z' },
      { id: '5', type: 'Data Validation', tenant: 'Coastal Homes', description: 'Invalid tenant data imported', priority: 'low', status: 'resolved', createdAt: '2026-02-12T16:00:00Z' },
    ]);

    setStuckWorkflows([
      { id: 'WF-001', type: 'Lease Renewal', tenant: 'Acme Properties', description: 'Waiting for owner approval', status: 'pending_approval', step: 'Owner Approval', stuckSince: '2026-02-10T08:00:00Z', retries: 0 },
      { id: 'WF-002', type: 'Payment Processing', tenant: 'Sunset Estates', description: 'M-PESA callback not received', status: 'stuck', step: 'Payment Confirmation', stuckSince: '2026-02-13T11:00:00Z', retries: 5 },
      { id: 'WF-003', type: 'Maintenance Dispatch', tenant: 'Prime Rentals', description: 'No available vendors', status: 'error', step: 'Vendor Assignment', stuckSince: '2026-02-12T14:00:00Z', retries: 3 },
      { id: 'WF-004', type: 'Document Generation', tenant: 'Urban Living', description: 'Template rendering timeout', status: 'timeout', step: 'PDF Generation', stuckSince: '2026-02-13T09:30:00Z', retries: 2 },
      { id: 'WF-005', type: 'Tenant Onboarding', tenant: 'Coastal Homes', description: 'Awaiting KYC verification', status: 'pending_approval', step: 'KYC Review', stuckSince: '2026-02-11T10:00:00Z', retries: 0 },
    ]);

    setAIDecisions([
      { id: '1', type: 'Late Payment Response', tenant: 'Acme Properties', input: 'Tenant 3 days overdue, KES 45,000', decision: 'Send reminder SMS + grace period', confidence: 0.92, reasoning: 'First-time late payer with good history. Grace period policy allows 5 days.', timestamp: '2026-02-13T14:00:00Z', overridden: false },
      { id: '2', type: 'Maintenance Priority', tenant: 'Sunset Estates', input: 'Water leak in Unit 12B', decision: 'Priority: CRITICAL, Dispatch immediate', confidence: 0.98, reasoning: 'Water damage risk high. Similar issues in building require urgent attention.', timestamp: '2026-02-13T13:30:00Z', overridden: false },
      { id: '3', type: 'Rent Adjustment', tenant: 'Prime Rentals', input: 'Market analysis for Block A', decision: 'Recommend 8% increase', confidence: 0.78, reasoning: 'Market rates increased 12% but tenant retention risk suggests moderate adjustment.', timestamp: '2026-02-13T12:00:00Z', overridden: true },
      { id: '4', type: 'Lease Renewal', tenant: 'Urban Living', input: 'Tenant renewal request', decision: 'Auto-approve with standard terms', confidence: 0.95, reasoning: 'Perfect payment history, no violations, long-term tenant (3+ years).', timestamp: '2026-02-13T11:00:00Z', overridden: false },
      { id: '5', type: 'Eviction Assessment', tenant: 'Coastal Homes', input: '90 days overdue, KES 180,000', decision: 'Initiate legal process', confidence: 0.88, reasoning: 'Multiple payment plans defaulted. No response to communication attempts.', timestamp: '2026-02-13T10:00:00Z', overridden: false },
    ]);

    setHealthMetrics([
      { time: '00:00', requests: 1200, errors: 12, latency: 45 },
      { time: '04:00', requests: 800, errors: 5, latency: 38 },
      { time: '08:00', requests: 3500, errors: 28, latency: 52 },
      { time: '12:00', requests: 5200, errors: 45, latency: 68 },
      { time: '16:00', requests: 4800, errors: 38, latency: 58 },
      { time: '20:00', requests: 2800, errors: 18, latency: 48 },
    ]);

    setLoading(false);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'degraded': return 'text-amber-600 bg-amber-100';
      case 'down': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-700 bg-red-100 border-red-200';
      case 'high': return 'text-orange-700 bg-orange-100 border-orange-200';
      case 'medium': return 'text-amber-700 bg-amber-100 border-amber-200';
      case 'low': return 'text-blue-700 bg-blue-100 border-blue-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const getWorkflowStatusColor = (status: string) => {
    switch (status) {
      case 'stuck': return 'text-red-700 bg-red-100';
      case 'pending_approval': return 'text-amber-700 bg-amber-100';
      case 'error': return 'text-orange-700 bg-orange-100';
      case 'timeout': return 'text-purple-700 bg-purple-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const handleRetryWorkflow = async (workflow: WorkflowItem) => {
    setNotification({ type: 'success', message: `Retrying workflow ${workflow.id}...` });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCancelWorkflow = async (workflow: WorkflowItem) => {
    setStuckWorkflows(stuckWorkflows.filter(w => w.id !== workflow.id));
    setNotification({ type: 'success', message: `Workflow ${workflow.id} cancelled` });
    setTimeout(() => setNotification(null), 3000);
  };

  const filteredExceptions = exceptions.filter(e => {
    const matchesPriority = filterPriority === 'all' || e.priority === filterPriority;
    const matchesSearch = e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.tenant.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPriority && matchesSearch;
  });

  const tabs = [
    { id: 'health', name: 'System Health', icon: Activity },
    { id: 'exceptions', name: 'Exception Queue', icon: AlertTriangle, count: exceptions.filter(e => e.status !== 'resolved').length },
    { id: 'workflows', name: 'Stuck Workflows', icon: Clock, count: stuckWorkflows.length },
    { id: 'ai', name: 'AI Decisions', icon: Brain },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-violet-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operations Control Tower</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor system health and manage exceptions</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-sm text-gray-500">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Last updated: {new Date().toLocaleTimeString()}
          </span>
          <a href="/operations/control-tower" className="flex items-center gap-2 px-3 py-2 text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 text-sm font-medium">
            <Eye className="h-4 w-4" />
            Enhanced Control Tower
          </a>
          <button className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg flex items-center justify-between ${
          notification.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            )}
            <span className={notification.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {notification.message}
            </span>
          </div>
          <button onClick={() => setNotification(null)}>
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-violet-600 text-violet-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.name}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Health Tab */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Server className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {systemHealth.filter(s => s.status === 'healthy').length}/{systemHealth.length}
                  </p>
                  <p className="text-sm text-gray-500">Services Healthy</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-100 rounded-lg">
                  <Zap className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">45ms</p>
                  <p className="text-sm text-gray-500">Avg Latency</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">99.95%</p>
                  <p className="text-sm text-gray-500">Avg Uptime</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">0.24%</p>
                  <p className="text-sm text-gray-500">Error Rate</p>
                </div>
              </div>
            </div>
          </div>

          {/* Health Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Request Volume & Errors (24h)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={healthMetrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} />
                  <YAxis yAxisId="left" stroke="#9CA3AF" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                  <Area yAxisId="left" type="monotone" dataKey="requests" name="Requests" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} />
                  <Area yAxisId="right" type="monotone" dataKey="errors" name="Errors" stroke="#EF4444" fill="#EF4444" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Services Grid */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Service Status</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {systemHealth.map((service) => (
                <div key={service.service} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${
                      service.status === 'healthy' ? 'bg-green-500' :
                      service.status === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <p className="font-medium text-gray-900">{service.service}</p>
                      <p className="text-xs text-gray-500">Last check: {new Date(service.lastCheck).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{service.latency}ms</p>
                      <p className="text-xs text-gray-500">Latency</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{service.uptime}%</p>
                      <p className="text-xs text-gray-500">Uptime</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${service.errorRate > 1 ? 'text-red-600' : 'text-gray-900'}`}>
                        {service.errorRate}%
                      </p>
                      <p className="text-xs text-gray-500">Error Rate</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(service.status)}`}>
                      {service.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Exceptions Tab */}
      {activeTab === 'exceptions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search exceptions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-200">
            <div className="divide-y divide-gray-200">
              {filteredExceptions.map((exception) => (
                <div key={exception.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${
                        exception.priority === 'critical' ? 'bg-red-100' :
                        exception.priority === 'high' ? 'bg-orange-100' :
                        exception.priority === 'medium' ? 'bg-amber-100' : 'bg-blue-100'
                      }`}>
                        <AlertTriangle className={`h-5 w-5 ${
                          exception.priority === 'critical' ? 'text-red-600' :
                          exception.priority === 'high' ? 'text-orange-600' :
                          exception.priority === 'medium' ? 'text-amber-600' : 'text-blue-600'
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{exception.type}</span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getPriorityColor(exception.priority)}`}>
                            {exception.priority.toUpperCase()}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            exception.status === 'resolved' ? 'bg-green-100 text-green-700' :
                            exception.status === 'investigating' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {exception.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{exception.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {exception.tenant}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(exception.createdAt).toLocaleString()}
                          </span>
                          {exception.assignee && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {exception.assignee}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg">
                        <Eye className="h-4 w-4" />
                      </button>
                      {exception.status !== 'resolved' && (
                        <button className="px-3 py-1.5 text-sm text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50">
                          Assign
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stuck Workflows Tab */}
      {activeTab === 'workflows' && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Stuck Workflows ({stuckWorkflows.length})</h3>
            <button className="text-sm text-violet-600 hover:text-violet-700">View All Workflows</button>
          </div>
          <div className="divide-y divide-gray-200">
            {stuckWorkflows.map((workflow) => (
              <div key={workflow.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${
                      workflow.status === 'stuck' ? 'bg-red-100' :
                      workflow.status === 'error' ? 'bg-orange-100' :
                      workflow.status === 'timeout' ? 'bg-purple-100' : 'bg-amber-100'
                    }`}>
                      <Clock className={`h-5 w-5 ${
                        workflow.status === 'stuck' ? 'text-red-600' :
                        workflow.status === 'error' ? 'text-orange-600' :
                        workflow.status === 'timeout' ? 'text-purple-600' : 'text-amber-600'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{workflow.type}</span>
                        <span className="text-sm text-gray-500">({workflow.id})</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getWorkflowStatusColor(workflow.status)}`}>
                          {workflow.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{workflow.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {workflow.tenant}
                        </span>
                        <span className="flex items-center gap-1">
                          <Settings className="h-3 w-3" />
                          Step: {workflow.step}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Stuck since: {new Date(workflow.stuckSince).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <RefreshCw className="h-3 w-3" />
                          {workflow.retries} retries
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedWorkflow(workflow)}
                      className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleRetryWorkflow(workflow)}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                      title="Retry"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleCancelWorkflow(workflow)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Decisions Tab */}
      {activeTab === 'ai' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Recent AI Decisions</h3>
              <button className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700">
                <Download className="h-4 w-4" />
                Export Log
              </button>
            </div>
            <div className="divide-y divide-gray-200">
              {aiDecisions.map((decision) => (
                <div key={decision.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-violet-100 rounded-lg">
                        <Brain className="h-5 w-5 text-violet-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{decision.type}</span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            decision.confidence >= 0.9 ? 'bg-green-100 text-green-700' :
                            decision.confidence >= 0.7 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {(decision.confidence * 100).toFixed(0)}% confidence
                          </span>
                          {decision.overridden && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                              Overridden
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                          <span className="text-gray-500">Input:</span> {decision.input}
                        </p>
                        <p className="text-sm text-gray-900 mb-1">
                          <span className="text-gray-500">Decision:</span> <span className="font-medium">{decision.decision}</span>
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {decision.tenant}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(decision.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedDecision(decision)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50"
                    >
                      <Eye className="h-4 w-4" />
                      View Reasoning
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Decision Detail Modal */}
      {selectedDecision && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setSelectedDecision(null)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-100 rounded-lg">
                    <Brain className="h-5 w-5 text-violet-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">AI Decision Details</h3>
                </div>
                <button onClick={() => setSelectedDecision(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Decision Type</label>
                    <p className="font-medium text-gray-900">{selectedDecision.type}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Tenant</label>
                    <p className="font-medium text-gray-900">{selectedDecision.tenant}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Timestamp</label>
                    <p className="font-medium text-gray-900">{new Date(selectedDecision.timestamp).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Confidence</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full">
                        <div
                          className={`h-2 rounded-full ${
                            selectedDecision.confidence >= 0.9 ? 'bg-green-500' :
                            selectedDecision.confidence >= 0.7 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${selectedDecision.confidence * 100}%` }}
                        />
                      </div>
                      <span className="font-medium text-gray-900">{(selectedDecision.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Input Context</label>
                  <p className="mt-1 p-3 bg-gray-50 rounded-lg text-gray-700">{selectedDecision.input}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">AI Decision</label>
                  <p className="mt-1 p-3 bg-violet-50 rounded-lg text-violet-900 font-medium">{selectedDecision.decision}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Reasoning</label>
                  <p className="mt-1 p-3 bg-gray-50 rounded-lg text-gray-700">{selectedDecision.reasoning}</p>
                </div>

                {selectedDecision.overridden && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-2 text-purple-800">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">This decision was manually overridden</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
                <button
                  onClick={() => setSelectedDecision(null)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Close
                </button>
                {!selectedDecision.overridden && (
                  <button className="px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700">
                    Override Decision
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
