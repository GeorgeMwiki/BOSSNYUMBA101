'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';

export default function SecuritySettingsPage() {
  const t = useTranslations('securitySettings');
  const router = useRouter();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/settings');
  };

  return (
    <>
      <PageHeader title={t('title')} showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="card p-4 space-y-4">
          <div>
            <label className="label">{t('currentPassword')}</label>
            <input
              type="password"
              className="input"
              value={formData.currentPassword}
              onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
              placeholder={t('currentPasswordPlaceholder')}
            />
          </div>
          <div>
            <label className="label">{t('newPassword')}</label>
            <input
              type="password"
              className="input"
              value={formData.newPassword}
              onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
              placeholder={t('newPasswordPlaceholder')}
            />
          </div>
          <div>
            <label className="label">{t('confirmPassword')}</label>
            <input
              type="password"
              className="input"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder={t('confirmPasswordPlaceholder')}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            {t('cancel')}
          </button>
          <button type="submit" className="btn-primary flex-1">
            {t('updatePassword')}
          </button>
        </div>
      </form>
    </>
  );
}
