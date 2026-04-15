import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HeadphonesIcon,
  Search,
  Clock,
  User,
  Tag,
  AlertCircle,
  CheckCircle,
  XCircle,
  Send,
  Paperclip,
  Users,
  ArrowUp,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { formatDateTime } from '../lib/api';
import {
  useSupportTickets,
  useReplyToTicket,
  useEscalateTicket,
  type SupportStatus,
  type SupportTicket,
} from '../lib/api/support';
import { useToast } from '../components/ui/Toast';

const statusColors: Record<string, { bg: string; text: string }> = {
  open: { bg: 'bg-amber-100', text: 'text-amber-700' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700' },
  escalated: { bg: 'bg-red-100', text: 'text-red-700' },
  resolved: { bg: 'bg-green-100', text: 'text-green-700' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

const priorityColors: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-gray-100', text: 'text-gray-600' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-600' },
  high: { bg: 'bg-amber-100', text: 'text-amber-600' },
  critical: { bg: 'bg-red-100', text: 'text-red-600' },
};

export function SupportPage() {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [replyText, setReplyText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [nextStatus, setNextStatus] = useState<SupportStatus | ''>('');
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateLevel, setEscalateLevel] = useState(1);

  const { data, isLoading, isError, error, refetch, isFetching } = useSupportTickets({
    status: statusFilter === 'all' ? 'all' : (statusFilter as SupportStatus),
    search,
  });
  const replyMutation = useReplyToTicket();
  const escalateMutation = useEscalateTicket();

  const tickets = data?.items ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      const matchesSearch = !q ||
        t.subject.toLowerCase().includes(q) ||
        t.ticketNumber.toLowerCase().includes(q) ||
        t.tenant.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tickets, search, statusFilter]);

  const selectedCase = useMemo<SupportTicket | null>(
    () => tickets.find((t) => t.id === selectedId) ?? null,
    [tickets, selectedId],
  );

  const counts = useMemo(() => ({
    open: tickets.filter((t) => t.status === 'open').length,
    in_progress: tickets.filter((t) => t.status === 'in_progress').length,
    critical: tickets.filter((t) => t.priority === 'critical').length,
    resolvedToday: tickets.filter((t) => {
      if (t.status !== 'resolved') return false;
      const d = new Date(t.updatedAt);
      const today = new Date();
      return d.toDateString() === today.toDateString();
    }).length,
  }), [tickets]);

  const handleSendReply = async () => {
    if (!selectedCase || !replyText.trim()) return;
    try {
      await replyMutation.mutateAsync({
        ticketId: selectedCase.id,
        message: replyText.trim(),
        isInternal,
        status: nextStatus || undefined,
      });
      toast.success('Reply sent');
      setReplyText('');
      setIsInternal(false);
      setNextStatus('');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleEscalate = async () => {
    if (!selectedCase || !escalateReason.trim()) return;
    try {
      await escalateMutation.mutateAsync({
        id: selectedCase.id,
        level: escalateLevel,
        reason: escalateReason.trim(),
      });
      toast.success(`Escalated to level ${escalateLevel}`);
      setEscalateOpen(false);
      setEscalateReason('');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Center</h1>
          <p className="text-gray-500">Manage customer support tickets</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link to="/support/timeline" className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium">
            <Users className="h-4 w-4" />
            Customer Timeline
          </Link>
          <Link to="/support/escalation" className="flex items-center gap-2 px-4 py-2 text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 text-sm font-medium">
            <ArrowUp className="h-4 w-4" />
            Escalation Queue
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={AlertCircle} color="text-amber-600" label="Open" value={counts.open} />
        <StatCard icon={Clock} color="text-blue-600" label="In Progress" value={counts.in_progress} />
        <StatCard icon={XCircle} color="text-red-600" label="Critical" value={counts.critical} />
        <StatCard icon={CheckCircle} color="text-green-600" label="Resolved Today" value={counts.resolvedToday} />
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
          <p className="text-sm text-red-800">{(error as Error)?.message || 'Failed to load tickets'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cases List */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
            {isLoading && (
              <div className="p-8 flex justify-center">
                <RefreshCw className="h-5 w-5 text-violet-600 animate-spin" />
              </div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-gray-500">No tickets match the filters.</div>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${selectedId === c.id ? 'bg-violet-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500">{c.ticketNumber}</span>
                      <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${priorityColors[c.priority].bg} ${priorityColors[c.priority].text}`}>
                        {c.priority}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900 truncate">{c.subject}</p>
                    <p className="text-sm text-gray-500 truncate">{c.tenant}</p>
                  </div>
                  <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[c.status].bg} ${statusColors[c.status].text}`}>
                    {c.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-2">{formatDateTime(c.updatedAt)}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Case Detail */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {selectedCase ? (
            <>
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm text-gray-500">{selectedCase.ticketNumber}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[selectedCase.status].bg} ${statusColors[selectedCase.status].text}`}>
                        {selectedCase.status.replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${priorityColors[selectedCase.priority].bg} ${priorityColors[selectedCase.priority].text}`}>
                        {selectedCase.priority}
                      </span>
                      {selectedCase.escalationLevel > 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">
                          Level {selectedCase.escalationLevel}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">{selectedCase.subject}</h2>
                  </div>
                  <button
                    onClick={() => { setEscalateLevel(selectedCase.escalationLevel + 1); setEscalateOpen(true); }}
                    className="flex items-center gap-2 px-3 py-1.5 text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 text-sm font-medium"
                  >
                    <ArrowUp className="h-4 w-4" />
                    Escalate
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1"><User className="h-4 w-4" />{selectedCase.requester.name}</div>
                  <div className="flex items-center gap-1"><Tag className="h-4 w-4" />{selectedCase.category}</div>
                  <div className="flex items-center gap-1"><Clock className="h-4 w-4" />Created {formatDateTime(selectedCase.createdAt)}</div>
                </div>
              </div>

              <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700">{selectedCase.description}</p>
                </div>

                {selectedCase.messages.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No replies yet.</p>
                )}

                {selectedCase.messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.isInternal ? 'bg-amber-50 rounded-lg p-3' : ''}`}>
                    <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-violet-600">
                        {msg.sender.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 text-sm">{msg.sender}</span>
                        {msg.isInternal && (
                          <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Internal</span>
                        )}
                        <span className="text-xs text-gray-400">{formatDateTime(msg.timestamp)}</span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-gray-200">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                  rows={3}
                />
                <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Attach (coming soon)" disabled>
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                      />
                      Internal note
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value as SupportStatus | '')}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="">Keep status</option>
                      <option value="in_progress">Mark In Progress</option>
                      <option value="resolved">Mark Resolved</option>
                      <option value="closed">Close Ticket</option>
                    </select>
                    <button
                      onClick={handleSendReply}
                      disabled={!replyText.trim() || replyMutation.isPending}
                      className="flex items-center gap-2 px-4 py-1.5 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 disabled:opacity-50"
                    >
                      {replyMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <HeadphonesIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Select a ticket to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Escalation Modal */}
      {escalateOpen && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Escalate ticket</h2>
              <p className="text-sm text-gray-500">{selectedCase.ticketNumber} - {selectedCase.subject}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Escalation level</label>
                <select
                  value={escalateLevel}
                  onChange={(e) => setEscalateLevel(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>Level {n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  rows={3}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Why is this being escalated?"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setEscalateOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleEscalate}
                disabled={!escalateReason.trim() || escalateMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {escalateMutation.isPending ? 'Escalating...' : 'Escalate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value }: { icon: React.ElementType; color: string; label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className={`flex items-center gap-2 mb-2 ${color}`}>
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

