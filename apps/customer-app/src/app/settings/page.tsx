'use client';

import { useState } from 'react';
import { Bell, Mail, MessageSquare, Globe, DollarSign } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useI18n, SUPPORTED_LOCALES, LOCALE_NAMES } from '@bossnyumba/i18n';
import type { Locale } from '@bossnyumba/i18n';

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [currency, setCurrency] = useState('KES');

  const currencies = [
    { value: 'KES', label: 'KES (Kenyan Shilling)' },
    { value: 'USD', label: 'USD (US Dollar)' },
  ];

  return (
    <>
      <PageHeader title={t('customer.settings.title')} showBack />

      <div className="px-4 py-4 space-y-6">
        {/* Push Notifications */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            {t('customer.settings.notificationPreferences')}
          </h3>
          <div className="card divide-y divide-gray-100">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-50 rounded-lg">
                  <Bell className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <div className="font-medium">{t('customer.settings.pushNotifications')}</div>
                  <div className="text-sm text-gray-500">
                    {t('customer.settings.receiveAppNotifications')}
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
                  <div className="font-medium">{t('customer.settings.emailNotifications')}</div>
                  <div className="text-sm text-gray-500">
                    {t('customer.settings.rentRemindersLeaseUpdates')}
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
                  <div className="font-medium">{t('customer.settings.smsNotifications')}</div>
                  <div className="text-sm text-gray-500">
                    {t('customer.settings.urgentAlertsViaText')}
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
            {t('customer.settings.appLanguage')}
          </h3>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Globe className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <label htmlFor="language" className="font-medium">
                  {t('customer.settings.appLanguage')}
                </label>
                <select
                  id="language"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                  className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {SUPPORTED_LOCALES.map((loc) => (
                    <option key={loc} value={loc}>
                      {LOCALE_NAMES[loc]}
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
            {t('customer.settings.currencyDisplay')}
          </h3>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <label htmlFor="currency" className="font-medium">
                  {t('customer.settings.currencyDisplay')}
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
