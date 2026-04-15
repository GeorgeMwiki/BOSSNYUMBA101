'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Megaphone, ChevronRight, Pin, Loader2, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { announcementsApi, type AnnouncementListItem, type AnnouncementPriority } from '@/lib/api';

const priorityConfig: Record<AnnouncementPriority, { label: string; color: string }> = {
  normal: { label: 'Normal', color: 'badge-gray' },
  important: { label: 'Important', color: 'badge-warning' },
  urgent: { label: 'Urgent', color: 'badge-danger' },
};

export default function AnnouncementsPage() {
  const [filter, setFilter] = useState<'all' | 'pinned'>('all');

  const announcementsQuery = useQuery({
    queryKey: ['announcements', filter],
    queryFn: () =>
      announcementsApi.list(filter === 'pinned' ? { pinned: true } : undefined),
    retry: false,
  });

  const response = announcementsQuery.data;
  const announcements: AnnouncementListItem[] = response?.data ?? [];

  const sorted = useMemo(
    () =>
      [...announcements].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }),
    [announcements]
  );

  const errorMessage =
    announcementsQuery.error instanceof Error
      ? announcementsQuery.error.message
      : response && !response.success
      ? response.error?.message
      : undefined;

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle={announcements.length > 0 ? `${announcements.length} active` : undefined}
        action={
          <Link href="/announcements/create" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Create
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-4">
        <div className="flex gap-2">
          {(['all', 'pinned'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`btn text-sm ${filter === tab ? 'btn-primary' : 'btn-secondary'}`}
            >
              {tab === 'all' ? 'All' : 'Pinned'}
            </button>
          ))}
        </div>

        {announcementsQuery.isLoading && (
          <div className="card p-4 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading announcements...
          </div>
        )}

        {errorMessage && (
          <div className="card p-4 flex items-start gap-2 border-danger-200 bg-danger-50 text-danger-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Unable to load announcements</div>
              <div>{errorMessage}</div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {sorted.map((announcement) => {
            const priority = priorityConfig[announcement.priority];
            return (
              <Link key={announcement.id} href={`/announcements/${announcement.id}`}>
                <div className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2 bg-primary-50 rounded-lg flex-shrink-0">
                        <Megaphone className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{announcement.title}</span>
                          {announcement.isPinned && (
                            <Pin className="w-4 h-4 text-primary-600" />
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {announcement.content}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={priority.color}>{priority.label}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(announcement.publishedAt).toLocaleDateString()}
                          </span>
                          {announcement.property && (
                            <span className="text-xs text-gray-400">• {announcement.property.name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {!announcementsQuery.isLoading && !errorMessage && sorted.length === 0 && (
          <div className="text-center py-12">
            <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900">No announcements</h3>
            <p className="text-sm text-gray-500 mt-1">
              {filter === 'pinned' ? 'No pinned announcements' : 'Create an announcement to notify residents'}
            </p>
            {filter !== 'pinned' && (
              <Link href="/announcements/create" className="btn-primary mt-4 inline-block">
                Create Announcement
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}
