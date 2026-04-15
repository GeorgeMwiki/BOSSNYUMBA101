'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bell, CheckCheck, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { api, type NotificationRecord } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

function formatTime(date: string) {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function NotificationsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const query = useQuery<NotificationRecord[]>({
    queryKey: ['notifications'],
    queryFn: () => api.notifications.list(),
    refetchInterval: 30000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => {
      toast.success('All notifications marked as read');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to update'),
  });

  const items = query.data ?? [];
  const unreadCount = items.filter((n) => !(n.read || n.readAt)).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        showSettings
        action={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-xs font-medium text-white hover:bg-white/5"
            >
              <CheckCheck className="h-3 w-3" /> Mark all read
            </button>
          ) : null
        }
      />

      <div className="space-y-3 px-4 py-4 pb-24">
        {query.isLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading notifications...
          </div>
        )}

        {query.error && (
          <div className="card border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div>
                <p className="font-medium">Could not load notifications</p>
                <p>{(query.error as Error).message}</p>
                <button
                  type="button"
                  onClick={() => query.refetch()}
                  className="mt-2 text-sm underline"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {!query.isLoading && !query.error && items.length === 0 && (
          <div className="card flex flex-col items-center gap-2 p-10 text-center text-gray-400">
            <Bell className="h-8 w-8 text-gray-500" />
            <p className="font-medium text-gray-200">You&apos;re all caught up</p>
            <p className="text-sm">New notifications will appear here.</p>
          </div>
        )}

        {items.map((n) => {
          const isRead = Boolean(n.read || n.readAt);
          const Content = (
            <article
              className={`card relative flex gap-3 p-4 ${
                isRead ? '' : 'border-primary-500/40 bg-primary-500/5'
              }`}
            >
              {!isRead && (
                <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary-400" />
              )}
              <div className="rounded-lg bg-white/5 p-2">
                <Bell className="h-4 w-4 text-gray-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-white">{n.title}</div>
                {(n.body || n.message) && (
                  <p className="mt-0.5 text-sm text-gray-300">
                    {n.body ?? n.message}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                  <span>{n.category}</span>
                  <span>·</span>
                  <span>{formatTime(n.createdAt)}</span>
                </div>
              </div>
            </article>
          );

          const onActivate = () => {
            if (!isRead) markRead.mutate(n.id);
          };

          return n.actionUrl ? (
            <Link
              key={n.id}
              href={n.actionUrl}
              onClick={onActivate}
              className="block"
            >
              {Content}
            </Link>
          ) : (
            <button
              key={n.id}
              type="button"
              onClick={onActivate}
              className="block w-full text-left"
            >
              {Content}
            </button>
          );
        })}
      </div>
    </>
  );
}
