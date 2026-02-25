'use client';

import Link from 'next/link';
import { User, Bell, Shield, HelpCircle, ChevronRight, LogOut, Globe } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useI18n, SUPPORTED_LOCALES, LOCALE_NAMES } from '@bossnyumba/i18n';
import type { Locale } from '@bossnyumba/i18n';

export default function SettingsOverviewPage() {
  const { t, locale, setLocale } = useI18n();

  const settingsSections = [
    {
      title: t('estateManager.settings.profile'),
      items: [
        { href: '/settings/profile', icon: User, title: t('estateManager.settings.profile'), subtitle: t('customer.profile.personalInfo') },
        { href: '/settings/notifications', icon: Bell, title: t('estateManager.settings.notifications'), subtitle: t('customer.settings.notificationPreferences') },
      ],
    },
    {
      title: t('estateManager.settings.security'),
      items: [
        { href: '/settings/security', icon: Shield, title: t('estateManager.settings.security'), subtitle: t('estateManager.settings.twoFactor') },
        { href: '/settings/help', icon: HelpCircle, title: t('estateManager.settings.help'), subtitle: t('customer.support.faq') },
      ],
    },
  ];

  return (
    <>
      <PageHeader title={t('estateManager.settings.title')} subtitle={t('estateManager.settings.title')} />

      <div className="px-4 py-4 space-y-6">
        {/* Language Switcher */}
        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-3">{t('customer.settings.appLanguage')}</h2>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 rounded-lg">
                <Globe className="w-5 h-5 text-primary-600" />
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

        {settingsSections.map((section) => (
          <section key={section.title}>
            <h2 className="text-sm font-medium text-gray-500 mb-3">{section.title}</h2>
            <div className="card divide-y divide-gray-100">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <div className="p-4 flex items-center gap-3 hover:bg-gray-50">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Icon className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{item.title}</div>
                        {item.subtitle && (
                          <div className="text-sm text-gray-500">{item.subtitle}</div>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        <div className="pt-4">
          <button className="w-full flex items-center justify-center gap-2 py-3 text-danger-600 font-medium hover:bg-danger-50 rounded-lg transition-colors">
            <LogOut className="w-5 h-5" />
            {t('common.nav.logout')}
          </button>
        </div>
      </div>
    </>
  );
}
