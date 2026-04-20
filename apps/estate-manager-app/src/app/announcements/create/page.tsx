'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Megaphone } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

type Priority = 'normal' | 'important' | 'urgent';

export default function CreateAnnouncementPage() {
  const t = useTranslations('announcementsCreate');
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'normal' as Priority,
    propertyId: '',
    publishNow: true,
    expiresAt: '',
    isPinned: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return;
    // In real app: API call to create announcement
    router.push('/announcements');
  };

  return (
    <>
      <PageHeader title={t('pageTitle')} showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="card p-4 space-y-4">
          <div>
            <label className="label">{t('labelTitle')}</label>
            <input
              type="text"
              className="input"
              placeholder={t('placeholderTitle')}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">{t('labelContent')}</label>
            <textarea
              className="input min-h-[120px]"
              placeholder={t('placeholderContent')}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">{t('labelPriority')}</label>
            <select
              className="input"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
            >
              <option value="normal">{t('priorityNormal')}</option>
              <option value="important">{t('priorityImportant')}</option>
              <option value="urgent">{t('priorityUrgent')}</option>
            </select>
          </div>

          <div>
            <label className="label">{t('labelProperty')}</label>
            <select
              className="input"
              value={formData.propertyId}
              onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
            >
              <option value="">{t('allProperties')}</option>
              <option value="1">Sunset Apartments</option>
              <option value="2">Riverside Towers</option>
            </select>
          </div>

          <div>
            <label className="label">{t('labelExpiryDate')}</label>
            <input
              type="date"
              className="input"
              value={formData.expiresAt}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPinned"
              checked={formData.isPinned}
              onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
              className="rounded border-gray-300"
            />
            <label htmlFor="isPinned" className="text-sm">{t('pinToTop')}</label>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            {t('cancel')}
          </button>
          <button
            type="submit"
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={!formData.title || !formData.content}
          >
            <Megaphone className="w-4 h-4" />
            {t('publish')}
          </button>
        </div>
      </form>
    </>
  );
}
