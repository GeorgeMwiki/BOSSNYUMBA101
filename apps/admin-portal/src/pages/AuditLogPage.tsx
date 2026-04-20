/**
 * Audit log — hits the real `/api/v1/audit/autonomous-actions` endpoint.
 *
 * Wave 15 — replaces the previous hardcoded mock feed. No stub data is
 * shipped to the browser; the page renders an explicit empty state if
 * the server returns nothing.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Search, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { EmptyState } from '@bossnyumba/design-system';
import { useTranslations } from 'next-intl';
import { api, formatDateTime } from '../lib/api';

interface AutonomousAuditRow {
  readonly id: string;
  readonly domain: string;
  readonly actionType: string;
  readonly subjectId?: string;
  readonly reasoning: string;
  readonly confidence: number;
  readonly policyRuleId?: string;
  readonly executedAt: string;
  readonly actor?: string;
  readonly outcome?: string;
  readonly metadata?: Record<string, unknown>;
}

const DOMAINS = [
  'finance',
  'leasing',
  'maintenance',
  'compliance',
  'communications',
  'strategic',
] as const;

export function AuditLogPage() {
  const t = useTranslations('auditLog');
  const [rows, setRows] = useState<readonly AutonomousAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = domain === 'all' ? '' : `?domain=${encodeURIComponent(domain)}`;
    const res = await api.get<readonly AutonomousAuditRow[]>(
      `/audit/autonomous-actions${qs}`,
    );
    if (res.success && res.data) setRows(res.data);
    else setError(res.error ?? t('errorLoad'));
    setLoading(false);
  }, [domain, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const needle = search.toLowerCase();
    return (
      r.actionType.toLowerCase().includes(needle) ||
      r.domain.toLowerCase().includes(needle) ||
      r.reasoning.toLowerCase().includes(needle) ||
      (r.subjectId ?? '').toLowerCase().includes(needle)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500">
            {t('subtitle')}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value="all">{t('allDomains')}</option>
          {DOMAINS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('loadingTrail')}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {filtered.map((row) => {
              const open = expanded === row.id;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : row.id)}
                    className="w-full p-4 text-left hover:bg-gray-50"
                    aria-expanded={open}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {open ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-semibold text-gray-900">
                            {row.domain} · {row.actionType}
                          </span>
                          <span className="text-xs text-violet-600 bg-violet-50 rounded px-2">
                            {t('confShort', { percent: (row.confidence * 100).toFixed(0) })}
                          </span>
                          {row.outcome && (
                            <span className="text-xs text-gray-500">{row.outcome}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{row.reasoning}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDateTime(row.executedAt)}
                          {row.subjectId ? ` · ${t('subjectLabel')} ${row.subjectId}` : ''}
                          {row.policyRuleId ? ` · ${t('ruleLabel')} ${row.policyRuleId}` : ''}
                        </p>
                      </div>
                    </div>
                  </button>
                  {open && row.metadata && (
                    <pre className="mx-4 mb-4 text-xs bg-gray-50 rounded p-3 border border-gray-200 overflow-x-auto">
                      {JSON.stringify(row.metadata, null, 2)}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
