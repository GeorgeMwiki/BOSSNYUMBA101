'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { workOrdersService, feedbackService } from '@bossnyumba/api-client';
import {
  AlertTriangle,
  RefreshCw,
  ArrowUpCircle,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export default function Escalation() {
  const {
    data: workOrders,
    isLoading: loadingWO,
    error: woError,
  } = useQuery({
    queryKey: ['admin-escalation-wo'],
    queryFn: async () => {
      const res = await workOrdersService.list({ slaBreached: true });
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load escalated work orders');
    },
    staleTime: 30_000,
  });

  const {
    data: feedback,
    isLoading: loadingFeedback,
    error: feedbackError,
  } = useQuery({
    queryKey: ['admin-escalation-feedback'],
    queryFn: async () => {
      const res = await feedbackService.list({ priority: 'URGENT' });
      if (res.success && res.data) return res.data;
      throw new Error(res.error?.message || 'Failed to load escalated feedback');
    },
    staleTime: 30_000,
  });

  const isLoading = loadingWO || loadingFeedback;
  const error = woError || feedbackError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-violet-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Escalation Data Unavailable</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">
          {error instanceof Error ? error.message : 'Unable to load escalation data.'}
        </p>
      </div>
    );
  }

  const woList = Array.isArray(workOrders) ? workOrders : [];
  const feedbackList = Array.isArray(feedback) ? feedback : [];

  const criticalWO = woList.filter((w: any) => w.priority === 'EMERGENCY' || w.priority === 'HIGH');
  const openFeedback = feedbackList.filter((f: any) => f.status === 'OPEN' || f.status === 'IN_PROGRESS');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Escalation</h1>
        <p className="text-sm text-gray-500 mt-1">SLA-breached work orders and urgent feedback requiring escalation</p>
      </div>

      {/* Escalation Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-red-100 rounded-lg w-fit">
            <ArrowUpCircle className="h-5 w-5 text-red-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{woList.length}</p>
            <p className="text-sm text-gray-500">SLA-Breached Work Orders</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-amber-100 rounded-lg w-fit">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{criticalWO.length}</p>
            <p className="text-sm text-gray-500">Critical Priority</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-violet-100 rounded-lg w-fit">
            <Clock className="h-5 w-5 text-violet-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{feedbackList.length}</p>
            <p className="text-sm text-gray-500">Urgent Feedback</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 bg-blue-100 rounded-lg w-fit">
            <CheckCircle className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-4">
            <p className="text-2xl font-bold text-gray-900">{openFeedback.length}</p>
            <p className="text-sm text-gray-500">Open Escalations</p>
          </div>
        </div>
      </div>

      {/* Breached Work Orders Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">SLA-Breached Work Orders</h3>
        </div>
        {woList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No SLA-breached work orders</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {woList.slice(0, 15).map((wo: any) => (
                <tr key={wo.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{wo.number || wo.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{wo.title || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      wo.priority === 'EMERGENCY' ? 'bg-red-100 text-red-700' :
                      wo.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {wo.priority || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      wo.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                      wo.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {wo.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {wo.createdAt ? new Date(wo.createdAt).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Urgent Feedback Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Urgent Feedback</h3>
        </div>
        {feedbackList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No urgent feedback items</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {feedbackList.slice(0, 10).map((fb: any) => (
                <tr key={fb.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{fb.subject || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{fb.type || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      fb.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                      fb.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {fb.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {fb.createdAt ? new Date(fb.createdAt).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
