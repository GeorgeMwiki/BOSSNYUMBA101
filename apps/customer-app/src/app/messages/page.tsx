/**
 * Tenant ↔ property manager messages list — Wave 15 UI gap closure.
 *
 * Fetches /api/v1/messaging/threads for the authenticated tenant and
 * renders latest preview. Clicking a thread navigates to the detail
 * route that already exists under `[id]`.
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MessageSquare, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface Thread {
  readonly id: string;
  readonly subject: string;
  readonly lastMessagePreview: string;
  readonly lastMessageAt: string;
  readonly unreadCount: number;
  readonly counterpart: {
    readonly name: string;
    readonly role: string;
  };
}

function apiBase(): string {
  const url = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL;
  if (url?.trim()) {
    const base = url.trim().replace(/\/$/, '');
    return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  }
  return 'http://localhost:4001/api/v1';
}

export default function MessagesPage() {
  const t = useTranslations('pageHeaders');
  const tList = useTranslations('messagesList');
  const [threads, setThreads] = useState<readonly Thread[]>([]);
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
        const res = await fetch(`${apiBase()}/messaging/threads`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const body = (await res.json()) as {
          success?: boolean;
          data?: readonly Thread[];
          error?: { message?: string };
        };
        if (!active) return;
        if (!res.ok || !body.success) {
          setError(body.error?.message ?? tList('errorLoad'));
        } else {
          setThreads(body.data ?? []);
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
      <PageHeader title={t('messages')} />
      <div className="px-4 py-4 pb-24 space-y-3">
        {loading && (
          <p className="text-sm text-gray-400 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> {tList('loading')}
          </p>
        )}
        {error && (
          <div className="rounded-lg bg-red-900/30 border border-red-500/40 text-red-200 p-3 text-sm flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setReloadToken((v) => v + 1)}
              className="rounded border border-red-400/60 px-3 py-1 text-xs hover:bg-red-500/20"
            >
              {tList('retry')}
            </button>
          </div>
        )}
        {!loading && !error && threads.length === 0 && (
          <div className="rounded-lg bg-gray-800 border border-gray-700 p-5 text-sm text-gray-400 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {tList('empty')}
          </div>
        )}
        {threads.map((t) => (
          <Link
            key={t.id}
            href={`/messages/${t.id}`}
            className="block rounded-lg bg-gray-800 border border-gray-700 p-4 hover:border-blue-500"
          >
            <div className="flex items-center justify-between">
              <div className="font-medium text-white">{t.subject}</div>
              {t.unreadCount > 0 && (
                <span className="text-xs bg-blue-600 text-white rounded-full px-2 py-0.5">
                  {t.unreadCount}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-1 truncate">
              {t.lastMessagePreview}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {t.counterpart.name} · {t.counterpart.role} ·{' '}
              {new Date(t.lastMessageAt).toLocaleString()}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
