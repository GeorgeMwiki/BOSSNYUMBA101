'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Megaphone } from 'lucide-react';
import { propertiesService } from '@bossnyumba/api-client';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/providers/AuthProvider';
import { tenantKey } from '@/lib/tenant-scoped-key';

type Priority = 'normal' | 'important' | 'urgent';

export default function CreateAnnouncementPage() {
  const t = useTranslations('announcementsCreate');
  const router = useRouter();
  const { tenant } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'normal' as Priority,
    propertyId: '',
    publishNow: true,
    expiresAt: '',
    isPinned: false,
  });

  const propertiesQuery = useQuery({
    queryKey: tenantKey(tenant?.id, 'announcements-create-properties'),
    queryFn: () => propertiesService.list({ page: 1, pageSize: 100 }),
    retry: false,
  });

  const properties = Array.isArray(propertiesQuery.data?.data)
    ? propertiesQuery.data!.data!
    : [];

  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return;
    setSubmitError(null);

    // Announcements API is not yet wired. Until POST /api/v1/announcements
    // exists, fail loudly so we never silently swallow tenant input.
    // Tracked under PHASE-E-WIRE: announcements-mvp (see
    // .planning/phase-e-todo-backlog.md). Once
    // `announcementsService.create(...)` ships in @bossnyumba/api-client,
    // replace this branch with the real mutation.
    setSubmitError(
      'Announcements posting is not yet available in this deployment. The feature is queued — please check back, or contact platform support if this is blocking you.',
    );
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
              onChange={(e) =>
                setFormData({ ...formData, propertyId: e.target.value })
              }
              disabled={propertiesQuery.isLoading}
            >
              <option value="">{t('allProperties')}</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
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

        {submitError && (
          <div
            role="alert"
            className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
          >
            {submitError}
          </div>
        )}

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
