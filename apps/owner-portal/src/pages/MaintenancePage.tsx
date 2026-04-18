import React, { useState } from 'react';
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
import { Skeleton, Alert, AlertDescription, Button, EmptyState, toast } from '@bossnyumba/design-system';
import { formatDate, formatCurrency, formatDateTime } from '../lib/api';
import {
  useOwnerWorkOrders,
  useApproveWorkOrder,
  useRejectWorkOrder,
  type OwnerWorkOrder as WorkOrder,
} from '../lib/hooks';
import { WorkOrderDetailModal, WorkOrderDetail } from '../components/WorkOrderDetailModal';

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
  const {
    data: workOrders = [],
    isLoading: loading,
    isFetching,
    error: queryError,
    refetch,
  } = useOwnerWorkOrders();
  const approveMutation = useApproveWorkOrder();
  const rejectMutation = useRejectWorkOrder();
  const error = queryError instanceof Error ? queryError.message : null;
  const refreshing = isFetching && !loading;

  const [filter, setFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCostTrends, setShowCostTrends] = useState(false);
  const costTrendData: CostTrendData[] = [];
  const approvingId = approveMutation.isPending
    ? (approveMutation.variables as { id: string } | undefined)?.id ?? null
    : null;

  const loadData = (_silent = false) => {
    refetch();
  };

  const handleViewDetails = (wo: WorkOrder) => {
    const detail: WorkOrderDetail = {
      ...wo,
      timeline: [
        { id: 'submitted', action: 'Request Submitted', description: wo.description, timestamp: wo.reportedAt, user: wo.customer?.name },
        ...(wo.scheduledAt ? [{ id: 'scheduled', action: 'Work Scheduled', description: `${wo.vendor?.name || 'Vendor assigned'} for ${formatDate(wo.scheduledAt)}`, timestamp: wo.scheduledAt }] : []),
        ...(wo.completedAt ? [{ id: 'completed', action: 'Work Completed', description: `Final cost: ${formatCurrency(wo.actualCost || wo.estimatedCost || 0)}`, timestamp: wo.completedAt, user: wo.vendor?.name }] : []),
      ],
      evidence: [],
    };
    setSelectedWorkOrder(detail);
    setShowDetailModal(true);
  };

  const handleApprove = (id: string) => {
    approveMutation.mutate(
      { id },
      {
        onSuccess: () => toast.success('Work order approved'),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Approval failed'),
      }
    );
  };

  const handleReject = (id: string, reason: string) => {
    rejectMutation.mutate(
      { id, reason },
      {
        onSuccess: () => toast.success('Work order rejected'),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Rejection failed'),
      }
    );
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
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <AlertDescription>
          {error}
          <Button size="sm" onClick={() => loadData()} className="ml-2">Retry</Button>
        </AlertDescription>
      </Alert>
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
      {showCostTrends && costTrendData.length > 0 && (
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
        <EmptyState
          icon={<Wrench className="h-8 w-8" />}
          title="No work orders found"
          description={
            filter !== 'all' || categoryFilter !== 'all'
              ? 'Try adjusting your filters to find what you\u2019re looking for.'
              : 'When tenants submit maintenance requests they\u2019ll appear here.'
          }
        />
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
