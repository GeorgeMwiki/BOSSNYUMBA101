'use client';

import { useState, useCallback } from 'react';
import { Bell, AlertTriangle, CheckCheck, Info, CreditCard, Wrench, FileText, MessageCircle } from 'lucide-react';
import { notificationsService } from '@bossnyumba/api-client';
import { useQuery } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';

interface NotificationItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
  read?: boolean;
  readAt?: string;
  createdAt: string;
}

function getNotificationIcon(category?: string) {
  switch (category) {
    case 'PAYMENT':
      return <CreditCard className="w-5 h-5" />;
    case 'MAINTENANCE':
    case 'WORK_ORDER':
      return <Wrench className="w-5 h-5" />;
    case 'LEASE':
    case 'DOCUMENT':
      return <FileText className="w-5 h-5" />;
    case 'MESSAGE':
      return <MessageCircle className="w-5 h-5" />;
    default:
      return <Info className="w-5 h-5" />;
  }
}

function getNotificationIconColor(category?: string) {
  switch (category) {
    case 'PAYMENT':
      return 'text-green-400 bg-green-500/20';
    case 'MAINTENANCE':
    case 'WORK_ORDER':
      return 'text-warning-400 bg-warning-500/20';
    case 'LEASE':
    case 'DOCUMENT':
      return 'text-primary-400 bg-primary-500/20';
    case 'MESSAGE':
      return 'text-blue-400 bg-blue-500/20';
    default:
      return 'text-gray-400 bg-gray-500/20';
  }
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function NotificationsSkeleton() {
  return (
    <div className="divide-y divide-white/10">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-3 p-4 animate-pulse">
          <div className="w-10 h-10 bg-surface-card rounded-lg flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-3/4 bg-surface-card rounded" />
            <div className="h-3 w-full bg-surface-card rounded" />
          </div>
          <div className="h-3 w-12 bg-surface-card rounded flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

function EmptyNotifications() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <div className="p-4 bg-surface-card rounded-full mb-4">
        <Bell className="w-10 h-10 text-gray-400" />
      </div>
      <h2 className="text-lg font-semibold text-white mb-2">All caught up</h2>
      <p className="text-gray-400 text-sm">You have no notifications right now.</p>
    </div>
  );
}

function NotificationsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <AlertTriangle className="w-12 h-12 text-warning-400 mb-4" />
      <h2 className="text-lg font-semibold text-white mb-2">Failed to load notifications</h2>
      <p className="text-gray-400 text-sm mb-6">Something went wrong. Please try again.</p>
      <button onClick={onRetry} className="btn-primary px-6 py-2">
        Retry
      </button>
    </div>
  );
}

export default function NotificationsPage() {
  const [markingAll, setMarkingAll] = useState(false);
  const { data: notifications, isLoading, isError, refetch } = useQuery<NotificationItem[]>(
    '/notifications',
    { staleTime: 30 * 1000 }
  );

  const [actionError, setActionError] = useState<string | null>(null);

  const handleMarkAsRead = useCallback(async (id: string) => {
    setActionError(null);
    try {
      await notificationsService.markAsRead(id);
      refetch();
    } catch {
      setActionError('Failed to mark notification as read. Please try again.');
    }
  }, [refetch]);

  const handleMarkAllAsRead = useCallback(async () => {
    setMarkingAll(true);
    setActionError(null);
    try {
      await notificationsService.markAllAsRead();
      refetch();
    } catch {
      setActionError('Failed to mark all as read. Please try again.');
    } finally {
      setMarkingAll(false);
    }
  }, [refetch]);

  const hasUnread = notifications?.some((n) => !n.read && !n.readAt);

  return (
    <div>
      <PageHeader
        title="Notifications"
        showSettings
        action={
          hasUnread ? (
            <button
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
              className="flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 disabled:opacity-50 min-h-[44px] px-2"
            >
              <CheckCheck className="w-4 h-4" />
              <span>{markingAll ? 'Marking...' : 'Mark all read'}</span>
            </button>
          ) : undefined
        }
      />
      {actionError && (
        <div className="mx-4 mt-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-300 ml-2 text-xs">Dismiss</button>
        </div>
      )}
      <div className="pb-24">
        {isLoading ? (
          <NotificationsSkeleton />
        ) : isError ? (
          <NotificationsError onRetry={refetch} />
        ) : !notifications || notifications.length === 0 ? (
          <EmptyNotifications />
        ) : (
          <div className="divide-y divide-white/10">
            {notifications.map((notification) => {
              const isRead = notification.read || !!notification.readAt;
              return (
                <button
                  key={notification.id}
                  onClick={() => !isRead && handleMarkAsRead(notification.id)}
                  className={`w-full flex items-start gap-3 p-4 text-left transition-colors hover:bg-white/5 ${
                    !isRead ? 'bg-white/[0.02]' : ''
                  }`}
                >
                  <div className={`p-2 rounded-lg flex-shrink-0 ${getNotificationIconColor(notification.category)}`}>
                    {getNotificationIcon(notification.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-sm font-medium ${isRead ? 'text-gray-400' : 'text-white'}`}>
                        {notification.title}
                      </span>
                      {!isRead && (
                        <span className="w-2 h-2 bg-primary-400 rounded-full flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    {notification.description && (
                      <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">
                        {notification.description}
                      </p>
                    )}
                    <span className="text-xs text-gray-500 mt-1 block">
                      {formatTimestamp(notification.createdAt)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
