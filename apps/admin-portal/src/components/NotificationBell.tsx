/**
 * Notification bell for the admin-portal top nav.
 *
 * Pulls live counts from:
 *   - /exceptions (Wave-14 exception inbox: PROPOSED_ACTION rows pending approval)
 *   - /proactive-alerts (Wave-11 proactive alert engine: new insights)
 *
 * Re-fetches every 60s. Graceful degradation when either endpoint is down:
 * the bell falls back to 0 for the unavailable side rather than throwing.
 *
 * Immutability: counts are fresh state each tick — no mutation of prior arrays.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { api } from '../lib/api';

interface NotificationSummary {
  readonly pendingExceptions: number;
  readonly newInsights: number;
}

const REFRESH_MS = 60_000;

export function NotificationBell(): JSX.Element {
  const [summary, setSummary] = useState<NotificationSummary>({
    pendingExceptions: 0,
    newInsights: 0,
  });
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [exceptionsRes, insightsRes] = await Promise.all([
        api
          .get<readonly { status: string }[]>('/exceptions')
          .catch(() => ({ success: false, data: [] as readonly { status: string }[] })),
        api
          .get<readonly { acknowledged: boolean }[]>('/proactive-alerts')
          .catch(() => ({ success: false, data: [] as readonly { acknowledged: boolean }[] })),
      ]);
      const pendingExceptions =
        exceptionsRes.success && exceptionsRes.data
          ? exceptionsRes.data.filter((e) => e.status === 'open').length
          : 0;
      const newInsights =
        insightsRes.success && insightsRes.data
          ? insightsRes.data.filter((a) => !a.acknowledged).length
          : 0;
      setSummary({ pendingExceptions, newInsights });
    } catch (error) {
      // Non-fatal — keep last known counts.
      // eslint-disable-next-line no-console
      console.error('NotificationBell refresh failed:', error);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const total = summary.pendingExceptions + summary.newInsights;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications (${total} pending)`}
        className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
        onClick={() => setOpen((p) => !p)}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {total > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 bg-red-500 text-white text-xs font-semibold rounded-full flex items-center justify-center"
            aria-hidden="true"
          >
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-30"
        >
          <Link
            to="/exceptions"
            role="menuitem"
            className="block px-4 py-3 hover:bg-gray-50 border-b border-gray-100"
            onClick={() => setOpen(false)}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">Exception inbox</span>
              <span className="text-xs font-semibold text-red-600">
                {summary.pendingExceptions}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Proposed actions awaiting approval
            </p>
          </Link>
          <Link
            to="/org-insights"
            role="menuitem"
            className="block px-4 py-3 hover:bg-gray-50"
            onClick={() => setOpen(false)}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">Proactive insights</span>
              <span className="text-xs font-semibold text-violet-600">
                {summary.newInsights}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              New findings from the brain
            </p>
          </Link>
        </div>
      )}
    </div>
  );
}
