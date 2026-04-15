'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Settings, CheckCheck, Loader2, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { notificationsApi } from '@/lib/api';

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDays = Math.round(diffHr / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
    retry: false,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const response = notificationsQuery.data;
  const items = response?.data ?? [];
  const unreadCount = items.filter((n: any) => !(n.readAt || n.read)).length;
  const errorMessage =
    notificationsQuery.error instanceof Error
      ? notificationsQuery.error.message
      : response && !response.success
      ? response.error?.message
      : undefined;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        showBack
        action={
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                {markAllReadMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCheck className="w-4 h-4" />
                )}
                Mark all read
              </button>
            )}
            <Link href="/settings/notifications" className="p-2 rounded-full hover:bg-gray-100">
              <Settings className="w-5 h-5" />
            </Link>
          </div>
        }
      />

      <div className="px-4 py-4 space-y-3">
        {notificationsQuery.isLoading && (
          <div className="card p-4 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading notifications...
          </div>
        )}

        {errorMessage && (
          <div className="card p-4 flex items-start gap-2 border-danger-200 bg-danger-50 text-danger-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Unable to load notifications</div>
              <div>{errorMessage}</div>
            </div>
          </div>
        )}

        {!notificationsQuery.isLoading && !errorMessage && items.length === 0 && (
          <div className="card p-8 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No notifications</h3>
            <p className="text-sm text-gray-500 mt-1">
              You&apos;ll see alerts about work orders, inspections, and payments here.
            </p>
          </div>
        )}

        {items.length > 0 && (
          <div className="card divide-y divide-gray-100">
            {items.map((n: any) => {
              const isUnread = !(n.readAt || n.read);
              return (
                <button
                  key={n.id}
                  onClick={() => isUnread && markReadMutation.mutate(n.id)}
                  disabled={!isUnread || markReadMutation.isPending}
                  className={`w-full text-left p-4 transition-colors ${
                    isUnread ? 'bg-primary-50/30 hover:bg-primary-50/50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{n.title}</div>
                      <div className="text-sm text-gray-500 mt-1">{n.message ?? n.body}</div>
                      <div className="text-xs text-gray-400 mt-2">
                        {formatRelative(n.createdAt)}
                      </div>
                    </div>
                    {isUnread && (
                      <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-2" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
