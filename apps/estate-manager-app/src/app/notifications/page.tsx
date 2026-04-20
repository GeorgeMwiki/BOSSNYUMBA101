'use client';

import Link from 'next/link';
import { Bell, Settings, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

// Live wiring pending — notifications endpoint not yet mounted. Empty
// array keeps prod honest until the real feed is plumbed in.
const notifications: Array<{ id: string; title: string; message: string; time: string; read: boolean }> = [];

export default function NotificationsPage() {
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
