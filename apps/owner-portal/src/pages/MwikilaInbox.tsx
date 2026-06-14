/**
 * Mr. Mwikila inbox page — owner cockpit's "Acting on your behalf"
 * surface.
 *
 * Lists every autonomous action (proposed / executed / blocked /
 * reversed) the brain has surfaced for the owner. Provides:
 *   - One-tap approve / deny for T0/T1 proposals
 *   - Reversal-window countdown + reverse button for T2 executions
 *   - Bilingual summary toggle (sw / en) — defaults to sw
 *   - Filter chips by status + category
 *
 * Reads /api/v1/owner/mwikila-inbox (paginated { data, meta }) + writes
 * via POST /api/v1/owner/mwikila-inbox/:id/{approve,deny,reverse}.
 *
 * The gateway backs this surface with `sovereign_approvals`, so the raw
 * row shape (status enum, field names) differs from this page's view
 * model. `normaliseRow` maps a gateway row onto InboxRow so the render
 * path stays stable regardless of the backing store.
 *
 * Built for Vite + the owner-portal's lib/api wrapper.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, ShieldAlert, Clock } from 'lucide-react';
import { api } from '../lib/api';

const STATUSES = [
  'proposed',
  'owner_approved',
  'owner_denied',
  'executed',
  'reversed',
  'committed',
  'blocked_by_inviolable',
  'expired',
] as const;
type ActionStatus = (typeof STATUSES)[number];

const CATEGORIES = [
  'rent-scheduling',
  'regulatory-filings',
  'lease-renewals',
  'payroll-prep',
  'listing-counter-offers',
  'maintenance-approvals-low-value',
  'tenant-communications',
  'evictions-initial-notice',
  'capex',
  'inventory',
  'marketplace-listings',
  'contractor-engagement',
] as const;
type Category = (typeof CATEGORIES)[number];

interface InboxRow {
  readonly id: string;
  readonly actionKind: string;
  readonly category: Category;
  readonly delegationTier: 'T0' | 'T1' | 'T2' | 'T3';
  readonly status: ActionStatus;
  readonly summary: string;
  readonly summarySw: string;
  readonly rationale: string;
  readonly reversalToken: string | null;
  readonly reversalUntil: string | null;
  readonly proposedAt: string;
  readonly executedAt: string | null;
  readonly blockedReason: string | null;
}

/**
 * Raw row shape the gateway returns from GET /owner/mwikila-inbox. It is
 * sourced from `sovereign_approvals`, so its status vocabulary and field
 * names differ from this page's InboxRow view model.
 */
interface GatewayInboxRow {
  readonly id: string;
  readonly summary: string | null;
  readonly summarySw: string | null;
  readonly summaryEn: string | null;
  readonly category: string | null;
  readonly delegationTier: 'T0' | 'T1' | 'T2' | 'T3';
  readonly status: string;
  readonly toolName: string | null;
  readonly proposedAt: string | null;
  readonly expiresAt: string | null;
  readonly payload: Record<string, unknown> | null;
}

// Map the gateway's sovereign-approval status onto this page's lifecycle.
const GATEWAY_STATUS_MAP: Record<string, ActionStatus> = {
  pending: 'proposed',
  'one-eye': 'proposed',
  approved: 'owner_approved',
  rejected: 'owner_denied',
  expired: 'expired',
};

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Project a gateway row onto the InboxRow the render path expects. Unknown
 * categories fall through as-is; missing summaries degrade to empty strings
 * so the card still renders.
 */
function normaliseRow(raw: GatewayInboxRow): InboxRow {
  const payload = raw.payload ?? {};
  const status = GATEWAY_STATUS_MAP[raw.status] ?? 'proposed';
  const reversalToken = asString(payload.reversalToken);
  const reversalUntil = asString(payload.reversalUntil);
  return {
    id: raw.id,
    actionKind: raw.toolName ?? '',
    category: (raw.category ?? '') as Category,
    delegationTier: raw.delegationTier,
    status,
    summary: raw.summaryEn ?? raw.summary ?? '',
    summarySw: raw.summarySw ?? raw.summary ?? '',
    rationale: asString(payload.rationale) ?? '',
    reversalToken,
    reversalUntil,
    proposedAt: raw.proposedAt ?? '',
    executedAt: asString(payload.executedAt),
    blockedReason: asString(payload.blockedReason),
  };
}

function formatCountdown(untilIso: string | null, nowMs: number): string {
  if (untilIso === null) return '';
  const remainingMs = Math.max(0, new Date(untilIso).getTime() - nowMs);
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs / 1000) % 60);
  if (remainingMs === 0) return '0:00';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${seconds.toString().padStart(2, '0')}`;
}

const STATUS_COLOR: Record<ActionStatus, string> = {
  proposed: 'bg-blue-500/10 text-blue-700 border-blue-500/40',
  owner_approved: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/40',
  owner_denied: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/40',
  executed: 'bg-amber-500/10 text-amber-700 border-amber-500/40',
  reversed: 'bg-purple-500/10 text-purple-700 border-purple-500/40',
  committed: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/40',
  blocked_by_inviolable: 'bg-red-500/10 text-red-700 border-red-500/40',
  expired: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/40',
};

interface MwikilaInboxProps {
  readonly languagePreference?: 'sw' | 'en';
}

export default function MwikilaInbox({
  languagePreference = 'sw',
}: MwikilaInboxProps): JSX.Element {
  const [rows, setRows] = useState<ReadonlyArray<InboxRow>>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ActionStatus | 'all'>(
    'all',
  );
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const sw = languagePreference === 'sw';

  const refresh = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.get<ReadonlyArray<GatewayInboxRow>>(
        '/owner/mwikila-inbox',
      );
      if (res.success && Array.isArray(res.data)) {
        setRows(res.data.map(normaliseRow));
      } else {
        setErrorMsg(res.error?.message ?? 'Failed to load inbox');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [refresh]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      return true;
    });
  }, [rows, statusFilter, categoryFilter]);

  const onApprove = useCallback(
    async (id: string) => {
      await api.post(`/owner/mwikila-inbox/${id}/approve`);
      await refresh();
    },
    [refresh],
  );

  const onDeny = useCallback(
    async (id: string) => {
      await api.post(`/owner/mwikila-inbox/${id}/deny`);
      await refresh();
    },
    [refresh],
  );

  const onReverse = useCallback(
    async (row: InboxRow) => {
      if (row.reversalToken === null) return;
      await api.post(`/owner/mwikila-inbox/${row.id}/reverse`, {
        reversalToken: row.reversalToken,
      });
      await refresh();
    },
    [refresh],
  );

  return (
    <div className="flex w-full flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">
          {sw ? 'Mr. Mwikila — Inavyochukua hatua' : "Mr. Mwikila — Acting on your behalf"}
        </h1>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          {sw ? 'Onyesha upya' : 'Refresh'}
        </button>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          {sw ? 'Hali:' : 'Status:'}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ActionStatus | 'all')}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm"
          >
            <option value="all">{sw ? 'Yote' : 'All'}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          {sw ? 'Kategoria:' : 'Category:'}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as Category | 'all')}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm"
          >
            <option value="all">{sw ? 'Yote' : 'All'}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {errorMsg !== null && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="text-sm text-zinc-500">
          {sw ? 'Inapakia…' : 'Loading…'}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
          {sw
            ? 'Hakuna hatua zilizoshughulikiwa kwa sasa.'
            : 'No actions to review right now.'}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((row) => {
            const reversalCountdown =
              row.status === 'executed' && row.reversalUntil !== null
                ? formatCountdown(row.reversalUntil, nowMs)
                : null;
            const summary = sw ? row.summarySw : row.summary;
            return (
              <li
                key={row.id}
                className="rounded border border-zinc-200 bg-white p-4 shadow-sm"
                data-testid="mwikila-inbox-row"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded border px-2 py-0.5 text-xs ${
                          STATUS_COLOR[row.status]
                        }`}
                      >
                        {row.status}
                      </span>
                      <span className="rounded border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700">
                        {row.delegationTier}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {row.category}
                      </span>
                      {reversalCountdown !== null && (
                        <span className="flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                          <Clock className="h-3 w-3" />
                          {reversalCountdown}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 font-medium text-zinc-900">{summary}</h3>
                    <p className="mt-1 text-sm text-zinc-600">{row.rationale}</p>
                    {row.blockedReason !== null && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-red-700">
                        <ShieldAlert className="h-4 w-4" />
                        {row.blockedReason}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    {row.status === 'proposed' && (
                      <>
                        <button
                          type="button"
                          onClick={() => void onApprove(row.id)}
                          className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                          data-testid="mwikila-approve"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {sw ? 'Idhinisha' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeny(row.id)}
                          className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                          data-testid="mwikila-deny"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {sw ? 'Kataa' : 'Deny'}
                        </button>
                      </>
                    )}
                    {row.status === 'executed' && row.reversalToken !== null && (
                      <button
                        type="button"
                        onClick={() => void onReverse(row)}
                        className="inline-flex items-center gap-1 rounded border border-amber-500 bg-amber-50 px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-100"
                        data-testid="mwikila-reverse"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {sw ? 'Tendua' : 'Reverse'}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
