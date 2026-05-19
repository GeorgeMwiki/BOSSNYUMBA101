'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { notificationsService } from '@bossnyumba/api-client';
import {
  Alert,
  AlertDescription,
  Button,
  Skeleton,
} from '@bossnyumba/design-system';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/providers/AuthProvider';
import { tenantKey } from '@/lib/tenant-scoped-key';
import { isSafeNotificationActionUrl } from '@/lib/notification-action-url';

const TENANT_LOCALE =
  process.env.NEXT_PUBLIC_TENANT_LOCALE?.trim() || 'en';

function formatRelative(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString(TENANT_LOCALE, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function NotificationsPage() {
  const t = useTranslations('notificationsList');
  const tSimple = useTranslations('simple');
  const queryClient = useQueryClient();
  const { tenant } = useAuth();

  const notificationsQuery = useQuery({
    queryKey: tenantKey(tenant?.id, 'notifications-list-live'),
    queryFn: () => notificationsService.list(undefined, 1, 50),
    retry: false,
  });

  const notifications = useMemo(() => {
    return Array.isArray(notificationsQuery.data?.data)
      ? notificationsQuery.data!.data!
      : [];
  }, [notificationsQuery.data]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.readAt).length,
    [notifications]
  );

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenant?.id, 'notifications-list-live') });
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenant?.id, 'notifications-unread-count'),
      });
    },
  });

  return (
    <>
      <PageHeader
        title={tSimple('notifications')}
        subtitle={t('unreadCount', { count: unreadCount })}
        showBack
        action={
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-sm px-2 py-1 text-primary-600 hover:bg-primary-50 rounded"
              >
                {markAllReadMutation.isPending
                  ? t('marking')
                  : t('markAllRead')}
              </button>
            )}
            <Link
              href="/settings/notifications"
              className="p-2 rounded-full hover:bg-gray-100"
              aria-label={t('settingsAria')}
            >
              <Settings className="w-5 h-5" />
            </Link>
          </div>
        }
      />

      <div className="px-4 py-4 space-y-3">
        {notificationsQuery.isLoading && (
          <div aria-busy="true" aria-live="polite" className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {notificationsQuery.error && (
          <Alert variant="danger">
            <AlertDescription>
              {(notificationsQuery.error as Error).message ||
                t('failedToLoad')}
              <Button
                size="sm"
                onClick={() => notificationsQuery.refetch()}
                className="ml-2"
              >
                {t('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!notificationsQuery.isLoading &&
          !notificationsQuery.error &&
          notifications.length === 0 && (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-medium text-gray-900">{t('emptyTitle')}</h3>
              <p className="text-sm text-gray-500 mt-1">{t('emptyDesc')}</p>
            </div>
          )}

        {notifications.length > 0 && (
          <div className="card divide-y divide-gray-100">
            {notifications.map((n) => {
              const isUnread = !n.readAt;
              const timestamp =
                n.sentAt ?? n.deliveredAt ?? n.createdAt ?? null;
              return (
                <NotificationRow
                  key={n.id}
                  id={n.id}
                  title={n.title}
                  body={n.body}
                  timestamp={formatRelative(timestamp)}
                  isUnread={isUnread}
                  actionUrl={n.actionUrl}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

interface NotificationRowProps {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly timestamp: string;
  readonly isUnread: boolean;
  readonly actionUrl: string | null;
}

function NotificationRow({
  id,
  title,
  body,
  timestamp,
  isUnread,
  actionUrl,
}: NotificationRowProps) {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  const markReadMutation = useMutation({
    mutationFn: () =>
      notificationsService.markAsRead(id as Parameters<typeof notificationsService.markAsRead>[0]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenant?.id, 'notifications-list-live') });
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenant?.id, 'notifications-unread-count'),
      });
    },
  });

  const handleClick = () => {
    if (isUnread) markReadMutation.mutate();
  };

  const inner = (
    <div
      className={`p-4 ${isUnread ? 'bg-primary-50/30' : ''}`}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium">{title}</div>
          <div className="text-sm text-gray-500 mt-1">{body}</div>
          {timestamp && (
            <div className="text-xs text-gray-400 mt-2">{timestamp}</div>
          )}
        </div>
        {isUnread && (
          <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-2" />
        )}
      </div>
    </div>
  );

  // Closes round-3 H-4: validate `actionUrl` is a same-origin relative
  // path before rendering it inside a Next `<Link>`. External or
  // dangerous (`javascript:`, `data:`) URLs are dropped — the row is
  // still rendered, just not linkable.
  if (actionUrl && isSafeNotificationActionUrl(actionUrl)) {
    return (
      <Link href={actionUrl} className="block">
        {inner}
      </Link>
    );
  }

  return inner;
}
