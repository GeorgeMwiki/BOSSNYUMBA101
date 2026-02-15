'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Megaphone, ChevronRight, Calendar, Pin } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

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

// Mock data - replace with API
const announcements: Announcement[] = [
  {
    id: '1',
    title: 'Water Maintenance - Scheduled Shutdown',
    content: 'Water supply will be temporarily shut down on Feb 28, 9 AM - 2 PM for pump maintenance.',
    priority: 'urgent',
    publishedAt: '2024-02-25T08:00:00',
    expiresAt: '2024-02-28',
    isPinned: true,
    property: 'Sunset Apartments',
  },
  {
    id: '2',
    title: 'New Parking Rules Effective March 1',
    content: 'Please review the updated parking policy. Visitor parking is now limited to 2 hours.',
    priority: 'important',
    publishedAt: '2024-02-20T10:00:00',
    expiresAt: '2024-03-01',
    isPinned: false,
  },
  {
    id: '3',
    title: 'Rent Payment Reminder',
    content: 'Rent payments are due by the 5th of each month. Late fees apply after the 10th.',
    priority: 'normal',
    publishedAt: '2024-02-15T09:00:00',
    isPinned: false,
  },
];

const priorityConfig: Record<AnnouncementPriority, { label: string; color: string }> = {
  normal: { label: 'Normal', color: 'badge-gray' },
  important: { label: 'Important', color: 'badge-warning' },
  urgent: { label: 'Urgent', color: 'badge-danger' },
};

export default function AnnouncementsPage() {
  const [filter, setFilter] = useState<string>('all');

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

      <div className="px-4 py-4 space-y-4">
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
