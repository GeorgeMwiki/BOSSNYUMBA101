'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Megaphone, Pin, Calendar, Edit, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { announcementsApi, type AnnouncementPriority } from '@/lib/api';

const priorityConfig: Record<AnnouncementPriority, { label: string; color: string }> = {
  normal: { label: 'Normal', color: 'badge-gray' },
  important: { label: 'Important', color: 'badge-warning' },
  urgent: { label: 'Urgent', color: 'badge-danger' },
};

export default function AnnouncementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const announcementQuery = useQuery({
    queryKey: ['announcement', id],
    queryFn: () => announcementsApi.get(id),
    retry: false,
    enabled: Boolean(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => announcementsApi.remove(id),
    onSuccess: () => router.push('/announcements'),
  });

  const response = announcementQuery.data;
  const announcement = response?.data;
  const errorMessage =
    announcementQuery.error instanceof Error
      ? announcementQuery.error.message
      : response && !response.success
      ? response.error?.message
      : undefined;

  if (announcementQuery.isLoading) {
    return (
      <>
        <PageHeader title="Announcement" showBack />
        <div className="px-4 py-8 flex items-center justify-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading announcement...
        </div>
      </>
    );
  }

  if (errorMessage || !announcement) {
    return (
      <>
        <PageHeader title="Announcement" showBack />
        <div className="px-4 py-8 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">{errorMessage ?? 'Announcement not found'}</p>
          <button onClick={() => router.back()} className="btn-secondary">
            Go Back
          </button>
        </div>
      </>
    );
  }

  const priority = priorityConfig[announcement.priority];

  const handleDelete = () => {
    if (!window.confirm('Delete this announcement?')) return;
    deleteMutation.mutate();
  };

  return (
    <>
      <PageHeader
        title={announcement.title}
        showBack
        action={
          <div className="flex gap-2">
            <Link
              href={`/announcements/${id}/edit`}
              className="btn-secondary text-sm flex items-center gap-1"
            >
              <Edit className="w-4 h-4" />
              Edit
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="btn-secondary text-sm flex items-center gap-1 text-danger-600"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete
            </button>
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
            {announcement.property && <span>{announcement.property.name}</span>}
            {announcement.author && <span>By {announcement.author.name}</span>}
          </div>
        </div>
      </div>
    </>
  );
}
