'use client';

import Link from 'next/link';
import { User, Bell, Shield, HelpCircle, ChevronRight, LogOut } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface SettingsItem {
  href: string;
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}

const settingsSections: { title: string; items: SettingsItem[] }[] = [
  {
    title: 'Account',
    items: [
      { href: '/settings/profile', icon: User, title: 'Profile', subtitle: 'Name, email, phone' },
      { href: '/settings/notifications', icon: Bell, title: 'Notifications', subtitle: 'Push, email preferences' },
    ],
  },
  {
    title: 'App',
    items: [
      { href: '/settings/security', icon: Shield, title: 'Security', subtitle: 'Password, 2FA' },
      { href: '/settings/help', icon: HelpCircle, title: 'Help & Support', subtitle: 'FAQs, contact' },
    ],
  },
];

export default function SettingsOverviewPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your account" />

      <div className="px-4 py-4 space-y-6">
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
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
