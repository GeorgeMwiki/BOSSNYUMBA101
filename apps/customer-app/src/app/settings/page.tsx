'use client';

import { useState } from 'react';
import { Bell, Mail, MessageSquare, Globe, DollarSign } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

export default function SettingsPage() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [language, setLanguage] = useState('en');
  const [currency, setCurrency] = useState('KES');

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'sw', label: 'Kiswahili' },
  ];

  const currencies = [
    { value: 'KES', label: 'KES (Kenyan Shilling)' },
    { value: 'USD', label: 'USD (US Dollar)' },
  ];

  return (
    <>
      <PageHeader title="Settings" showBack />

      <div className="px-4 py-4 space-y-6">
        {/* Push Notifications */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            Notification Preferences
          </h3>
          <div className="card divide-y divide-gray-100">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-50 rounded-lg">
                  <Bell className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <div className="font-medium">Push notifications</div>
                  <div className="text-sm text-gray-500">
                    Receive app notifications
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={pushEnabled}
                onClick={() => setPushEnabled(!pushEnabled)}
                className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  pushEnabled ? 'bg-primary-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition ${
                    pushEnabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Mail className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <div className="font-medium">Email notifications</div>
                  <div className="text-sm text-gray-500">
                    Rent reminders, lease updates
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={emailEnabled}
                onClick={() => setEmailEnabled(!emailEnabled)}
                className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  emailEnabled ? 'bg-primary-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition ${
                    emailEnabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <div className="font-medium">SMS notifications</div>
                  <div className="text-sm text-gray-500">
                    Urgent alerts via text
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={smsEnabled}
                onClick={() => setSmsEnabled(!smsEnabled)}
                className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  smsEnabled ? 'bg-primary-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition ${
                    smsEnabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Language */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            Language Preference
          </h3>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Globe className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <label htmlFor="language" className="font-medium">
                  App language
                </label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {languages.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Currency */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            Display Preferences
          </h3>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <label htmlFor="currency" className="font-medium">
                  Currency display
                </label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {currencies.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
