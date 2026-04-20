'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Phone,
  ChevronRight,
  Bell,
  Globe,
  HelpCircle,
  LogOut,
  Settings,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/profile/Avatar';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfilePage() {
  const t = useTranslations('profilePage');
  const router = useRouter();
  const { user, logout } = useAuth();

  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim() || t('userFallback')
    : t('userFallback');
  const displayEmail = user?.email || '—';
  const displayPhone = user?.phone || '—';

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  return (
    <>
      <PageHeader title={t('title')} />

      <div className="px-4 py-4 space-y-6">
        {/* Profile Header */}
        <div className="card p-4 flex items-center gap-4">
          <Avatar src={null} name={displayName} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">{displayName}</h2>
            <p className="text-sm text-gray-500 truncate">{displayEmail}</p>
            <p className="text-sm text-gray-500 truncate">{displayPhone}</p>
          </div>
          <Link
            href="/profile/edit"
            className="btn-secondary text-sm flex items-center gap-1"
          >
            {t('edit')}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Quick Info */}
        <div className="card divide-y divide-gray-100">
          <Link
            href="/profile/edit"
            className="flex items-center gap-3 p-4 hover:bg-gray-50"
          >
            <Mail className="w-5 h-5 text-gray-400" />
            <span className="flex-1 text-sm">{displayEmail}</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
          <Link
            href="/profile/edit"
            className="flex items-center gap-3 p-4 hover:bg-gray-50"
          >
            <Phone className="w-5 h-5 text-gray-400" />
            <span className="flex-1 text-sm">{displayPhone}</span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
        </div>

        {/* Notification Preferences */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            {t('notificationPreferences')}
          </h3>
          <Link
            href="/settings"
            className="card p-4 flex items-center justify-between hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 rounded-lg">
                <Bell className="w-5 h-5 text-primary-600" />
              </div>
              <span className="font-medium">{t('notificationSettings')}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
        </section>

        {/* Language */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">{t('preferencesHeader')}</h3>
          <Link
            href="/settings"
            className="card p-4 flex items-center justify-between hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Globe className="w-5 h-5 text-gray-600" />
              </div>
              <span className="font-medium">{t('language')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{t('languageEnglish')}</span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </Link>
        </section>

        {/* Quick Links */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            {t('moreHeader')}
          </h3>
          <div className="card divide-y divide-gray-100">
            <Link
              href="/announcements"
              className="flex items-center gap-3 p-4 hover:bg-gray-50"
            >
              <span className="font-medium">{t('announcements')}</span>
              <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
            </Link>
            <Link
              href="/community"
              className="flex items-center gap-3 p-4 hover:bg-gray-50"
            >
              <span className="font-medium">{t('community')}</span>
              <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
            </Link>
            <Link
              href="/utilities"
              className="flex items-center gap-3 p-4 hover:bg-gray-50"
            >
              <span className="font-medium">{t('utilities')}</span>
              <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
            </Link>
            <Link
              href="/emergencies"
              className="flex items-center gap-3 p-4 hover:bg-gray-50"
            >
              <span className="font-medium">{t('emergencyContacts')}</span>
              <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
            </Link>
            <Link
              href="/documents"
              className="flex items-center gap-3 p-4 hover:bg-gray-50"
            >
              <span className="font-medium">{t('myDocuments')}</span>
              <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
            </Link>
            <Link
              href="/feedback"
              className="flex items-center gap-3 p-4 hover:bg-gray-50"
            >
              <span className="font-medium">{t('feedback')}</span>
              <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
            </Link>
          </div>
        </section>

        {/* Help & Support */}
        <Link
          href="/support"
          className="card p-4 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 rounded-lg">
              <HelpCircle className="w-5 h-5 text-primary-600" />
            </div>
            <span className="font-medium">{t('helpSupport')}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </Link>

        {/* Settings */}
        <Link
          href="/settings"
          className="card p-4 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Settings className="w-5 h-5 text-gray-600" />
            </div>
            <span className="font-medium">{t('settings')}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </Link>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full card p-4 flex items-center justify-center gap-2 text-danger-600 hover:bg-danger-50 border-danger-100"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">{t('logout')}</span>
        </button>
      </div>
    </>
  );
}
