'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, ChevronRight, Megaphone, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { notificationsService } from '@bossnyumba/api-client';

interface Announcement {
  id: string;
  title: string;
  summary: string;
  date: string;
  priority: string;
  read: boolean;
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAnnouncements() {
      try {
        const response = await notificationsService.list({ category: ['announcement' as never] });
        const items = (response.data as unknown as Record<string, unknown>[]) ?? [];
        setAnnouncements(
          items.map((n: Record<string, unknown>) => ({
            id: (n.id as string) ?? '',
            title: (n.title as string) ?? '',
            summary: (n.summary as string) ?? (n.body as string) ?? '',
            date: (n.date as string) ?? (n.createdAt as string) ?? '',
            priority: (n.priority as string) ?? 'info',
            read: !!(n.read ?? n.readAt),
          }))
        );
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load announcements');
      } finally {
        setLoading(false);
      }
    }
    loadAnnouncements();
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader title="Announcements" showBack />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Announcements" showBack />
        <div className="px-4 py-8 text-center">
          <p className="text-gray-600">{loadError}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Announcements" showBack />

      <div className="px-4 py-4 space-y-4">
        <p className="text-sm text-gray-500 mb-4">
          Property updates and notices from management.
        </p>
        <div className="space-y-3">
          {announcements.map((ann) => (
            <Link
              key={ann.id}
              href={`/announcements/${ann.id}`}
              className="card p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors"
            >
              <div
                className={`p-2 rounded-lg flex-shrink-0 ${
                  ann.priority === 'high'
                    ? 'bg-warning-50'
                    : ann.priority === 'medium'
                    ? 'bg-primary-50'
                    : 'bg-gray-100'
                }`}
              >
                <Megaphone
                  className={`w-5 h-5 ${
                    ann.priority === 'high'
                      ? 'text-warning-600'
                      : ann.priority === 'medium'
                      ? 'text-primary-600'
                      : 'text-gray-600'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm">{ann.title}</h3>
                  {!ann.read && (
                    <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                  {ann.summary}
                </p>
                <div className="text-xs text-gray-400 mt-2">
                  {new Date(ann.date).toLocaleDateString()}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            </Link>
          ))}
        </div>
        {announcements.length === 0 && (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No announcements</h3>
            <p className="text-sm text-gray-500 mt-1">
              Check back later for property updates
            </p>
          </div>
        )}
      </div>
    </>
  );
}
