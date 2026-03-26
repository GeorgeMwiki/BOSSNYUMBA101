'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Megaphone, ChevronRight, Calendar, Pin, AlertTriangle, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery } from '@tanstack/react-query';
import { notificationsService } from '@bossnyumba/api-client';

type AnnouncementPriority = 'normal' | 'important' | 'urgent';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  publishedAt: string;
  expiresAt?: string;
  isPinned: boolean;
  property?: string;
}

const priorityConfig: Record<AnnouncementPriority, { label: string; color: string }> = {
  normal: { label: 'Normal', color: 'badge-gray' },
  important: { label: 'Important', color: 'badge-warning' },
  urgent: { label: 'Urgent', color: 'badge-danger' },
};

export default function AnnouncementsPage() {
  const [filter, setFilter] = useState<string>('all');

  const { data: announcementsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const response = await notificationsService.list({ type: 'announcement' });
      return response.data;
    },
  });

  const announcements: Announcement[] = (announcementsData ?? []).map((a: any) => ({
    id: a.id,
    title: a.title ?? '',
    content: a.content ?? a.body ?? a.message ?? '',
    priority: (a.priority ?? 'normal') as AnnouncementPriority,
    publishedAt: a.publishedAt ?? a.createdAt ?? '',
    expiresAt: a.expiresAt,
    isPinned: a.isPinned ?? false,
    property: a.propertyName ?? a.property,
  }));

  const filteredAnnouncements = announcements.filter((a) => {
    if (filter === 'pinned') return a.isPinned;
    return true;
  });

  // Sort: pinned first, then by date
  const sorted = [...filteredAnnouncements].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle={`${announcements.length} active`}
        action={
          <Link href="/announcements/create" className="btn-primary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Create
          </Link>
        }
      />

      <div className="px-4 py-4 pb-24 space-y-4">
        {/* Filter Tabs */}
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'pinned', label: 'Pinned' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`btn text-sm ${filter === tab.value ? 'btn-primary' : 'btn-secondary'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Announcements List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                  <div className="w-5 h-5 bg-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Failed to load announcements</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-6">Please check your connection and try again.</p>
            <button onClick={() => refetch()} className="btn-secondary text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : (
        <>
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
                            <span className="text-xs text-gray-400">• {announcement.property}</span>
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

        {filteredAnnouncements.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <Megaphone className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No announcements</h3>
            <p className="text-sm text-gray-500 max-w-xs mb-6">
              {filter === 'pinned' ? 'No pinned announcements found.' : 'Create an announcement to notify residents.'}
            </p>
            {filter !== 'pinned' && (
              <Link href="/announcements/create" className="btn-primary text-sm">
                Create Announcement
              </Link>
            )}
          </div>
        )}
        </>
        )}
      </div>
    </>
  );
}
