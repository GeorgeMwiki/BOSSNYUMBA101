'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pin, Calendar, Edit } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';

type AnnouncementPriority = 'normal' | 'important' | 'urgent';

// Live wiring pending — announcements endpoint not yet mounted.
// Empty map keeps prod honest until the announcements service is plumbed.
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
}> = {};

const priorityConfig: Record<AnnouncementPriority, { labelKey: 'priorityNormal' | 'priorityImportant' | 'priorityUrgent'; color: string }> = {
  normal: { labelKey: 'priorityNormal', color: 'badge-gray' },
  important: { labelKey: 'priorityImportant', color: 'badge-warning' },
  urgent: { labelKey: 'priorityUrgent', color: 'badge-danger' },
};

export default function AnnouncementDetailPage() {
  const t = useTranslations('announcementDetail');
  const params = useParams();
  const router = useRouter();
  const id = (params?.id ?? '') as string;

  const announcement = announcementData[id];

  if (!announcement) {
    return (
      <>
        <PageHeader title={t('title')} showBack />
        <div className="px-4 py-8 text-center">
          <p className="text-gray-500 mb-4">{t('notFound')}</p>
          <button onClick={() => router.back()} className="btn-secondary">
            {t('goBack')}
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
              {t('edit')}
            </Link>
          </div>
        }
      />

      <div className="px-4 py-4 space-y-6 max-w-4xl mx-auto">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className={priority.color}>{t(priority.labelKey)}</span>
            {announcement.isPinned && (
              <span className="badge-info flex items-center gap-1">
                <Pin className="w-3 h-3" />
                {t('pinned')}
              </span>
            )}
          </div>

          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
            {announcement.content}
          </div>

          <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-gray-100 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {t('published')} {new Date(announcement.publishedAt).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            {announcement.expiresAt && (
              <span>{t('expires', { date: new Date(announcement.expiresAt).toLocaleDateString() })}</span>
            )}
            {announcement.property && (
              <span>{announcement.property}</span>
            )}
            {announcement.author && (
              <span>{t('byAuthor', { author: announcement.author })}</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
