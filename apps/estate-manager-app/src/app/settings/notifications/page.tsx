'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check } from 'lucide-react';
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

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            Save Preferences
          </button>
        </div>
      </div>
    </>
  );
}
