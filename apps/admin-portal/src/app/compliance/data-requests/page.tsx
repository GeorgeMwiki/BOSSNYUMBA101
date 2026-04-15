/**
 * DataSubjectRequestsPage — GDPR-style data subject requests (access, erasure, export).
 *
 * Assumed backend endpoints:
 *   GET  /compliance/data-requests?status=<any|open|in_progress|fulfilled|rejected>&type=<any|access|erasure|export|rectification>
 *        -> { data: { items: DataRequest[], total: number } }
 *   POST /compliance/data-requests/:id/advance  (body: { status: DsrStatus, note?: string })
 *
 * The api client normalizes responses to { success, data }.
 */
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { api, formatDateTime } from '../../../lib/api';

type DsrStatus = 'open' | 'in_progress' | 'fulfilled' | 'rejected';
type DsrType = 'access' | 'erasure' | 'export' | 'rectification';

interface DataRequest {
  id: string;
  referenceCode: string;
  subjectEmail: string;
  tenant: string;
  type: DsrType;
  status: DsrStatus;
  submittedAt: string;
  dueAt: string;
  ageDays: number;
}

interface DataRequestsResponse {
  items: DataRequest[];
  total: number;
}

const statusBadge: Record<DsrStatus, string> = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  fulfilled: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const typeBadge: Record<DsrType, string> = {
  access: 'bg-indigo-100 text-indigo-700',
  erasure: 'bg-red-100 text-red-700',
  export: 'bg-violet-100 text-violet-700',
  rectification: 'bg-emerald-100 text-emerald-700',
};

export default function DataSubjectRequestsPage() {
  const [items, setItems] = useState<DataRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'any' | DsrStatus>('any');
  const [typeFilter, setTypeFilter] = useState<'any' | DsrType>('any');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  const fetchRequests = useCallback(() => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ status: statusFilter, type: typeFilter });
    api
      .get<DataRequestsResponse>(`/compliance/data-requests?${qs.toString()}`)
      .then((res) => {
        if (res.success && res.data) {
          setItems(res.data.items);
          setTotal(res.data.total);
        } else {
          setError(res.error ?? 'Failed to load data requests.');
          setItems([]);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleFulfill = async (req: DataRequest) => {
    const note = window.prompt(`Mark ${req.referenceCode} as fulfilled? Optional note:`, '');
    if (note === null) return;
    setAdvancingId(req.id);
    const res = await api.post(`/compliance/data-requests/${req.id}/advance`, {
      status: 'fulfilled',
      note,
    });
    setAdvancingId(null);
    if (res.success) {
      fetchRequests();
    } else {
      setError(res.error ?? 'Failed to update request.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Subject Requests</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total.toLocaleString()} request{total === 1 ? '' : 's'} matching current filters.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchRequests}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          aria-label="Refresh requests"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'any' | DsrStatus)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="any">Any status</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'any' | DsrType)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="any">Any type</option>
          <option value="access">Access</option>
          <option value="erasure">Erasure</option>
          <option value="export">Export</option>
          <option value="rectification">Rectification</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 bg-white rounded-xl border border-gray-200">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <p className="text-gray-600">{error}</p>
          <button
            type="button"
            onClick={fetchRequests}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white rounded-xl border border-gray-200">
          <ShieldAlert className="h-10 w-10 text-gray-300" />
          <p className="text-gray-500">No data subject requests match the filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Subject / Tenant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Age</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Due</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.referenceCode}</div>
                    <div className="text-xs text-gray-500">{formatDateTime(r.submittedAt)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{r.subjectEmail}</div>
                    <div className="text-xs text-gray-500">{r.tenant}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${typeBadge[r.type]}`}>
                      {r.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${statusBadge[r.status]}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{r.ageDays}d</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(r.dueAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleFulfill(r)}
                      disabled={
                        advancingId === r.id ||
                        r.status === 'fulfilled' ||
                        r.status === 'rejected'
                      }
                      className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 disabled:text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 rounded px-2 py-1"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {advancingId === r.id ? 'Saving...' : 'Fulfill'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
