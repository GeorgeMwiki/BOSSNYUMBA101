import React, { useState } from 'react';
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

const configSections: ConfigSection[] = [
  {
    id: 'general',
    name: 'General Settings',
    description: 'Platform name, timezone, and basic settings',
    icon: Globe,
  },
  {
    id: 'payments',
    name: 'Payment Gateways',
    description: 'M-Pesa, bank transfers, and payment settings',
    icon: CreditCard,
  },
  {
    id: 'email',
    name: 'Email Configuration',
    description: 'SMTP settings and email templates',
    icon: Mail,
  },
  {
    id: 'notifications',
    name: 'Notifications',
    description: 'Push notifications and SMS settings',
    icon: Bell,
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Authentication and security policies',
    icon: Shield,
  },
  {
    id: 'database',
    name: 'Database',
    description: 'Database connections and backups',
    icon: Database,
  },
  {
    id: 'branding',
    name: 'Branding',
    description: 'Logo, colors, and white-label settings',
    icon: Palette,
  },
];

export function ConfigurationPage() {
  const [activeSection, setActiveSection] = useState('general');
  const [hasChanges, setHasChanges] = useState(false);

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platform Name
              </label>
              <input
                type="text"
                defaultValue="BOSSNYUMBA"
                onChange={() => setHasChanges(true)}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Timezone
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
                Default Currency
              </label>
              <select
                defaultValue="KES"
                onChange={() => setHasChanges(true)}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="KES">Kenyan Shilling (KES)</option>
                <option value="USD">US Dollar (USD)</option>
                <option value="UGX">Ugandan Shilling (UGX)</option>
                <option value="TZS">Tanzanian Shilling (TZS)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Language
              </label>
              <select
                defaultValue="en"
                onChange={() => setHasChanges(true)}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="en">English</option>
                <option value="sw">Swahili</option>
                <option value="fr">French</option>
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
                    Allow new tenant registrations
                  </span>
                  <p className="text-sm text-gray-500">
                    Enable self-service tenant sign-up
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
                    Enable trial period
                  </span>
                  <p className="text-sm text-gray-500">
                    New tenants get a 14-day free trial
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
                <p className="font-medium text-green-800">M-Pesa Connected</p>
                <p className="text-sm text-green-600">
                  Paybill: 123456 | Account: Active
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Bank Transfer</p>
                <p className="text-sm text-amber-600">
                  Not configured - Manual reconciliation required
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <h3 className="font-medium text-gray-900">M-Pesa Settings</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Consumer Key
                </label>
                <input
                  type="password"
                  defaultValue="••••••••••••••••"
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Consumer Secret
                </label>
                <input
                  type="password"
                  defaultValue="••••••••••••••••"
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paybill Number
                </label>
                <input
                  type="text"
                  defaultValue="123456"
                  onChange={() => setHasChanges(true)}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Callback URL
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
              <h3 className="font-medium text-gray-900">Password Policy</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Password Length
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
                    Require uppercase letter
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
                    Require number
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
                    Require special character
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-200">
              <h3 className="font-medium text-gray-900">Session Settings</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Session Timeout (minutes)
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
                    Require re-authentication for sensitive actions
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-200">
              <h3 className="font-medium text-gray-900">
                Two-Factor Authentication
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
                      Enforce 2FA for admins
                    </span>
                    <p className="text-sm text-gray-500">
                      Require 2FA for all admin users
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
                      Enforce 2FA for all users
                    </span>
                    <p className="text-sm text-gray-500">
                      Require 2FA for all platform users
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-12 text-gray-500">
            <Settings className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>
              {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}{' '}
              configuration coming soon
            </p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            System Configuration
          </h1>
          <p className="text-gray-500">Manage platform-wide settings</p>
        </div>
        {hasChanges && (
          <button
            onClick={() => setHasChanges(false)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden h-fit">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Settings</h2>
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
