/**
 * Tenant notifications feed — Wave 18 UI gap closure.
 *
 * Fetches /api/v1/notifications for the authenticated tenant and renders
 * category, title, and delivery time. Loading, empty, and error states
 * are all explicit. No fallback/fake data is ever rendered.
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Bell, Loader2 } from 'lucide-react';
import { prefetchOnHover } from '@bossnyumba/performance-toolkit/lazy-load';
import { PageHeader } from '@/components/layout/PageHeader';
import { getApiBaseUrl } from '@/lib/api';

interface NotificationItem {
  readonly id: string;
  readonly title: string;
  readonly body?: string;
  readonly category?: string;
  readonly createdAt: string;
  readonly read?: boolean;
  readonly actionUrl?: string;
}

// `apiBase` hoisted into `@/lib/api`'s `getApiBaseUrl()` — single helper
// that throws in production when `NEXT_PUBLIC_API_URL` is unset rather than
// silently falling back to localhost. Was duplicated across 4 pages
// (CRITICAL in `.audit/production-readiness-gaps.md`).
const apiBase = getApiBaseUrl;

export default function NotificationsPage() {
  const t = useTranslations('pageHeaders');
  const tList = useTranslations('notificationsList');
  const [items, setItems] = useState<readonly NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const token =
          typeof window !== 'undefined'
            ? localStorage.getItem('customer_token') ?? ''
            : '';
        const res = await fetch(`${apiBase()}/notifications`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const body = (await res.json()) as {
          success?: boolean;
          data?: readonly NotificationItem[];
          error?: { message?: string };
        };
        if (!active) return;
        if (!res.ok || !body.success) {
          setError(body.error?.message ?? tList('errorLoad'));
        } else {
          setItems(body.data ?? []);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : tList('errorLoad'));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [reloadToken, tList]);

  return (
    <>
      <PageHeader title={t('notifications')} showSettings />
      <div className="px-4 py-4 pb-24 space-y-3">
        {loading && (
          <p className="text-sm text-gray-400 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> {tList('loading')}
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg bg-red-900/30 border border-red-500/40 text-red-200 p-3 text-sm flex items-center justify-between gap-3"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setReloadToken((value) => value + 1)}
              className="rounded border border-red-400/60 px-3 py-1 text-xs hover:bg-red-500/20"
            >
              {tList('retry')}
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-lg bg-gray-800 border border-gray-700 p-5 text-sm text-gray-400 flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {tList('empty')}
          </div>
        )}

        {items.map((n) => {
          const content = (
            <div
              key={n.id}
              className={`block rounded-lg bg-gray-800 border p-4 ${
                n.read ? 'border-gray-700' : 'border-blue-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium text-white">{n.title}</div>
                {n.category && (
                  <span className="text-xs bg-gray-700 text-gray-200 rounded-full px-2 py-0.5">
                    {n.category}
                  </span>
                )}
              </div>
              {n.body && (
                <p className="text-sm text-gray-400 mt-1">{n.body}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
          );

          return n.actionUrl ? (
            <Link
              key={n.id}
              href={n.actionUrl}
              className="block"
              {...prefetchOnHover(n.actionUrl)}
            >
              {content}
            </Link>
          ) : (
            content
          );
        })}
      </div>
    </>
  );
}
