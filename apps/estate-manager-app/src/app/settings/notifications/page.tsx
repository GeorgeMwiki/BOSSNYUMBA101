'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';

interface NotificationSetting {
  id: string;
  labelKey: string;
  descKey: string;
  enabled: boolean;
  category: 'push' | 'email' | 'sms';
}

const defaultSettings: NotificationSetting[] = [
  { id: '1', labelKey: 'workOrderUpdatesLabel', descKey: 'workOrderUpdatesDesc', enabled: true, category: 'push' },
  { id: '2', labelKey: 'inspectionRemindersLabel', descKey: 'inspectionRemindersDesc', enabled: true, category: 'push' },
  { id: '3', labelKey: 'paymentAlertsLabel', descKey: 'paymentAlertsDesc', enabled: true, category: 'push' },
  { id: '4', labelKey: 'slaWarningsLabel', descKey: 'slaWarningsDesc', enabled: true, category: 'push' },
  { id: '5', labelKey: 'emailDigestLabel', descKey: 'emailDigestDesc', enabled: false, category: 'email' },
  { id: '6', labelKey: 'urgentNotificationsLabel', descKey: 'urgentNotificationsDesc', enabled: true, category: 'sms' },
];

export default function NotificationPreferencesPage() {
  const t = useTranslations('notificationsSettings');
  const router = useRouter();
  const [settings, setSettings] = useState<NotificationSetting[]>(defaultSettings);

  const toggle = (id: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleSave = () => {
    // In real app: API call to save preferences
    router.push('/settings');
  };

  const pushSettings = settings.filter((s) => s.category === 'push');
  const emailSettings = settings.filter((s) => s.category === 'email');
  const smsSettings = settings.filter((s) => s.category === 'sms');

  const renderSection = (
    items: NotificationSetting[],
    titleKey: 'pushNotifications' | 'email' | 'sms'
  ) => (
    items.length > 0 && (
      <section>
        <h2 className="text-sm font-medium text-gray-500 mb-3">{t(titleKey)}</h2>
        <div className="card divide-y divide-gray-100">
          {items.map((setting) => (
            <div key={setting.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{t(setting.labelKey as never)}</div>
                <div className="text-sm text-gray-500">{t(setting.descKey as never)}</div>
              </div>
              <button
                type="button"
                onClick={() => toggle(setting.id)}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  setting.enabled ? 'bg-primary-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    setting.enabled ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </section>
    )
  );

  return (
    <>
      <PageHeader title={t('title')} showBack />

      <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
        <p className="text-sm text-gray-600">
          {t('intro')}
        </p>

        {renderSection(pushSettings, 'pushNotifications')}
        {renderSection(emailSettings, 'email')}
        {renderSection(smsSettings, 'sms')}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            {t('cancel')}
          </button>
          <button onClick={handleSave} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            {t('savePreferences')}
          </button>
        </div>
      </div>
    </>
  );
}
