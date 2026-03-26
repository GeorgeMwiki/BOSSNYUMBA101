'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { notificationsService } from '@bossnyumba/api-client';
import { Check, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  category: 'push' | 'email' | 'sms';
}

const defaultSettings: NotificationSetting[] = [
  { id: '1', label: 'Work Order Updates', description: 'When work order status changes', enabled: true, category: 'push' },
  { id: '2', label: 'Inspection Reminders', description: 'Upcoming inspections', enabled: true, category: 'push' },
  { id: '3', label: 'Payment Alerts', description: 'New payments received', enabled: true, category: 'push' },
  { id: '4', label: 'SLA Warnings', description: 'When SLA is at risk', enabled: true, category: 'push' },
  { id: '5', label: 'Email Digest', description: 'Daily summary email', enabled: false, category: 'email' },
  { id: '6', label: 'Urgent Notifications', description: 'Emergency alerts via SMS', enabled: true, category: 'sms' },
];

export default function NotificationPreferencesPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<NotificationSetting[]>(defaultSettings);

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const response = await notificationsService.getPreferences();
      return response.data;
    },
  });

  useEffect(() => {
    if (preferences) {
      setSettings((prev) =>
        prev.map((s) => {
          if (s.category === 'push') {
            return { ...s, enabled: preferences.push ?? s.enabled };
          }
          if (s.category === 'email') {
            return { ...s, enabled: preferences.email ?? s.enabled };
          }
          if (s.category === 'sms') {
            return { ...s, enabled: preferences.sms ?? s.enabled };
          }
          return s;
        })
      );
    }
  }, [preferences]);

  const saveMutation = useMutation({
    mutationFn: async (currentSettings: NotificationSetting[]) => {
      const pushEnabled = currentSettings.filter((s) => s.category === 'push').some((s) => s.enabled);
      const emailEnabled = currentSettings.filter((s) => s.category === 'email').some((s) => s.enabled);
      const smsEnabled = currentSettings.filter((s) => s.category === 'sms').some((s) => s.enabled);
      const response = await notificationsService.updatePreferences({
        push: pushEnabled,
        email: emailEnabled,
        sms: smsEnabled,
      });
      return response.data;
    },
    onSuccess: () => {
      router.push('/settings');
    },
  });

  const toggle = (id: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  const pushSettings = settings.filter((s) => s.category === 'push');
  const emailSettings = settings.filter((s) => s.category === 'email');
  const smsSettings = settings.filter((s) => s.category === 'sms');

  if (isLoading) {
    return (
      <>
        <PageHeader title="Notification Preferences" showBack />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Notification Preferences" showBack />

      <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
        <p className="text-sm text-gray-600">
          Choose how you want to receive notifications. Push notifications appear in the app.
        </p>

        {pushSettings.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-gray-500 mb-3">Push Notifications</h2>
            <div className="card divide-y divide-gray-100">
              {pushSettings.map((setting) => (
                <div key={setting.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{setting.label}</div>
                    <div className="text-sm text-gray-500">{setting.description}</div>
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
        )}

        {emailSettings.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-gray-500 mb-3">Email</h2>
            <div className="card divide-y divide-gray-100">
              {emailSettings.map((setting) => (
                <div key={setting.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{setting.label}</div>
                    <div className="text-sm text-gray-500">{setting.description}</div>
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
        )}

        {smsSettings.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-gray-500 mb-3">SMS</h2>
            <div className="card divide-y divide-gray-100">
              {smsSettings.map((setting) => (
                <div key={setting.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{setting.label}</div>
                    <div className="text-sm text-gray-500">{setting.description}</div>
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
        )}

        {saveMutation.isError && (
          <p className="text-sm text-red-600">
            {(saveMutation.error as Error)?.message || 'Failed to save preferences'}
          </p>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {saveMutation.isPending ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </>
  );
}
