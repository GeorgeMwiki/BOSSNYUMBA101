/**
 * Notification center trigger for the documents surface.
 *
 * Renders a bell icon button that, on click, fetches
 * `/api/v1/notifications` and renders any renewal-related entries inline as
 * a dropdown panel. The fetch fires from the click handler (not on mount)
 * so the E2E spec can assert it lands on the gateway.
 */
'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Bell, Loader2, X } from 'lucide-react';
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

function token(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('customer_token') ?? ''
    : '';
}

export function NotificationCenterButton() {
  const t = useTranslations('p89.notificationCenter');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<readonly NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = token();
      const res = await fetch(`${getApiBaseUrl()}/notifications`, {
        headers: auth ? { Authorization: `Bearer ${auth}` } : {},
      });
      const body = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: readonly NotificationItem[];
        error?: { message?: string };
      };
      if (!res.ok || body.success === false) {
        throw new Error(body.error?.message ?? `HTTP ${res.status}`);
      }
      setItems(body.data ?? []);
      setLoaded(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load notifications',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClick = useCallback(() => {
    setOpen((current) => {
      const next = !current;
      if (next && !loaded) {
        void fetchNotifications();
      }
      return next;
    });
  }, [fetchNotifications, loaded]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        aria-label="Notifications"
        aria-expanded={open}
        data-testid="notification-center"
        className="p-2 rounded-full hover:bg-white/5 text-white relative"
      >
        <Bell className="w-5 h-5" />
        {!loaded && items.length === 0 && (
          <span
            className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500"
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('panelAria')}
          className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-30 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
            <h3 className="text-sm font-medium text-white">Notifications</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('closeAria')}
              className="p-1 rounded hover:bg-white/5 text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <p className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </p>
            )}
            {error && (
              <div className="px-4 py-3 text-sm text-red-300">{error}</div>
            )}
            {!loading && !error && items.length === 0 && loaded && (
              <p className="px-4 py-3 text-sm text-gray-500">
                You are all caught up.
              </p>
            )}
            {items.map((item) => {
              const inner = (
                <div className="px-4 py-3 hover:bg-white/5 border-b border-gray-800 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">
                      {item.title}
                    </p>
                    {item.category && (
                      <span className="text-[10px] uppercase tracking-wide bg-gray-700 text-gray-200 rounded px-1.5 py-0.5">
                        {item.category}
                      </span>
                    )}
                  </div>
                  {item.body && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                      {item.body}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-500 mt-1">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              );
              return item.actionUrl ? (
                <Link
                  key={item.id}
                  href={item.actionUrl}
                  onClick={() => setOpen(false)}
                  className="block"
                >
                  {inner}
                </Link>
              ) : (
                <div key={item.id}>{inner}</div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationCenterButton;
