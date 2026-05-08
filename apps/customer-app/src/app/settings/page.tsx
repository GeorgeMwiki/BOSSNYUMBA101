'use client';

import { useEffect, useState, useTransition } from 'react';
import { Bell, Mail, MessageSquare, Globe, DollarSign } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';

const NOTIFICATIONS_STORAGE_KEY = 'customer_notification_prefs_v1';
const CURRENCY_STORAGE_KEY = 'customer_display_currency';
const LOCALE_COOKIE = 'NEXT_LOCALE';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

interface NotificationPrefs {
  readonly push: boolean;
  readonly email: boolean;
  readonly sms: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  push: true,
  email: true,
  sms: false,
};

function readPrefs(): NotificationPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      push: typeof parsed.push === 'boolean' ? parsed.push : DEFAULT_PREFS.push,
      email: typeof parsed.email === 'boolean' ? parsed.email : DEFAULT_PREFS.email,
      sms: typeof parsed.sms === 'boolean' ? parsed.sms : DEFAULT_PREFS.sms,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(prefs: NotificationPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage may be disabled — silently ignore.
  }
}

function readCurrency(): string {
  if (typeof window === 'undefined') return 'KES';
  try {
    return window.localStorage.getItem(CURRENCY_STORAGE_KEY) ?? 'KES';
  } catch {
    return 'KES';
  }
}

export default function SettingsPage() {
  const t = useTranslations('settingsPage');
  const activeLocale = useLocale();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [language, setLanguage] = useState<string>(activeLocale);
  const [currency, setCurrency] = useState<string>('KES');
  const [, startTransition] = useTransition();

  useEffect(() => {
    setPrefs(readPrefs());
    setCurrency(readCurrency());
  }, []);

  function updatePrefs(next: NotificationPrefs): void {
    setPrefs(next);
    writePrefs(next);
  }

  function handleLanguageChange(next: string): void {
    setLanguage(next);
    if (next === activeLocale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
    startTransition(() => {
      window.location.reload();
    });
  }

  function handleCurrencyChange(next: string): void {
    setCurrency(next);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, next);
    } catch {
      // localStorage may be disabled — silently ignore.
    }
  }

  const languages = [
    { value: 'en', label: t('english') },
    { value: 'sw', label: t('swahili') },
  ];

  const currencies = [
    { value: 'KES', label: t('kes') },
    { value: 'USD', label: t('usd') },
  ];

  return (
    <>
      <PageHeader title={t('title')} showBack />

      <div className="px-4 py-4 space-y-6">
        {/* Push Notifications */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            {t('notificationPreferences')}
          </h3>
          <div className="card divide-y divide-gray-100">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-50 rounded-lg">
                  <Bell className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <div className="font-medium">{t('push')}</div>
                  <div className="text-sm text-gray-500">
                    {t('pushDesc')}
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.push}
                onClick={() => updatePrefs({ ...prefs, push: !prefs.push })}
                className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  prefs.push ? 'bg-primary-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition ${
                    prefs.push ? 'translate-x-5' : 'translate-x-1'
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
                  <div className="font-medium">{t('email')}</div>
                  <div className="text-sm text-gray-500">
                    {t('emailDesc')}
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.email}
                onClick={() => updatePrefs({ ...prefs, email: !prefs.email })}
                className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  prefs.email ? 'bg-primary-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition ${
                    prefs.email ? 'translate-x-5' : 'translate-x-1'
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
                  <div className="font-medium">{t('sms')}</div>
                  <div className="text-sm text-gray-500">
                    {t('smsDesc')}
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs.sms}
                onClick={() => updatePrefs({ ...prefs, sms: !prefs.sms })}
                className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  prefs.sms ? 'bg-primary-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition ${
                    prefs.sms ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Language */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            {t('languagePreference')}
          </h3>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Globe className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <label htmlFor="language" className="font-medium">
                  {t('appLanguage')}
                </label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => handleLanguageChange(e.target.value)}
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
            {t('displayPreferences')}
          </h3>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <label htmlFor="currency" className="font-medium">
                  {t('currencyDisplay')}
                </label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
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
