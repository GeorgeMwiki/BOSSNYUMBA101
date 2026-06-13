import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Settings,
  Globe,
  CreditCard,
  Mail,
  Bell,
  Shield,
  Database,
  Palette,
  Save,
  ChevronRight,
  Check,
  AlertTriangle,
} from 'lucide-react';

interface ConfigSection {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
}

function buildConfigSections(t: (key: string) => string): ConfigSection[] {
  return [
    { id: 'general', name: t('sections.general.name'), description: t('sections.general.description'), icon: Globe },
    { id: 'payments', name: t('sections.payments.name'), description: t('sections.payments.description'), icon: CreditCard },
    { id: 'email', name: t('sections.email.name'), description: t('sections.email.description'), icon: Mail },
    { id: 'notifications', name: t('sections.notifications.name'), description: t('sections.notifications.description'), icon: Bell },
    { id: 'security', name: t('sections.security.name'), description: t('sections.security.description'), icon: Shield },
    { id: 'database', name: t('sections.database.name'), description: t('sections.database.description'), icon: Database },
    { id: 'branding', name: t('sections.branding.name'), description: t('sections.branding.description'), icon: Palette },
  ];
}

export function ConfigurationPage() {
  const t = useTranslations('configurationPage');
  const configSections = buildConfigSections(t);
  const [activeSection, setActiveSection] = useState('general');
  const [hasChanges, setHasChanges] = useState(false);

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('general.platformName')}
              </label>
              <input
                type="text"
                defaultValue="BossNyumba"
                onChange={() => setHasChanges(true)}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('general.defaultTimezone')}
              </label>
              <select
                defaultValue="Africa/Nairobi"
                onChange={() => setHasChanges(true)}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                <option value="Africa/Lagos">Africa/Lagos (WAT)</option>
                <option value="Africa/Cairo">Africa/Cairo (EET)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('general.defaultCurrency')}
              </label>
              <select
                defaultValue="KES"
                onChange={() => setHasChanges(true)}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="KES">{t('general.currency.kes')}</option>
                <option value="USD">{t('general.currency.usd')}</option>
                <option value="UGX">{t('general.currency.ugx')}</option>
                <option value="TZS">{t('general.currency.tzs')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('general.defaultLanguage')}
              </label>
              <select
                defaultValue="en"
                onChange={() => setHasChanges(true)}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="en">{t('general.language.en')}</option>
                <option value="sw">{t('general.language.sw')}</option>
                <option value="fr">{t('general.language.fr')}</option>
              </select>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  defaultChecked
                  onChange={() => setHasChanges(true)}
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">
                    {t('general.allowNewTenants')}
                  </span>
                  <p className="text-sm text-gray-500">
                    {t('general.allowNewTenantsHint')}
                  </p>
                </div>
              </label>
            </div>

            <div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  defaultChecked
                  onChange={() => setHasChanges(true)}
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">
                    {t('general.enableTrial')}
                  </span>
                  <p className="text-sm text-gray-500">
                    {t('general.enableTrialHint')}
                  </p>
                </div>
              </label>
            </div>
          </div>
        );

      case 'payments':
        return (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <Check className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">{t('payments.mpesaConnected')}</p>
                <p className="text-sm text-green-600">
                  {t('payments.mpesaStatus')}
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">{t('payments.bankTransfer')}</p>
                <p className="text-sm text-amber-600">
                  {t('payments.bankTransferNotConfigured')}
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <h3 className="font-medium text-gray-900">{t('payments.mpesaSettings')}</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('payments.consumerKey')}
                </label>
                <input
                  type="password"
                  defaultValue="••••••••••••••••"
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('payments.consumerSecret')}
                </label>
                <input
                  type="password"
                  defaultValue="••••••••••••••••"
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('payments.paybill')}
                </label>
                <input
                  type="text"
                  placeholder={t('payments.paybillPlaceholder')}
                  onChange={() => setHasChanges(true)}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('payments.callbackUrl')}
                </label>
                <input
                  type="url"
                  defaultValue="https://api.bossnyumba.com/webhooks/mpesa"
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  readOnly
                />
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">{t('security.passwordPolicy')}</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('security.minPasswordLength')}
                </label>
                <input
                  type="number"
                  defaultValue={8}
                  min={6}
                  max={32}
                  onChange={() => setHasChanges(true)}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    defaultChecked
                    onChange={() => setHasChanges(true)}
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm text-gray-700">
                    {t('security.requireUppercase')}
                  </span>
                </label>
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    defaultChecked
                    onChange={() => setHasChanges(true)}
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm text-gray-700">
                    {t('security.requireNumber')}
                  </span>
                </label>
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    defaultChecked
                    onChange={() => setHasChanges(true)}
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm text-gray-700">
                    {t('security.requireSpecial')}
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-200">
              <h3 className="font-medium text-gray-900">{t('security.sessionSettings')}</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('security.sessionTimeout')}
                </label>
                <input
                  type="number"
                  defaultValue={60}
                  min={5}
                  onChange={() => setHasChanges(true)}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    defaultChecked
                    onChange={() => setHasChanges(true)}
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm text-gray-700">
                    {t('security.requireReauth')}
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-200">
              <h3 className="font-medium text-gray-900">
                {t('security.twoFactor')}
              </h3>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    defaultChecked
                    onChange={() => setHasChanges(true)}
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      {t('security.enforce2faAdmins')}
                    </span>
                    <p className="text-sm text-gray-500">
                      {t('security.enforce2faAdminsHint')}
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    onChange={() => setHasChanges(true)}
                    className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      {t('security.enforce2faAll')}
                    </span>
                    <p className="text-sm text-gray-500">
                      {t('security.enforce2faAllHint')}
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        );

      default: {
        const sectionName =
          activeSection.charAt(0).toUpperCase() + activeSection.slice(1);
        return (
          <div
            role="status"
            aria-live="polite"
            className="text-center py-12 text-gray-500"
          >
            <Settings className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-base font-semibold text-gray-700 mb-1">
              {t('defaultSection.title', { name: sectionName })}
            </h3>
            <p className="text-sm max-w-md mx-auto">
              {t('defaultSection.body')}
            </p>
          </div>
        );
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('title')}
          </h1>
          <p className="text-gray-500">{t('subtitle')}</p>
        </div>
        {hasChanges && (
          <button
            onClick={() => setHasChanges(false)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
          >
            <Save className="h-4 w-4" />
            {t('saveChanges')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden h-fit">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">{t('sidebarTitle')}</h2>
          </div>
          <nav className="divide-y divide-gray-100">
            {configSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors ${
                  activeSection === section.id ? 'bg-violet-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      activeSection === section.id
                        ? 'bg-violet-100'
                        : 'bg-gray-100'
                    }`}
                  >
                    <section.icon
                      className={`h-4 w-4 ${
                        activeSection === section.id
                          ? 'text-violet-600'
                          : 'text-gray-600'
                      }`}
                    />
                  </div>
                  <div>
                    <p
                      className={`font-medium text-sm ${
                        activeSection === section.id
                          ? 'text-violet-600'
                          : 'text-gray-900'
                      }`}
                    >
                      {section.name}
                    </p>
                    <p className="text-xs text-gray-500">{section.description}</p>
                  </div>
                </div>
                <ChevronRight
                  className={`h-4 w-4 ${
                    activeSection === section.id
                      ? 'text-violet-600'
                      : 'text-gray-400'
                  }`}
                />
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            {configSections.find((s) => s.id === activeSection)?.name}
          </h2>
          {renderSectionContent()}
        </div>
      </div>
    </div>
  );
}
