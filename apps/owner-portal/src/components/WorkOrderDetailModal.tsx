import React, { useState } from 'react';
import {
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  Wrench,
  DollarSign,
  Camera,
  MessageSquare,
  User,
  Calendar,
  Building2,
  Loader2,
  AlertTriangle,
  FileText,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Shield,
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '../lib/api';

// ─── Types ───────────────────────────────────────────────────────
export interface WorkOrderEvent {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  user?: string;
}

export interface WorkOrderDetail {
  id: string;
  number?: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  reportedAt: string;
  createdAt?: string;
  scheduledAt?: string;
  completedAt?: string;
  estimatedCost?: number;
  actualCost?: number;
  requiresApproval?: boolean;
  approvalThreshold?: number;
  unit?: { id: string; unitNumber: string };
  property?: { id: string; name: string };
  customer?: { id: string; name: string; phone?: string };
  tenant?: { id: string; name: string };
  vendor?: { id: string; name: string; phone?: string };
  timeline: { id: string; action: string; description: string; timestamp: string; user?: string }[];
  evidence: { id: string; type: string; url: string; caption?: string; description?: string; uploadedAt?: string; timestamp?: string }[];
}

interface WorkOrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrderDetail | null;
  onApprove?: (id: string) => void;
  onReject?: (id: string, reason: string) => void;
  isPendingApproval?: boolean;
}

// ─── Main Component ──────────────────────────────────────────────
export function WorkOrderDetailModal({
  isOpen,
  onClose,
  workOrder,
  onApprove,
  onReject,
  isPendingApproval,
}: WorkOrderDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'evidence' | 'costs'>('details');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');

  if (!isOpen || !workOrder) return null;

  const showApproval = isPendingApproval || (workOrder.requiresApproval && workOrder.status === 'PENDING_APPROVAL');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-700';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-700';
      case 'PENDING_APPROVAL':
        return 'bg-orange-100 text-orange-700';
      case 'APPROVED':
        return 'bg-blue-100 text-blue-700';
      case 'SUBMITTED':
      case 'TRIAGED':
        return 'bg-yellow-100 text-yellow-700';
      case 'REJECTED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'EMERGENCY':
        return 'bg-red-100 text-red-700';
      case 'HIGH':
        return 'bg-orange-100 text-orange-700';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-700';
      case 'LOW':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    await new Promise((r) => setTimeout(r, 1000));
    onApprove?.(workOrder.id);
    setApproving(false);
    setApprovalComment('');
    onClose();
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setRejecting(true);
    await new Promise((r) => setTimeout(r, 1000));
    onReject?.(workOrder.id, rejectReason);
    setRejecting(false);
    setShowRejectForm(false);
    setRejectReason('');
    onClose();
  };

  const tabs = [
    { id: 'details' as const, label: 'Details' },
    { id: 'timeline' as const, label: 'Timeline' },
    { id: 'evidence' as const, label: 'Evidence' },
    ...(showApproval ? [{ id: 'costs' as const, label: 'Cost Analysis' }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                {workOrder.number || `WO-${workOrder.id}`}
              </h2>
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                  workOrder.status
                )}`}
              >
                {workOrder.status.replace(/_/g, ' ')}
              </span>
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityColor(
                  workOrder.priority
                )}`}
              >
                {workOrder.priority}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">{workOrder.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Approval Banner */}
        {showApproval && (
          <div className="bg-orange-50 border-b border-orange-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <Shield className="h-5 w-5 text-orange-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800">
                This work order requires your approval
                {workOrder.approvalThreshold && (
                  <span> (threshold: {formatCurrency(workOrder.approvalThreshold)})</span>
                )}
              </p>
              <p className="text-xs text-orange-600 mt-0.5">
                Estimated cost: {formatCurrency(workOrder.estimatedCost || 0)} •{' '}
                {workOrder.category} • {workOrder.priority} Priority
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 flex-shrink-0 px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Building2 className="h-4 w-4" />
                    <span className="text-sm">Property</span>
                  </div>
                  <p className="font-medium text-gray-900">
                    {workOrder.property?.name || 'N/A'}
                  </p>
                  {workOrder.unit && (
                    <p className="text-sm text-gray-500">
                      Unit {workOrder.unit.unitNumber}
                    </p>
                  )}
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Wrench className="h-4 w-4" />
                    <span className="text-sm">Category</span>
                  </div>
                  <p className="font-medium text-gray-900">{workOrder.category}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">Reported</span>
                  </div>
                  <p className="font-medium text-gray-900">
                    {formatDate(workOrder.reportedAt || workOrder.createdAt || '')}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-sm">Cost</span>
                  </div>
                  <p className="font-medium text-gray-900">
                    {workOrder.actualCost
                      ? formatCurrency(workOrder.actualCost)
                      : workOrder.estimatedCost
                      ? `Est. ${formatCurrency(workOrder.estimatedCost)}`
                      : 'TBD'}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-2">Description</h3>
                <p className="text-gray-600">{workOrder.description}</p>
              </div>

              {/* Reported By */}
              {(workOrder.customer || workOrder.tenant) && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Reported By</h3>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {workOrder.customer?.name || workOrder.tenant?.name}
                      </p>
                      {workOrder.customer?.phone && (
                        <p className="text-sm text-gray-500">
                          {workOrder.customer.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Assigned Vendor */}
              {workOrder.vendor && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">
                    Assigned Vendor
                  </h3>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Wrench className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {workOrder.vendor.name}
                      </p>
                      {workOrder.vendor.phone && (
                        <p className="text-sm text-gray-500">
                          {workOrder.vendor.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div className="space-y-1">
              {workOrder.timeline.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No timeline events yet</p>
                </div>
              ) : (
                workOrder.timeline.map((event, index) => (
                  <div key={event.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          event.action.includes('Completed') || event.action.includes('Approved')
                            ? 'bg-green-100'
                            : event.action.includes('Rejected')
                            ? 'bg-red-100'
                            : event.action.includes('Submitted') || event.action.includes('Manager')
                            ? 'bg-blue-100'
                            : 'bg-gray-100'
                        }`}
                      >
                        {event.action.includes('Completed') || event.action.includes('Approved') ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : event.action.includes('Rejected') ? (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        ) : (
                          <Clock className="h-4 w-4 text-gray-500" />
                        )}
                      </div>
                      {index < workOrder.timeline.length - 1 && (
                        <div className="w-px h-full bg-gray-200 my-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-6">
                      <p className="font-medium text-gray-900">{event.action}</p>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {event.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <span>
                          {formatDateTime(event.timestamp)}
                        </span>
                        {event.user && (
                          <>
                            <span>•</span>
                            <span>{event.user}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Evidence Tab */}
          {activeTab === 'evidence' && (
            <div className="space-y-4">
              {workOrder.evidence.length === 0 ? (
                <div className="text-center py-8">
                  <Camera className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No evidence attached yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {workOrder.evidence.map((item) => (
                    <div
                      key={item.id}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      <div className="relative">
                        <img
                          src={item.url}
                          alt={item.caption || item.description || ''}
                          className="w-full h-40 object-cover"
                        />
                        {item.type && (
                          <span
                            className={`absolute top-2 left-2 px-2 py-0.5 text-xs font-medium rounded-full ${
                              item.type === 'before'
                                ? 'bg-yellow-100 text-yellow-700'
                                : item.type === 'after'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm text-gray-900">
                          {item.caption || item.description || 'Photo'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(item.uploadedAt || item.timestamp || '')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cost Analysis Tab (for approvals) */}
          {activeTab === 'costs' && showApproval && (
            <div className="space-y-6">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-medium text-orange-800 mb-3">Cost Summary</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-white rounded-lg">
                    <p className="text-xs text-gray-500">Estimated Cost</p>
                    <p className="text-xl font-bold text-gray-900">
                      {formatCurrency(workOrder.estimatedCost || 0)}
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-lg">
                    <p className="text-xs text-gray-500">Approval Threshold</p>
                    <p className="text-xl font-bold text-gray-900">
                      {workOrder.approvalThreshold
                        ? formatCurrency(workOrder.approvalThreshold)
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3">Cost Justification</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Labor</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency((workOrder.estimatedCost || 0) * 0.4)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Parts & Materials</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency((workOrder.estimatedCost || 0) * 0.45)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Service Fee</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency((workOrder.estimatedCost || 0) * 0.15)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="text-sm font-medium text-blue-800">Total</span>
                    <span className="font-bold text-blue-800">
                      {formatCurrency(workOrder.estimatedCost || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {workOrder.vendor && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Vendor Details</h4>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Wrench className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{workOrder.vendor.name}</p>
                      {workOrder.vendor.phone && (
                        <p className="text-sm text-gray-500">{workOrder.vendor.phone}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with approval actions */}
        {showApproval && (
          <div className="border-t border-gray-200 p-4 flex-shrink-0">
            {showRejectForm ? (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Reason for rejection <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Please provide a reason for rejecting this work order..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    rows={3}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowRejectForm(false);
                      setRejectReason('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={rejecting || !rejectReason.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {rejecting && <Loader2 className="h-4 w-4 animate-spin" />}
                    <ThumbsDown className="h-4 w-4" />
                    Confirm Rejection
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Optional comment */}
                <div>
                  <input
                    type="text"
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    placeholder="Add a comment (optional)..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-orange-700 bg-orange-50 px-3 py-2 rounded-lg">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Cost: {formatCurrency(workOrder.estimatedCost || 0)}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowRejectForm(true)}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                    >
                      <ThumbsDown className="h-4 w-4" />
                      Reject
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={approving}
                      className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                    >
                      {approving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ThumbsUp className="h-4 w-4" />
                      )}
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
