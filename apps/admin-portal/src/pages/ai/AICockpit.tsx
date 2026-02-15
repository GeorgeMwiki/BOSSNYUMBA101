import React, { useState, useMemo } from 'react';
import {
  Brain,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Search,
  Filter,
  Download,
  Settings,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Zap,
  Users,
  Building2,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  Sliders,
  ShieldCheck,
  Timer,
  Target,
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
  LineChart,
  Line,
} from 'recharts';
import { useAIDecisions, useReviewAIDecision, type AIDecisionRecord } from '../../lib/hooks';

// ─── Mock Model Data ───────────────────────────────────────

interface ModelMetric {
  name: string;
  version: string;
  accuracy: number;
  avgLatencyMs: number;
  totalDecisions: number;
  overrideRate: number;
  lastUpdated: string;
  status: 'active' | 'shadow' | 'deprecated';
}

const models: ModelMetric[] = [
  { name: 'Decision Engine', version: 'v3.2', accuracy: 94.2, avgLatencyMs: 245, totalDecisions: 15840, overrideRate: 3.2, lastUpdated: '2026-02-10', status: 'active' },
  { name: 'Pricing Model', version: 'v2.1', accuracy: 87.5, avgLatencyMs: 1250, totalDecisions: 4520, overrideRate: 8.1, lastUpdated: '2026-02-05', status: 'active' },
  { name: 'Fraud Detector', version: 'v1.3', accuracy: 96.8, avgLatencyMs: 156, totalDecisions: 8930, overrideRate: 1.5, lastUpdated: '2026-02-08', status: 'active' },
  { name: 'Vendor Matcher', version: 'v1.0', accuracy: 91.0, avgLatencyMs: 523, totalDecisions: 2150, overrideRate: 5.0, lastUpdated: '2026-01-28', status: 'active' },
  { name: 'Comms Analyzer', version: 'v2.0', accuracy: 93.5, avgLatencyMs: 201, totalDecisions: 12300, overrideRate: 2.8, lastUpdated: '2026-02-01', status: 'active' },
  { name: 'Decision Engine', version: 'v2.9', accuracy: 91.0, avgLatencyMs: 312, totalDecisions: 45000, overrideRate: 4.8, lastUpdated: '2025-12-15', status: 'deprecated' },
];

interface GovernanceSetting {
  id: string;
  name: string;
  description: string;
  type: 'threshold' | 'toggle' | 'select';
  value: number | boolean | string;
  unit?: string;
  category: string;
}

const governanceSettings: GovernanceSetting[] = [
  { id: 'g1', name: 'Auto-approval Confidence Threshold', description: 'Minimum confidence for automatic decision approval', type: 'threshold', value: 90, unit: '%', category: 'Decisions' },
  { id: 'g2', name: 'Human Review Required Above', description: 'Transaction amount requiring human review', type: 'threshold', value: 500000, unit: 'KES', category: 'Decisions' },
  { id: 'g3', name: 'Max Auto-Decisions Per Hour', description: 'Rate limit for automated decisions', type: 'threshold', value: 100, unit: 'decisions/hr', category: 'Rate Limits' },
  { id: 'g4', name: 'Enable Eviction AI', description: 'Allow AI to recommend eviction proceedings', type: 'toggle', value: true, category: 'Feature Controls' },
  { id: 'g5', name: 'Enable Rent Pricing AI', description: 'Allow AI to suggest rent adjustments', type: 'toggle', value: true, category: 'Feature Controls' },
  { id: 'g6', name: 'Fraud Detection Sensitivity', description: 'How aggressively to flag potential fraud', type: 'select', value: 'medium', category: 'Detection' },
  { id: 'g7', name: 'Max Rent Increase Recommendation', description: 'Maximum AI-recommended rent increase', type: 'threshold', value: 15, unit: '%', category: 'Constraints' },
  { id: 'g8', name: 'Override Notification', description: 'Notify AI team when decisions are overridden', type: 'toggle', value: true, category: 'Notifications' },
];

const performanceData = Array.from({ length: 14 }, (_, i) => ({
  date: `Feb ${i + 1}`,
  accuracy: 90 + Math.random() * 6,
  latency: 200 + Math.random() * 150,
  decisions: Math.floor(800 + Math.random() * 600),
  overrides: Math.floor(Math.random() * 15),
}));

const decisionDistribution = [
  { name: 'Auto-Approved', value: 72, color: '#22c55e' },
  { name: 'Human Approved', value: 15, color: '#8b5cf6' },
  { name: 'Pending Review', value: 8, color: '#f59e0b' },
  { name: 'Rejected', value: 3, color: '#ef4444' },
  { name: 'Overridden', value: 2, color: '#6366f1' },
];

// ─── Component ─────────────────────────────────────────────

export default function AICockpit() {
  const [activeTab, setActiveTab] = useState('audit');
  const [selectedDecision, setSelectedDecision] = useState<AIDecisionRecord | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [settings, setSettings] = useState(governanceSettings);

  const { data: decisions = [], isLoading } = useAIDecisions();
  const reviewMutation = useReviewAIDecision();

  const filteredDecisions = useMemo(() => {
    return decisions.filter((d) => {
      const matchesStatus = filterStatus === 'all' || d.status === filterStatus;
      const matchesSearch = d.type.toLowerCase().includes(searchQuery.toLowerCase()) || d.tenant.toLowerCase().includes(searchQuery.toLowerCase()) || d.decision.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [decisions, filterStatus, searchQuery]);

  const pendingReview = decisions.filter((d) => d.status === 'pending_review');

  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    reviewMutation.mutate({ id, action });
    setNotification({ type: 'success', message: `Decision ${action === 'approve' ? 'approved' : 'rejected'}` });
    setTimeout(() => setNotification(null), 3000);
  };

  const updateSetting = (id: string, value: number | boolean | string) => {
    setSettings(settings.map((s) => (s.id === id ? { ...s, value } : s)));
  };

  const tabs = [
    { id: 'audit', label: 'Decision Audit Trail', icon: Activity },
    { id: 'models', label: 'Model Performance', icon: BarChart3 },
    { id: 'queue', label: 'Human-in-Loop Queue', icon: Users, count: pendingReview.length },
    { id: 'governance', label: 'Governance Settings', icon: ShieldCheck },
  ];

  const statusColors: Record<string, string> = {
    auto_approved: 'bg-green-100 text-green-700', pending_review: 'bg-amber-100 text-amber-700', approved: 'bg-blue-100 text-blue-700', rejected: 'bg-red-100 text-red-700', overridden: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Operations Cockpit</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor AI decisions, model performance, and governance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-green-700 font-medium">{models.filter((m) => m.status === 'active').length} models active</span>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg flex items-center justify-between ${notification.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-green-800">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)}><X className="h-4 w-4 text-gray-400" /></button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3"><div className="p-2 bg-violet-100 rounded-lg"><Brain className="h-5 w-5 text-violet-600" /></div><div><p className="text-2xl font-bold text-gray-900">{decisions.length}</p><p className="text-sm text-gray-500">Total Decisions</p></div></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3"><div className="p-2 bg-green-100 rounded-lg"><Target className="h-5 w-5 text-green-600" /></div><div><p className="text-2xl font-bold text-gray-900">94.2%</p><p className="text-sm text-gray-500">Avg Accuracy</p></div></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3"><div className="p-2 bg-blue-100 rounded-lg"><Timer className="h-5 w-5 text-blue-600" /></div><div><p className="text-2xl font-bold text-gray-900">312ms</p><p className="text-sm text-gray-500">Avg Latency</p></div></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3"><div className="p-2 bg-amber-100 rounded-lg"><Users className="h-5 w-5 text-amber-600" /></div><div><p className="text-2xl font-bold text-amber-600">{pendingReview.length}</p><p className="text-sm text-gray-500">Pending Review</p></div></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3"><div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="h-5 w-5 text-red-600" /></div><div><p className="text-2xl font-bold text-gray-900">3.2%</p><p className="text-sm text-gray-500">Override Rate</p></div></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 py-3 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">{tab.count}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Search decisions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500" />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500">
              <option value="all">All Status</option>
              <option value="auto_approved">Auto-Approved</option>
              <option value="pending_review">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="overridden">Overridden</option>
            </select>
            <button className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"><Download className="h-4 w-4" />Export</button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200">
            <div className="divide-y divide-gray-100">
              {filteredDecisions.map((d) => (
                <div key={d.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-violet-100 rounded-lg"><Brain className="h-5 w-5 text-violet-600" /></div>
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">{d.type}</span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${d.confidence >= 0.9 ? 'bg-green-100 text-green-700' : d.confidence >= 0.7 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{(d.confidence * 100).toFixed(0)}%</span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[d.status]}`}>{d.status.replace(/_/g, ' ')}</span>
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{d.model}</code>
                        </div>
                        <p className="text-sm text-gray-900 mb-0.5"><span className="text-gray-500">Decision:</span> {d.decision}</p>
                        <p className="text-sm text-gray-500 mb-1"><span className="text-gray-400">Reasoning:</span> {d.reasoning}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{d.tenant}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(d.timestamp).toLocaleString()}</span>
                          <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{d.latencyMs}ms</span>
                          {d.reviewedBy && <span className="flex items-center gap-1"><Users className="h-3 w-3" />Reviewed by {d.reviewedBy}</span>}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedDecision(d)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50">
                      <Eye className="h-4 w-4" />Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {isLoading && <div className="p-8 text-center"><RefreshCw className="h-8 w-8 text-violet-600 animate-spin mx-auto" /></div>}
          </div>
        </div>
      )}

      {/* Tab: Model Performance */}
      {activeTab === 'models' && (
        <div className="space-y-6">
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Accuracy Trend (14 days)</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
                    <YAxis stroke="#9ca3af" fontSize={11} domain={[85, 100]} unit="%" />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                    <Line type="monotone" dataKey="accuracy" name="Accuracy" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Decision Distribution</h3>
              <div className="h-56 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={decisionDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {decisionDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Decision volume chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Decision Volume & Overrides (14 days)</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
                  <YAxis stroke="#9ca3af" fontSize={11} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                  <Bar dataKey="decisions" name="Decisions" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="overrides" name="Overrides" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Model Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {models.filter((m) => m.status === 'active').map((model) => (
              <div key={`${model.name}-${model.version}`} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{model.name}</h3>
                    <span className="text-xs text-gray-500">{model.version}</span>
                  </div>
                  <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">{model.status}</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Accuracy</span><div className="flex items-center gap-2"><div className="w-20 h-2 bg-gray-200 rounded-full"><div className={`h-2 rounded-full ${model.accuracy >= 93 ? 'bg-green-500' : model.accuracy >= 85 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${model.accuracy}%` }} /></div><span className="font-medium">{model.accuracy}%</span></div></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Avg Latency</span><span className="font-medium">{model.avgLatencyMs}ms</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Decisions</span><span className="font-medium">{model.totalDecisions.toLocaleString()}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-gray-500">Override Rate</span><span className={`font-medium ${model.overrideRate > 5 ? 'text-amber-600' : 'text-gray-900'}`}>{model.overrideRate}%</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Human-in-Loop Queue */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {pendingReview.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-300" />
              <h3 className="text-lg font-medium text-gray-700">All Clear!</h3>
              <p className="text-sm text-gray-500 mt-1">No AI decisions pending human review</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingReview.map((d) => (
                <div key={d.id} className="bg-white rounded-xl border border-amber-200 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-amber-100 rounded-lg"><Brain className="h-6 w-6 text-amber-600" /></div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-gray-900">{d.type}</span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${d.confidence >= 0.9 ? 'bg-green-100 text-green-700' : d.confidence >= 0.7 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{(d.confidence * 100).toFixed(0)}% confidence</span>
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{d.model}</code>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 mb-3">
                          <p className="text-sm text-gray-700 mb-1"><span className="font-medium text-gray-900">Input:</span> {d.input}</p>
                          <p className="text-sm text-violet-700 mb-1"><span className="font-medium">AI Recommends:</span> {d.decision}</p>
                          <p className="text-sm text-gray-500"><span className="font-medium text-gray-700">Reasoning:</span> {d.reasoning}</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{d.tenant}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(d.timestamp).toLocaleString()}</span>
                          <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{d.latencyMs}ms</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <button onClick={() => handleReview(d.id, 'approve')} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                        <ThumbsUp className="h-4 w-4" />Approve
                      </button>
                      <button onClick={() => handleReview(d.id, 'reject')} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">
                        <ThumbsDown className="h-4 w-4" />Reject
                      </button>
                      <button onClick={() => setSelectedDecision(d)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
                        <Eye className="h-4 w-4" />Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Governance Settings */}
      {activeTab === 'governance' && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">AI Governance Controls</p>
              <p className="text-xs text-amber-700">Changes to these settings affect all AI decision-making across the platform. Modifications are logged.</p>
            </div>
          </div>

          {/* Group settings by category */}
          {['Decisions', 'Rate Limits', 'Feature Controls', 'Detection', 'Constraints', 'Notifications'].map((category) => {
            const categorySettings = settings.filter((s) => s.category === category);
            if (categorySettings.length === 0) return null;

            return (
              <div key={category} className="bg-white rounded-xl border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">{category}</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {categorySettings.map((setting) => (
                    <div key={setting.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{setting.name}</p>
                        <p className="text-xs text-gray-500">{setting.description}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {setting.type === 'threshold' && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={setting.value as number}
                              onChange={(e) => updateSetting(setting.id, Number(e.target.value))}
                              className="w-24 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 text-right"
                            />
                            {setting.unit && <span className="text-sm text-gray-500">{setting.unit}</span>}
                          </div>
                        )}
                        {setting.type === 'toggle' && (
                          <button
                            onClick={() => updateSetting(setting.id, !(setting.value as boolean))}
                            className={`relative w-11 h-6 rounded-full transition-colors ${(setting.value as boolean) ? 'bg-violet-600' : 'bg-gray-300'}`}
                          >
                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${(setting.value as boolean) ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </button>
                        )}
                        {setting.type === 'select' && (
                          <select
                            value={setting.value as string}
                            onChange={(e) => updateSetting(setting.id, e.target.value)}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Decision Detail Modal */}
      {selectedDecision && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setSelectedDecision(null)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-3"><Brain className="h-5 w-5 text-violet-600" /><h3 className="text-lg font-semibold text-gray-900">Decision Details</h3></div>
                <button onClick={() => setSelectedDecision(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="h-5 w-5 text-gray-500" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-xs font-medium text-gray-500 uppercase">Type</label><p className="font-medium text-gray-900">{selectedDecision.type}</p></div>
                  <div><label className="text-xs font-medium text-gray-500 uppercase">Model</label><p className="font-medium text-gray-900">{selectedDecision.model}</p></div>
                  <div><label className="text-xs font-medium text-gray-500 uppercase">Tenant</label><p className="font-medium text-gray-900">{selectedDecision.tenant}</p></div>
                  <div><label className="text-xs font-medium text-gray-500 uppercase">Status</label><span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[selectedDecision.status]}`}>{selectedDecision.status.replace(/_/g, ' ')}</span></div>
                  <div><label className="text-xs font-medium text-gray-500 uppercase">Latency</label><p className="font-medium text-gray-900">{selectedDecision.latencyMs}ms</p></div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Confidence</label>
                    <div className="flex items-center gap-2"><div className="flex-1 h-2 bg-gray-200 rounded-full"><div className={`h-2 rounded-full ${selectedDecision.confidence >= 0.9 ? 'bg-green-500' : selectedDecision.confidence >= 0.7 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${selectedDecision.confidence * 100}%` }} /></div><span className="font-medium">{(selectedDecision.confidence * 100).toFixed(0)}%</span></div>
                  </div>
                </div>
                <div><label className="text-xs font-medium text-gray-500 uppercase">Input</label><p className="mt-1 p-3 bg-gray-50 rounded-lg text-gray-700">{selectedDecision.input}</p></div>
                <div><label className="text-xs font-medium text-gray-500 uppercase">Decision</label><p className="mt-1 p-3 bg-violet-50 rounded-lg text-violet-900 font-medium">{selectedDecision.decision}</p></div>
                <div><label className="text-xs font-medium text-gray-500 uppercase">Reasoning</label><p className="mt-1 p-3 bg-gray-50 rounded-lg text-gray-700">{selectedDecision.reasoning}</p></div>
                {selectedDecision.reviewedBy && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">Reviewed by <span className="font-medium">{selectedDecision.reviewedBy}</span> at {selectedDecision.reviewedAt ? new Date(selectedDecision.reviewedAt).toLocaleString() : 'unknown time'}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
                <button onClick={() => setSelectedDecision(null)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium">Close</button>
                {selectedDecision.status === 'pending_review' && (
                  <>
                    <button onClick={() => { handleReview(selectedDecision.id, 'approve'); setSelectedDecision(null); }} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"><ThumbsUp className="h-4 w-4" />Approve</button>
                    <button onClick={() => { handleReview(selectedDecision.id, 'reject'); setSelectedDecision(null); }} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"><ThumbsDown className="h-4 w-4" />Reject</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
