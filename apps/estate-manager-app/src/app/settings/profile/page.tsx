'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Camera } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';

export default function ProfileSettingsPage() {
  const t = useTranslations('profileSettings');
  const router = useRouter();
  // Profile is blank until the /profile endpoint is wired — no placeholder
  // demo identity in production code.
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In real app: API call to update profile
    router.push('/settings');
  };

  return (
    <>
      <PageHeader title={t('title')} showBack />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center relative">
            <User className="w-12 h-12 text-primary-600" />
            <button
              type="button"
              className="absolute bottom-0 right-0 p-2 bg-primary-500 text-white rounded-full"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">{t('tapToChange')}</p>
        </div>

        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{t('firstName')}</label>
              <input
                type="text"
                className="input"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t('lastName')}</label>
              <input
                type="text"
                className="input"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">{t('email')}</label>
            <input
              type="email"
              className="input"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label className="label">{t('phone')}</label>
            <input
              type="tel"
              className="input"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+XXX..."
            />
          </div>

          <div>
            <label className="label">{t('role')}</label>
            <input
              type="text"
              className="input opacity-50"
              value={formData.role}
              disabled
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            {t('cancel')}
          </button>
          <button type="submit" className="btn-primary flex-1">
            {t('saveChanges')}
          </button>
        </div>
      </form>
    </>
  );
}
