import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Server,
  Zap,
  TrendingUp,
  RotateCcw,
  Eye,
  X,
  Brain,
  Users,
  Building2,
  Search,
  Download,
  Settings,
} from 'lucide-react';
import {
  useOperationsSnapshot,
  useRetryWorkflow,
  useCancelWorkflow,
  useOverrideAIDecision,
  useAssignException,
  type AIDecisionItem,
  type ExceptionItem,
  type WorkflowItem,
} from '../lib/api/operations';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export function OperationsPage() {
  const [activeTab, setActiveTab] = useState('health');
  const [selectedDecision, setSelectedDecision] = useState<AIDecisionItem | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowItem | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  const { data: snapshot, isLoading: loading, error, refetch, isFetching } = useOperationsSnapshot();
  const retryMutation = useRetryWorkflow();
  const cancelMutation = useCancelWorkflow();
  const overrideMutation = useOverrideAIDecision();
  const assignMutation = useAssignException();
  const [assignExceptionTarget, setAssignExceptionTarget] = useState<ExceptionItem | null>(null);
  const [assignEmail, setAssignEmail] = useState('');

  const systemHealth = snapshot?.systemHealth ?? [];
  const exceptions = snapshot?.exceptions ?? [];
  const stuckWorkflows = snapshot?.stuckWorkflows ?? [];
  const aiDecisions = snapshot?.aiDecisions ?? [];
  const healthMetrics = snapshot?.healthMetrics ?? [];

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const avgLatency = useMemo(() => {
    if (systemHealth.length === 0) return 0;
    return Math.round(systemHealth.reduce((s, x) => s + x.latency, 0) / systemHealth.length);
  }, [systemHealth]);
  const avgUptime = useMemo(() => {
    if (systemHealth.length === 0) return 0;
    return (systemHealth.reduce((s, x) => s + x.uptime, 0) / systemHealth.length).toFixed(2);
  }, [systemHealth]);
  const avgErrorRate = useMemo(() => {
    if (systemHealth.length === 0) return 0;
    return (systemHealth.reduce((s, x) => s + x.errorRate, 0) / systemHealth.length).toFixed(2);
  }, [systemHealth]);

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
    try {
      await retryMutation.mutateAsync(workflow.id);
      showNotification('success', `Workflow ${workflow.id} retried`);
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Retry failed');
    }
  };

  const handleCancelWorkflow = async (workflow: WorkflowItem) => {
    try {
      await cancelMutation.mutateAsync(workflow.id);
      showNotification('success', `Workflow ${workflow.id} cancelled`);
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Cancel failed');
    }
  };

  const handleOverrideDecision = async () => {
    if (!selectedDecision) return;
    if (overrideReason.trim().length < 3) {
      showNotification('error', 'Enter a reason for the override');
      return;
    }
    try {
      await overrideMutation.mutateAsync({ id: selectedDecision.id, reason: overrideReason.trim() });
      showNotification('success', 'Decision overridden');
      setSelectedDecision(null);
      setOverrideReason('');
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Override failed');
    }
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

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-red-900">Operations data unavailable</h2>
            <p className="text-sm text-red-800">{error instanceof Error ? error.message : 'Failed to load operations snapshot.'}</p>
            <button onClick={() => refetch()} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-100">
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        </div>
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
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
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
                  <p className="text-2xl font-bold text-gray-900">{avgLatency}ms</p>
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
                  <p className="text-2xl font-bold text-gray-900">{avgUptime}%</p>
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
                  <p className="text-2xl font-bold text-gray-900">{avgErrorRate}%</p>
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
                      {exception.workflowId && (
                        <a
                          href={`/operations/control-tower?workflow=${encodeURIComponent(exception.workflowId)}`}
                          className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg"
                          title="View related workflow"
                        >
                          <Eye className="h-4 w-4" />
                        </a>
                      )}
                      {exception.status !== 'resolved' && (
                        <button
                          onClick={() => { setAssignExceptionTarget(exception); setAssignEmail(exception.assignee ?? ''); }}
                          className="px-3 py-1.5 text-sm text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50"
                        >
                          {exception.assignee ? 'Reassign' : 'Assign'}
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
            <a href="/operations/control-tower" className="text-sm text-violet-600 hover:text-violet-700">View All Workflows</a>
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
              <button
                onClick={() => {
                  const csv = [
                    ['id', 'type', 'tenant', 'input', 'decision', 'confidence', 'timestamp', 'overridden'].join(','),
                    ...aiDecisions.map((d) => [d.id, d.type, d.tenant, d.input, d.decision, d.confidence, d.timestamp, d.overridden].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')),
                  ].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `ai-decisions-${new Date().toISOString().slice(0, 10)}.csv`;
                  link.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700"
              >
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

      {/* Exception Assign Modal */}
      {assignExceptionTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setAssignExceptionTarget(null)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Assign exception</h3>
                <button onClick={() => setAssignExceptionTarget(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6 space-y-3 text-sm">
                <p className="text-gray-600">{assignExceptionTarget.type} &middot; {assignExceptionTarget.tenant}</p>
                <label className="block">
                  <span className="block text-xs font-medium text-gray-500 uppercase mb-1">Assignee email</span>
                  <input
                    type="email"
                    value={assignEmail}
                    onChange={(e) => setAssignEmail(e.target.value)}
                    placeholder="user@bossnyumba.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </label>
              </div>
              <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
                <button onClick={() => setAssignExceptionTarget(null)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                <button
                  onClick={async () => {
                    if (!assignExceptionTarget) return;
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(assignEmail)) { showNotification('error', 'Enter a valid email'); return; }
                    try {
                      await assignMutation.mutateAsync({ id: assignExceptionTarget.id, assignee: assignEmail.trim() });
                      showNotification('success', 'Exception assigned');
                      setAssignExceptionTarget(null);
                      setAssignEmail('');
                    } catch (err) {
                      showNotification('error', err instanceof Error ? err.message : 'Assignment failed');
                    }
                  }}
                  disabled={assignMutation.isPending}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50"
                >
                  {assignMutation.isPending ? 'Saving...' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Detail Modal */}
      {selectedWorkflow && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setSelectedWorkflow(null)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Workflow {selectedWorkflow.id}</h3>
                <button onClick={() => setSelectedWorkflow(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6 space-y-3 text-sm">
                <div><span className="text-gray-500">Type:</span> <span className="font-medium text-gray-900">{selectedWorkflow.type}</span></div>
                <div><span className="text-gray-500">Tenant:</span> <span className="font-medium text-gray-900">{selectedWorkflow.tenant}</span></div>
                <div><span className="text-gray-500">Step:</span> <span className="font-medium text-gray-900">{selectedWorkflow.step}</span></div>
                <div><span className="text-gray-500">Status:</span> <span className="font-medium text-gray-900">{selectedWorkflow.status}</span></div>
                <div><span className="text-gray-500">Stuck since:</span> <span className="font-medium text-gray-900">{new Date(selectedWorkflow.stuckSince).toLocaleString()}</span></div>
                <div><span className="text-gray-500">Retries:</span> <span className="font-medium text-gray-900">{selectedWorkflow.retries}</span></div>
                <div><span className="text-gray-500">Description:</span> <p className="mt-1 text-gray-700">{selectedWorkflow.description}</p></div>
              </div>
              <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
                <button
                  onClick={() => { handleCancelWorkflow(selectedWorkflow); setSelectedWorkflow(null); }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium"
                >
                  Cancel workflow
                </button>
                <button
                  onClick={() => { handleRetryWorkflow(selectedWorkflow); setSelectedWorkflow(null); }}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700"
                >
                  Retry now
                </button>
              </div>
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

                {!selectedDecision.overridden && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Override Reason</label>
                    <textarea
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      rows={3}
                      placeholder="Explain why this decision must be overridden..."
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
                <button
                  onClick={() => { setSelectedDecision(null); setOverrideReason(''); }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Close
                </button>
                {!selectedDecision.overridden && (
                  <button
                    onClick={handleOverrideDecision}
                    disabled={overrideMutation.isPending}
                    className="px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 disabled:opacity-50"
                  >
                    {overrideMutation.isPending ? 'Submitting...' : 'Override Decision'}
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
