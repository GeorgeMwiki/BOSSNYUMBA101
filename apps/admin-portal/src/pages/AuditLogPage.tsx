import React, { useMemo, useState } from 'react';
import {
  FileText,
  Search,
  Download,
  Clock,
  ChevronDown,
  ChevronRight,
  Shield,
  Settings,
  UserPlus,
  Edit,
  Trash2,
  LogIn,
  LogOut,
  CreditCard,
  Building2,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { formatDateTime } from '../lib/api';
import {
  auditEventsToCsv,
  useAuditEvents,
  useExportAuditEvents,
  type AuditEvent,
  type AuditQuery,
} from '../lib/api/audit';
import { useToast } from '../components/ui/Toast';

const actionIcons: Record<string, React.ElementType> = {
  'user.login': LogIn,
  'user.logout': LogOut,
  'user.created': UserPlus,
  'user.updated': Edit,
  'user.deleted': Trash2,
  'role.updated': Shield,
  'settings.updated': Settings,
  'payment.processed': CreditCard,
  'tenant.created': Building2,
  default: FileText,
};

const actionColors: Record<string, { bg: string; text: string }> = {
  created: { bg: 'bg-green-100', text: 'text-green-700' },
  updated: { bg: 'bg-blue-100', text: 'text-blue-700' },
  deleted: { bg: 'bg-red-100', text: 'text-red-700' },
  login: { bg: 'bg-gray-100', text: 'text-gray-700' },
  logout: { bg: 'bg-gray-100', text: 'text-gray-700' },
  processed: { bg: 'bg-green-100', text: 'text-green-700' },
  failed: { bg: 'bg-red-100', text: 'text-red-700' },
};

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

function getDefaultRange(preset: string): { from?: string; to?: string } {
  const now = new Date();
  const to = now.toISOString();
  if (preset === 'custom') return {};
  let fromDate = new Date(now);
  switch (preset) {
    case 'today':
      fromDate.setHours(0, 0, 0, 0);
      break;
    case 'last7':
      fromDate.setDate(now.getDate() - 7);
      break;
    case 'last30':
      fromDate.setDate(now.getDate() - 30);
      break;
    case 'last90':
      fromDate.setDate(now.getDate() - 90);
      break;
    default:
      return {};
  }
  return { from: fromDate.toISOString(), to };
}

export function AuditLogPage() {
  const toast = useToast();
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [datePreset, setDatePreset] = useState('last7');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [sort, setSort] = useState<'timestamp_desc' | 'timestamp_asc'>('timestamp_desc');

  const query: AuditQuery = useMemo(() => {
    const range = datePreset === 'custom'
      ? { from: customFrom || undefined, to: customTo || undefined }
      : getDefaultRange(datePreset);
    return {
      actor: actor || undefined,
      action: action || search || undefined,
      entity: entity || undefined,
      from: range.from,
      to: range.to,
      page,
      pageSize,
      sort,
    };
  }, [actor, action, entity, search, datePreset, customFrom, customTo, page, pageSize, sort]);

  const { data, isLoading, isError, error, isFetching, refetch } = useAuditEvents(query);
  const exportMutation = useExportAuditEvents();

  const events = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleExport = async () => {
    try {
      let rows: AuditEvent[];
      try {
        rows = await exportMutation.mutateAsync(query);
      } catch {
        // Server export not available; fall back to the current page's events.
        rows = events;
      }
      const csv = auditEventsToCsv(rows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} events`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const getActionType = (a: string) => {
    const parts = a.split('.');
    return parts[parts.length - 1];
  };

  const getActionIcon = (a: string) => actionIcons[a] || actionIcons.default;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-gray-500">Track all system activities and changes</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={exportMutation.isPending || events.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <input
            type="text"
            placeholder="Actor (email or name)"
            value={actor}
            onChange={(e) => { setActor(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <input
            type="text"
            placeholder="Action (e.g. user.created)"
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <input
            type="text"
            placeholder="Entity / resource type"
            value={entity}
            onChange={(e) => { setEntity(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
          <label className="text-sm text-gray-600">Date range</label>
          <select
            value={datePreset}
            onChange={(e) => { setDatePreset(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
          >
            <option value="today">Today</option>
            <option value="last7">Last 7 days</option>
            <option value="last30">Last 30 days</option>
            <option value="last90">Last 90 days</option>
            <option value="custom">Custom</option>
          </select>
          {datePreset === 'custom' && (
            <>
              <input
                type="datetime-local"
                value={customFrom}
                onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="datetime-local"
                value={customTo}
                onChange={(e) => { setCustomTo(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
              />
            </>
          )}
          <div className="sm:ml-auto flex items-center gap-2">
            <label className="text-sm text-gray-600">Sort</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'timestamp_desc' | 'timestamp_asc')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
            >
              <option value="timestamp_desc">Newest first</option>
              <option value="timestamp_asc">Oldest first</option>
            </select>
          </div>
        </div>
      </div>

      {/* States */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 text-violet-600 animate-spin" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Failed to load audit events</p>
            <p className="text-sm text-red-700 mt-1">{(error as Error)?.message}</p>
          </div>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Event List */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {events.map((event) => {
                const ActionIcon = getActionIcon(event.action);
                const actionType = getActionType(event.action);
                const actionColor = actionColors[actionType] || actionColors.updated;
                const isExpanded = expandedEvent === event.id;

                return (
                  <div key={event.id} className="hover:bg-gray-50">
                    <button
                      onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                      className="w-full p-4 text-left"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${actionColor.bg}`}>
                          <ActionIcon className={`h-4 w-4 ${actionColor.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-gray-900">
                              {event.action.replace('.', ' › ')}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${actionColor.bg} ${actionColor.text}`}>
                              {actionType}
                            </span>
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                              {event.category}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">{event.actor.name}</span>
                            {' • '}
                            {event.resource.name}
                            {event.tenant && (
                              <>
                                {' • '}
                                <span className="text-violet-600">{event.tenant}</span>
                              </>
                            )}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDateTime(event.timestamp)}
                            </span>
                            <span>{event.ipAddress}</span>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0">
                        <div className="ml-10 p-4 bg-gray-50 rounded-lg space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Actor</p>
                              <p className="text-sm font-medium text-gray-900">{event.actor.name}</p>
                              <p className="text-xs text-gray-500">{event.actor.email}</p>
                              <p className="text-xs text-violet-600">{event.actor.role}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Resource</p>
                              <p className="text-sm font-medium text-gray-900">{event.resource.name}</p>
                              <p className="text-xs text-gray-500">Type: {event.resource.type}</p>
                              <p className="text-xs text-gray-500">ID: {event.resource.id}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Details</p>
                            <pre className="text-xs text-gray-700 bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                              {JSON.stringify(event.details, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">User Agent</p>
                            <p className="text-xs text-gray-600 break-all">{event.userAgent}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {events.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                <FileText className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p>No audit events found for the current filters.</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <p className="text-gray-500">
              Showing {events.length === 0 ? 0 : (page - 1) * pageSize + 1}
              {events.length > 0 && `–${(page - 1) * pageSize + events.length}`} of {total}
            </p>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n} per page</option>
                ))}
              </select>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isFetching}
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Prev
              </button>
              <span className="text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isFetching}
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
