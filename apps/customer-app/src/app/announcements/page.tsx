'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, ChevronRight, Megaphone, AlertCircle, RefreshCw } from 'lucide-react';
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

function SkeletonAnnouncement() {
  return (
    <div className="card p-4 flex items-start gap-3 animate-pulse">
      <div className="w-9 h-9 bg-surface-card rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 w-3/4 bg-surface-card rounded" />
        <div className="h-3 w-full bg-surface-card rounded" />
        <div className="h-3 w-1/4 bg-surface-card rounded" />
      </div>
      <div className="w-5 h-5 bg-surface-card rounded flex-shrink-0" />
    </div>
  );
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAnnouncements = async () => {
    setLoading(true);
    setLoadError(null);
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
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader title="Announcements" showBack />
        <div className="px-4 py-4 space-y-4 pb-24">
          <div className="h-4 w-64 bg-surface-card rounded animate-pulse" />
          <div className="space-y-3">
            <SkeletonAnnouncement />
            <SkeletonAnnouncement />
            <SkeletonAnnouncement />
            <SkeletonAnnouncement />
          </div>
        </div>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Announcements" showBack />
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-16 h-16 bg-surface-card rounded-2xl flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">Something went wrong</h3>
          <p className="text-sm text-gray-400 max-w-xs mb-6">{loadError}</p>
          <button onClick={loadAnnouncements} className="btn-primary text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Announcements" showBack />

      <div className="px-4 py-4 space-y-4 pb-24">
        <p className="text-sm text-gray-400 mb-4">
          Property updates and notices from management.
        </p>
        <div className="space-y-3">
          {announcements.map((ann) => (
            <Link
              key={ann.id}
              href={`/announcements/${ann.id}`}
              className="card p-4 flex items-start gap-3 hover:bg-white/5 transition-colors"
            >
              <div
                className={`p-2 rounded-lg flex-shrink-0 ${
                  ann.priority === 'high'
                    ? 'bg-warning-500/20'
                    : ann.priority === 'medium'
                    ? 'bg-primary-500/20'
                    : 'bg-surface-card'
                }`}
              >
                <Megaphone
                  className={`w-5 h-5 ${
                    ann.priority === 'high'
                      ? 'text-warning-400'
                      : ann.priority === 'medium'
                      ? 'text-primary-400'
                      : 'text-gray-400'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm text-white">{ann.title}</h3>
                  {!ann.read && (
                    <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">
                  {ann.summary}
                </p>
                <div className="text-xs text-gray-500 mt-2">
                  {new Date(ann.date).toLocaleDateString()}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
            </Link>
          ))}
        </div>
        {announcements.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-surface-card rounded-2xl flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">No announcements</h3>
            <p className="text-sm text-gray-400 max-w-xs">
              Check back later for property updates and notices from management.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
