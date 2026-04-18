import React, { useState } from 'react';
import {
  CheckSquare,
  Check,
  X,
  Clock,
  AlertCircle,
  User,
  Wrench,
  DollarSign,
} from 'lucide-react';
import { Skeleton, EmptyState, Alert, AlertDescription, Button } from '@bossnyumba/design-system';
import { formatDate } from '../lib/api';
import { useApprovals, useApproveRequest, useRejectRequest } from '../lib/hooks';

export function ApprovalsPage() {
  const { data: approvals = [], isLoading: loading, error, refetch } = useApprovals();
  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();
  const [filter, setFilter] = useState<string>('PENDING');

  const handleApprove = (id: string) => approveMutation.mutate({ id });
  const handleReject = (id: string) => rejectMutation.mutate({ id });

  const filteredApprovals = approvals.filter((a) => {
    if (filter === 'all') return true;
    return a.status === filter;
  });

  const getTypeIcon = (type: string) => {
    if (type.includes('work_order')) return <Wrench className="h-5 w-5" />;
    if (type.includes('rent') || type.includes('payment'))
      return <DollarSign className="h-5 w-5" />;
    return <CheckSquare className="h-5 w-5" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-700';
      case 'REJECTED':
        return 'bg-red-100 text-red-700';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const pendingCount = approvals.filter((a) => a.status === 'PENDING').length;

  if (loading) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <AlertDescription>
          {error instanceof Error ? error.message : 'Failed to load approvals'}
          <Button size="sm" onClick={() => refetch?.()} className="ml-2">Retry</Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approvals</h1>
          <p className="text-gray-500">Review and approve pending requests</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
            <AlertCircle className="h-4 w-4" />
            {pendingCount} pending
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {['PENDING', 'APPROVED', 'REJECTED', 'all'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
              filter === status
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {status === 'all' ? 'All' : status}
          </button>
        ))}
      </div>

      {/* Approvals list */}
      <div className="space-y-4">
        {filteredApprovals.map((approval) => (
          <div
            key={approval.id}
            className="bg-white rounded-xl border border-gray-200 p-4"
          >
            <div className="flex items-start gap-4">
              <div
                className={`p-2 rounded-lg ${
                  approval.status === 'PENDING'
                    ? 'bg-yellow-100 text-yellow-600'
                    : approval.status === 'APPROVED'
                    ? 'bg-green-100 text-green-600'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                {getTypeIcon(approval.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {approval.type.replace(/_/g, ' ').replace(/\b\w/g, (l) =>
                        l.toUpperCase()
                      )}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {approval.justification || `Request to ${approval.requestedAction}`}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                      approval.status
                    )}`}
                  >
                    {approval.status}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    Requested by {approval.requester?.name || 'Unknown'}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatDate(approval.createdAt)}
                  </div>
                  {approval.decidedAt && approval.approver && (
                    <div className="flex items-center gap-1">
                      <Check className="h-4 w-4" />
                      Decided by {approval.approver.name}
                    </div>
                  )}
                </div>

                {approval.decision && (
                  <div className="mt-2 p-2 bg-gray-50 rounded-lg text-sm text-gray-600">
                    Decision: {approval.decision}
                  </div>
                )}

                {approval.status === 'PENDING' && (
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => handleApprove(approval.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(approval.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredApprovals.length === 0 && (
        <EmptyState
          icon={<CheckSquare className="h-8 w-8" />}
          title={`No ${filter === 'all' ? '' : filter.toLowerCase()} approvals`.trim()}
          description="When requests come in they'll appear here for review."
        />
      )}
    </div>
  );
}
