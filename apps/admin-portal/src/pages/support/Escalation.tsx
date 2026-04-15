/**
 * Escalation — queue of escalated support tickets.
 *
 * Assumed backend endpoints:
 *   GET  /support/escalations?status=<open|resolved|all>&priority=<any|p1|p2|p3>
 *        -> { data: { items: Escalation[], total: number } }
 *   POST /support/escalations/:id/resolve       (body: { note: string })
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Flame, RefreshCw } from 'lucide-react';
import { api, formatDateTime } from '../../lib/api';

type EscalationStatus = 'open' | 'in_review' | 'resolved';
type Priority = 'p1' | 'p2' | 'p3';

interface Escalation {
  id: string;
  ticketNumber: string;
  subject: string;
  tenant: string;
  customer: string;
  priority: Priority;
  status: EscalationStatus;
  assignee?: string;
  ageHours: number;
  openedAt: string;
}

interface EscalationListResponse {
  items: Escalation[];
  total: number;
}

const priorityBadge: Record<Priority, string> = {
  p1: 'bg-red-100 text-red-700',
  p2: 'bg-amber-100 text-amber-700',
  p3: 'bg-blue-100 text-blue-700',
};

const statusBadge: Record<EscalationStatus, string> = {
  open: 'bg-red-100 text-red-700',
  in_review: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
};

export default function Escalation() {
  const [items, setItems] = useState<Escalation[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [priorityFilter, setPriorityFilter] = useState<'any' | Priority>('any');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchEscalations = useCallback(() => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({
      status: statusFilter,
      priority: priorityFilter,
    });
    api
      .get<EscalationListResponse>(`/support/escalations?${qs.toString()}`)
      .then((res) => {
        if (res.success && res.data) {
          setItems(res.data.items);
          setTotal(res.data.total);
        } else {
          setError(res.error ?? 'Failed to load escalations.');
          setItems([]);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    fetchEscalations();
  }, [fetchEscalations]);

  const handleResolve = async (esc: Escalation) => {
    const note = window.prompt(`Resolve ${esc.ticketNumber}? Add a resolution note:`);
    if (!note) return;
    setResolving(esc.id);
    const res = await api.post(`/support/escalations/${esc.id}/resolve`, { note });
    setResolving(null);
    if (res.success) {
      fetchEscalations();
    } else {
      setError(res.error ?? 'Failed to resolve escalation.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Escalations</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total.toLocaleString()} ticket{total === 1 ? '' : 's'} matching current filters.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchEscalations}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          aria-label="Refresh escalations"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'open' | 'resolved' | 'all')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as 'any' | Priority)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="any">Any priority</option>
          <option value="p1">P1 - Critical</option>
          <option value="p2">P2 - High</option>
          <option value="p3">P3 - Normal</option>
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
            onClick={fetchEscalations}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 bg-white rounded-xl border border-gray-200">
          <Flame className="h-10 w-10 text-gray-300" />
          <p className="text-gray-500">No escalations match the current filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ticket</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tenant / Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Age</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Opened</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((esc) => (
                <tr key={esc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{esc.ticketNumber}</div>
                    <div className="text-xs text-gray-500 truncate max-w-xs">{esc.subject}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{esc.tenant}</div>
                    <div className="text-xs text-gray-500">{esc.customer}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full uppercase ${priorityBadge[esc.priority]}`}>
                      {esc.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${statusBadge[esc.status]}`}>
                      {esc.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-700">{esc.ageHours}h</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(esc.openedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleResolve(esc)}
                      disabled={resolving === esc.id || esc.status === 'resolved'}
                      className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 disabled:text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 rounded px-2 py-1"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {resolving === esc.id ? 'Resolving...' : 'Resolve'}
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
