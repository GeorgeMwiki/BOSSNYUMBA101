'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Megaphone, Pin, Calendar, Edit, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type AnnouncementPriority = 'normal' | 'important' | 'urgent';

// Mock data - replace with API
const announcementData: Record<string, {
  id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  publishedAt: string;
  expiresAt?: string;
  isPinned: boolean;
  property?: string;
  author?: string;
}> = {
  '1': {
    id: '1',
    title: 'Water Maintenance - Scheduled Shutdown',
    content: 'Water supply will be temporarily shut down on Feb 28, 9 AM - 2 PM for pump maintenance. Please store water in advance. We apologize for any inconvenience.',
    priority: 'urgent',
    publishedAt: '2024-02-25T08:00:00',
    expiresAt: '2024-02-28',
    isPinned: true,
    property: 'Sunset Apartments',
    author: 'Property Management',
  },
  '2': {
    id: '2',
    title: 'New Parking Rules Effective March 1',
    content: 'Please review the updated parking policy. Visitor parking is now limited to 2 hours. Resident parking permits must be displayed. Unauthorized vehicles will be towed.',
    priority: 'important',
    publishedAt: '2024-02-20T10:00:00',
    expiresAt: '2024-03-01',
    isPinned: false,
    author: 'Property Management',
  },
  '3': {
    id: '3',
    title: 'Rent Payment Reminder',
    content: 'Rent payments are due by the 5th of each month. Late fees apply after the 10th. Please use the online portal or visit the office during business hours.',
    priority: 'normal',
    publishedAt: '2024-02-15T09:00:00',
    isPinned: false,
    author: 'Property Management',
  },
};

const priorityConfig: Record<AnnouncementPriority, { label: string; color: string }> = {
  normal: { label: 'Normal', color: 'badge-gray' },
  important: { label: 'Important', color: 'badge-warning' },
  urgent: { label: 'Urgent', color: 'badge-danger' },
};

export default function AnnouncementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const announcement = announcementData[id];

  if (!announcement) {
    return (
      <>
        <PageHeader title="Announcement" showBack />
        <div className="px-4 py-8 text-center">
          <p className="text-gray-500 mb-4">Announcement not found</p>
          <button onClick={() => router.back()} className="btn-secondary">
            Go Back
          </button>
        </div>
      </>
    );
  }

  const priority = priorityConfig[announcement.priority];

  return (
    <>
      <PageHeader
        title={announcement.title}
        showBack
        action={
          <div className="flex gap-2">
            <Link href={`/announcements/${id}/edit`} className="btn-secondary text-sm flex items-center gap-1">
              <Edit className="w-4 h-4" />
              Edit
            </Link>
          </div>
        }
      />

      <div className="px-4 py-4 space-y-6 max-w-4xl mx-auto">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className={priority.color}>{priority.label}</span>
            {announcement.isPinned && (
              <span className="badge-info flex items-center gap-1">
                <Pin className="w-3 h-3" />
                Pinned
              </span>
            )}
          </div>

          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
            {announcement.content}
          </div>

          <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-gray-100 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Published {new Date(announcement.publishedAt).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            {announcement.expiresAt && (
              <span>Expires {new Date(announcement.expiresAt).toLocaleDateString()}</span>
            )}
            {announcement.property && (
              <span>{announcement.property}</span>
            )}
            {announcement.author && (
              <span>By {announcement.author}</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
