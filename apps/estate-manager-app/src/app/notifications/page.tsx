'use client';

import Link from 'next/link';
import { Bell, Settings, ChevronRight } from 'lucide-react';
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
  const { data: notificationsData, isLoading } = useQuery({
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

      <div className="px-4 py-4">
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
      </div>
    </>
  );
}
