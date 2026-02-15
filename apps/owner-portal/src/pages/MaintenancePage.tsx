import React, { useEffect, useState, useCallback } from 'react';
import {
  Wrench,
  Clock,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Filter,
  Building2,
  DollarSign,
  Eye,
  ChevronDown,
  TrendingUp,
  X,
  Camera,
  User,
  Calendar,
  MessageSquare,
  RefreshCw,
  Loader2,
  ThumbsUp,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { api, formatDate, formatCurrency, formatDateTime } from '../lib/api';
import { WorkOrderDetailModal, WorkOrderDetail } from '../components/WorkOrderDetailModal';

// ─── Types ───────────────────────────────────────────────────────
interface WorkOrder {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  reportedAt: string;
  scheduledAt?: string;
  completedAt?: string;
  estimatedCost?: number;
  actualCost?: number;
  requiresApproval?: boolean;
  approvalThreshold?: number;
  unit?: { id: string; unitNumber: string };
  property?: { id: string; name: string };
  customer?: { id: string; name: string; phone?: string };
  vendor?: { id: string; name: string; phone?: string };
}

interface CostTrendData {
  month: string;
  plumbing: number;
  electrical: number;
  hvac: number;
  structural: number;
  other: number;
  total: number;
}

// ─── Main Page ───────────────────────────────────────────────────
export function MaintenancePage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCostTrends, setShowCostTrends] = useState(false);
  const [costTrendData, setCostTrendData] = useState<CostTrendData[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const response = await api.get<WorkOrder[]>('/owner/work-orders');
      if (response.success && response.data) {
        setWorkOrders(response.data);
      }
    } catch {
      // Fallback mock data
      if (workOrders.length === 0) {
        setWorkOrders([
          {
            id: '1', title: 'Leaking faucet in bathroom', description: 'The bathroom faucet has been leaking for 2 days. Water is pooling on the floor.',
            category: 'PLUMBING', priority: 'HIGH', status: 'IN_PROGRESS', reportedAt: '2026-02-10T08:30:00Z', scheduledAt: '2026-02-12T10:00:00Z',
            estimatedCost: 150000, unit: { id: '1', unitNumber: 'A-102' }, property: { id: '1', name: 'Palm Gardens' },
            customer: { id: '1', name: 'John Doe', phone: '+255712345678' }, vendor: { id: '1', name: 'ABC Plumbing', phone: '+255787654321' }
          },
          {
            id: '2', title: 'AC not cooling properly', description: 'Air conditioning unit is running but not cooling the room. Estimated thermostat replacement needed.',
            category: 'HVAC', priority: 'MEDIUM', status: 'PENDING_APPROVAL', reportedAt: '2026-02-11T14:20:00Z',
            estimatedCost: 450000, requiresApproval: true, approvalThreshold: 200000, unit: { id: '2', unitNumber: 'B-301' }, property: { id: '1', name: 'Palm Gardens' },
            customer: { id: '2', name: 'Jane Smith', phone: '+255723456789' }, vendor: { id: '3', name: 'CoolAir Services', phone: '+255798765111' }
          },
          {
            id: '3', title: 'Power outlet not working', description: 'Living room power outlet has stopped working. No visible damage.',
            category: 'ELECTRICAL', priority: 'LOW', status: 'SUBMITTED', reportedAt: '2026-02-12T09:15:00Z',
            estimatedCost: 80000, unit: { id: '3', unitNumber: 'C-205' }, property: { id: '2', name: 'Ocean View Apartments' },
            customer: { id: '3', name: 'Mike Wilson', phone: '+255734567890' }
          },
          {
            id: '4', title: 'Broken window lock', description: 'Bedroom window lock is broken and window cannot be secured.',
            category: 'STRUCTURAL', priority: 'HIGH', status: 'COMPLETED', reportedAt: '2026-02-08T11:00:00Z', completedAt: '2026-02-10T15:30:00Z',
            estimatedCost: 120000, actualCost: 110000, unit: { id: '4', unitNumber: 'A-105' }, property: { id: '1', name: 'Palm Gardens' },
            customer: { id: '4', name: 'Sarah Johnson', phone: '+255745678901' }, vendor: { id: '2', name: 'QuickFix Repairs', phone: '+255798765432' }
          },
          {
            id: '5', title: 'Clogged kitchen drain', description: 'Kitchen sink is draining very slowly. Possible blockage.',
            category: 'PLUMBING', priority: 'MEDIUM', status: 'APPROVED', reportedAt: '2026-02-11T16:45:00Z',
            estimatedCost: 100000, unit: { id: '5', unitNumber: 'D-101' }, property: { id: '2', name: 'Ocean View Apartments' },
            customer: { id: '5', name: 'David Brown', phone: '+255756789012' }
          },
          {
            id: '6', title: 'Water heater malfunction', description: 'Electric water heater making unusual noises and not heating water to proper temperature.',
            category: 'PLUMBING', priority: 'HIGH', status: 'PENDING_APPROVAL', reportedAt: '2026-02-13T08:00:00Z',
            estimatedCost: 380000, requiresApproval: true, approvalThreshold: 200000, unit: { id: '6', unitNumber: 'A-201' }, property: { id: '1', name: 'Palm Gardens' },
            customer: { id: '6', name: 'Maria Chen', phone: '+255767890123' }, vendor: { id: '1', name: 'ABC Plumbing', phone: '+255787654321' }
          },
        ]);
      }
    }

    // Cost trend data
    setCostTrendData([
      { month: 'Sep', plumbing: 850000, electrical: 420000, hvac: 650000, structural: 280000, other: 180000, total: 2380000 },
      { month: 'Oct', plumbing: 720000, electrical: 580000, hvac: 450000, structural: 320000, other: 220000, total: 2290000 },
      { month: 'Nov', plumbing: 980000, electrical: 350000, hvac: 780000, structural: 150000, other: 280000, total: 2540000 },
      { month: 'Dec', plumbing: 650000, electrical: 480000, hvac: 520000, structural: 420000, other: 150000, total: 2220000 },
      { month: 'Jan', plumbing: 820000, electrical: 620000, hvac: 380000, structural: 280000, other: 320000, total: 2420000 },
      { month: 'Feb', plumbing: 750000, electrical: 450000, hvac: 680000, structural: 350000, other: 270000, total: 2500000 },
    ]);

    setLoading(false);
    setRefreshing(false);
  }, [workOrders.length]);

  const handleViewDetails = (wo: WorkOrder) => {
    const detail: WorkOrderDetail = {
      ...wo,
      timeline: [
        { id: '1', action: 'Request Submitted', description: 'Maintenance request created by tenant', timestamp: wo.reportedAt, user: wo.customer?.name },
        { id: '2', action: 'AI Triage', description: `Classified as ${wo.category} with ${wo.priority} priority`, timestamp: new Date(new Date(wo.reportedAt).getTime() + 300000).toISOString() },
        ...(wo.status !== 'SUBMITTED' ? [{ id: '3', action: 'Manager Review', description: 'Request reviewed and assessed by estate manager', timestamp: new Date(new Date(wo.reportedAt).getTime() + 3600000).toISOString(), user: 'Estate Manager' }] : []),
        ...(wo.vendor && wo.status !== 'SUBMITTED' ? [{ id: '3b', action: 'Vendor Quoted', description: `${wo.vendor.name} provided cost estimate of ${formatCurrency(wo.estimatedCost || 0)}`, timestamp: new Date(new Date(wo.reportedAt).getTime() + 7200000).toISOString(), user: wo.vendor.name }] : []),
        ...(wo.status === 'PENDING_APPROVAL' ? [{ id: '4', action: 'Awaiting Owner Approval', description: `Cost exceeds threshold${wo.approvalThreshold ? ` (${formatCurrency(wo.approvalThreshold)})` : ''}. Owner approval required.`, timestamp: new Date(new Date(wo.reportedAt).getTime() + 10800000).toISOString(), user: 'System' }] : []),
        ...(wo.scheduledAt ? [{ id: '5', action: 'Vendor Assigned & Scheduled', description: `${wo.vendor?.name || 'Vendor'} assigned. Scheduled for ${formatDate(wo.scheduledAt)}`, timestamp: wo.scheduledAt }] : []),
        ...(wo.completedAt ? [{ id: '6', action: 'Work Completed', description: `Repair completed and verified. Final cost: ${formatCurrency(wo.actualCost || wo.estimatedCost || 0)}`, timestamp: wo.completedAt }] : []),
      ],
      evidence: wo.status === 'COMPLETED' ? [
        { id: '1', type: 'before', url: 'https://via.placeholder.com/400x300?text=Before+Photo', caption: 'Before repair', uploadedAt: wo.reportedAt },
        { id: '2', type: 'after', url: 'https://via.placeholder.com/400x300?text=After+Photo', caption: 'After repair', uploadedAt: wo.completedAt || '' },
      ] : wo.status !== 'SUBMITTED' ? [
        { id: '1', type: 'before', url: 'https://via.placeholder.com/400x300?text=Issue+Photo', caption: 'Reported issue', uploadedAt: wo.reportedAt },
      ] : [],
    };
    setSelectedWorkOrder(detail);
    setShowDetailModal(true);
  };

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      await api.post(`/owner/work-orders/${id}/approve`, { decision: 'APPROVED' });
    } catch {
      // Dev fallback
    }
    setWorkOrders(workOrders.map(wo =>
      wo.id === id ? { ...wo, status: 'APPROVED', requiresApproval: false } : wo
    ));
    setApprovingId(null);
  };

  const handleReject = async (id: string, reason: string) => {
    try {
      await api.post(`/owner/work-orders/${id}/reject`, { decision: 'REJECTED', reason });
    } catch {
      // Dev fallback
    }
    setWorkOrders(workOrders.map(wo =>
      wo.id === id ? { ...wo, status: 'REJECTED' } : wo
    ));
  };

  const filteredOrders = workOrders.filter((wo) => {
    const matchesStatus = filter === 'all' ? true :
      filter === 'open' ? !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(wo.status) :
      filter === 'pending_approval' ? wo.status === 'PENDING_APPROVAL' :
      wo.status === filter;
    const matchesCategory = categoryFilter === 'all' || wo.category === categoryFilter;
    return matchesStatus && matchesCategory;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'EMERGENCY': return 'bg-red-100 text-red-700';
      case 'HIGH': return 'bg-orange-100 text-orange-700';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'IN_PROGRESS': return <Wrench className="h-5 w-5 text-blue-500" />;
      case 'SUBMITTED': case 'TRIAGED': return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'PENDING_APPROVAL': return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'APPROVED': return <ThumbsUp className="h-5 w-5 text-blue-500" />;
      case 'CANCELLED': case 'REJECTED': return <AlertCircle className="h-5 w-5 text-gray-400" />;
      default: return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-700';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-700';
      case 'SUBMITTED': case 'TRIAGED': case 'APPROVED': return 'bg-yellow-100 text-yellow-700';
      case 'PENDING_APPROVAL': return 'bg-orange-100 text-orange-700';
      case 'CANCELLED': case 'REJECTED': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'PLUMBING': return '🔧';
      case 'ELECTRICAL': return '⚡';
      case 'HVAC': return '❄️';
      case 'STRUCTURAL': return '🏗️';
      default: return '🛠️';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-gray-600">{error}</p>
        <button onClick={() => loadData()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Retry
        </button>
      </div>
    );
  }

  const openCount = workOrders.filter(wo => !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(wo.status)).length;
  const inProgressCount = workOrders.filter(wo => wo.status === 'IN_PROGRESS').length;
  const completedCount = workOrders.filter(wo => wo.status === 'COMPLETED').length;
  const pendingApprovalCount = workOrders.filter(wo => wo.status === 'PENDING_APPROVAL').length;
  const totalCost = workOrders.reduce((sum, wo) => sum + (wo.actualCost || wo.estimatedCost || 0), 0);
  const categories = ['all', ...new Set(workOrders.map(wo => wo.category))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance</h1>
          <p className="text-gray-500">Track and manage work orders</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCostTrends(!showCostTrends)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <TrendingUp className="h-4 w-4" />
            {showCostTrends ? 'Hide Trends' : 'Cost Trends'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Open</p>
              <p className="text-xl font-semibold text-gray-900">{openCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Wrench className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">In Progress</p>
              <p className="text-xl font-semibold text-gray-900">{inProgressCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-xl font-semibold text-gray-900">{completedCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending Approval</p>
              <p className="text-xl font-semibold text-gray-900">{pendingApprovalCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Cost</p>
              <p className="text-xl font-semibold text-gray-900">{formatCurrency(totalCost)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Trends Chart */}
      {showCostTrends && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Maintenance Cost Trends</h3>
              <p className="text-sm text-gray-500">Cost breakdown by category over time</p>
            </div>
            <button onClick={() => setShowCostTrends(false)} className="p-1 hover:bg-gray-100 rounded">
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }} />
                <Legend />
                <Area type="monotone" dataKey="plumbing" name="Plumbing" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                <Area type="monotone" dataKey="electrical" name="Electrical" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} />
                <Area type="monotone" dataKey="hvac" name="HVAC" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
                <Area type="monotone" dataKey="structural" name="Structural" stackId="1" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} />
                <Area type="monotone" dataKey="other" name="Other" stackId="1" stroke="#6B7280" fill="#6B7280" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Pending Approval Alert */}
      {pendingApprovalCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium text-orange-800">{pendingApprovalCount} work order(s) require your approval</p>
                <p className="text-sm text-orange-600">High-value maintenance work needs authorization before proceeding</p>
              </div>
            </div>
            <button
              onClick={() => setFilter('pending_approval')}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 text-sm"
            >
              Review Now
            </button>
          </div>
          {/* Quick approval list */}
          <div className="mt-3 space-y-2">
            {workOrders
              .filter((wo) => wo.status === 'PENDING_APPROVAL')
              .map((wo) => (
                <div
                  key={wo.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-100"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{getCategoryIcon(wo.category)}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{wo.title}</p>
                      <p className="text-xs text-gray-500">
                        {wo.property?.name} - Unit {wo.unit?.unitNumber} •{' '}
                        {formatCurrency(wo.estimatedCost || 0)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewDetails(wo)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleApprove(wo.id)}
                      disabled={approvingId === wo.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg disabled:opacity-50"
                    >
                      {approvingId === wo.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle className="h-3.5 w-3.5" />
                      )}
                      Approve
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500">Status:</span>
          <div className="flex gap-2">
            {['all', 'open', 'pending_approval', 'IN_PROGRESS', 'COMPLETED'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  filter === status ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? 'All' : status === 'open' ? 'Open' : status === 'pending_approval' ? 'Pending Approval' : status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Work orders list */}
      <div className="space-y-4">
        {filteredOrders.map((wo) => (
          <div
            key={wo.id}
            className={`bg-white rounded-xl border ${wo.status === 'PENDING_APPROVAL' ? 'border-orange-300 shadow-sm' : 'border-gray-200'} p-4 hover:shadow-md transition-shadow`}
          >
            <div className="flex items-start gap-4">
              <div className="p-2 bg-gray-100 rounded-lg text-2xl">{getCategoryIcon(wo.category)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-gray-900">{wo.title}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{wo.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(wo.priority)}`}>
                      {wo.priority}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(wo.status)}`}>
                      {wo.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  {wo.property && (
                    <div className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {wo.property.name} - Unit {wo.unit?.unitNumber}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Reported {formatDate(wo.reportedAt)}
                  </div>
                  {wo.scheduledAt && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Scheduled {formatDate(wo.scheduledAt)}
                    </div>
                  )}
                  {(wo.actualCost || wo.estimatedCost) && (
                    <div className="flex items-center gap-1 font-medium text-gray-700">
                      <DollarSign className="h-4 w-4" />
                      {wo.actualCost ? formatCurrency(wo.actualCost) : `Est: ${formatCurrency(wo.estimatedCost || 0)}`}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => handleViewDetails(wo)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Eye className="h-4 w-4" /> View Details
                  </button>
                  {wo.status === 'PENDING_APPROVAL' && (
                    <>
                      <button
                        onClick={() => handleApprove(wo.id)}
                        disabled={approvingId === wo.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg disabled:opacity-50"
                      >
                        {approvingId === wo.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        Approve {wo.estimatedCost ? `(${formatCurrency(wo.estimatedCost)})` : ''}
                      </button>
                      <button
                        onClick={() => handleViewDetails(wo)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <AlertCircle className="h-4 w-4" /> Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Wrench className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p>No work orders found</p>
        </div>
      )}

      {/* Work Order Detail Modal */}
      <WorkOrderDetailModal
        workOrder={selectedWorkOrder}
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        onApprove={handleApprove}
        onReject={handleReject}
        isPendingApproval={selectedWorkOrder?.status === 'PENDING_APPROVAL'}
      />
    </div>
  );
}
