'use client';

import { useParams } from 'next/navigation';
import { Megaphone, AlertTriangle, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useQuery } from '@bossnyumba/api-client';

function AnnouncementSkeleton() {
  return (
    <div className="px-4 py-4 space-y-4 animate-pulse">
      <div className="card p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-gray-200 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 bg-gray-200 rounded" />
            <div className="h-5 w-48 bg-gray-200 rounded" />
            <div className="h-3 w-full bg-gray-200 rounded" />
            <div className="h-3 w-full bg-gray-200 rounded" />
            <div className="h-3 w-3/4 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnnouncementDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: announcement, isLoading, isError } = useQuery<any>(`/announcements/${id}`);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Announcement" showBack />
        <AnnouncementSkeleton />
      </>
    );
  }

  if (isError || !announcement) {
    return (
      <>
        <PageHeader title="Announcement" showBack />
        <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
          <AlertTriangle className="w-12 h-12 text-warning-400 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Announcement not found</h2>
          <p className="text-gray-500 text-sm mb-6">Could not load this announcement.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={announcement.title} showBack />
      <div className="px-4 py-4 space-y-4">
        <div className="card p-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-lg flex-shrink-0 ${
                announcement.priority === 'high'
                  ? 'bg-warning-50'
                  : announcement.priority === 'medium'
                  ? 'bg-primary-50'
                  : 'bg-gray-100'
              }`}
            >
              <Megaphone
                className={`w-5 h-5 ${
                  announcement.priority === 'high'
                    ? 'text-warning-600'
                    : announcement.priority === 'medium'
                    ? 'text-primary-600'
                    : 'text-gray-600'
                }`}
              />
            </div>
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-2">
                {new Date(announcement.date).toLocaleDateString()}
              </div>
              <h2 className="font-semibold text-lg mb-3">{announcement.title}</h2>
              <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                {announcement.body}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
