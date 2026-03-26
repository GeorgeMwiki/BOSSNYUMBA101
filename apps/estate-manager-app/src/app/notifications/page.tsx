'use client';

import Link from 'next/link';
import { Bell, Settings, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery } from '@tanstack/react-query';
import { notificationsService } from '@bossnyumba/api-client';

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} hours ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

export default function NotificationsPage() {
  const { data: notificationsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await notificationsService.list();
      return response.data;
    },
  });

  const notifications = (notificationsData ?? []).map((n: any) => ({
    id: n.id,
    title: n.title ?? '',
    message: n.message ?? n.body ?? '',
    time: n.createdAt ? formatRelativeTime(n.createdAt) : '',
    read: n.read ?? n.readAt != null,
  }));
  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={`${notifications.filter((n) => !n.read).length} unread`}
        showBack
        action={
          <Link href="/settings/notifications" className="p-2 rounded-full hover:bg-gray-100">
            <Settings className="w-5 h-5" />
          </Link>
        }
      />

      <div className="px-4 py-4 pb-24">
        {isLoading ? (
          <div className="card divide-y divide-gray-100">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="p-4 animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Failed to load notifications</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-6">Please check your connection and try again.</p>
            <button onClick={() => refetch()} className="btn-secondary text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No notifications yet</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-6">You're all caught up. New notifications will appear here.</p>
          </div>
        ) : (
          <div className="card divide-y divide-gray-100">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 ${!n.read ? 'bg-primary-50/30' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{n.title}</div>
                    <div className="text-sm text-gray-500 mt-1">{n.message}</div>
                    <div className="text-xs text-gray-400 mt-2">{n.time}</div>
                  </div>
                  {!n.read && <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-2" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
