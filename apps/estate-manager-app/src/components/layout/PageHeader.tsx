'use client';

import { ArrowLeft, Bell, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { notificationsService } from '@bossnyumba/api-client';
import { isFeatureEnabled } from '@/lib/featureFlags';
import { BrainTabStatus } from './BrainTabStatus';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showNotifications?: boolean;
  showProfile?: boolean;
  action?: React.ReactNode;
  /**
   * Wave-3 INT-4 — show the brain-capture + proposal-count badge in
   * the right cluster. Defaults true so the indicator appears on every
   * manager screen (the flag still gates whether anything renders).
   */
  showBrainTabStatus?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  showBack,
  showNotifications = true,
  showProfile,
  action,
  showBrainTabStatus = true,
}: PageHeaderProps) {
  const router = useRouter();
  // Flag gate — when off, the BrainTabStatus does not render even if
  // `showBrainTabStatus` is true. Default OFF in prod.
  const brainStatusEnabled =
    showBrainTabStatus && isFeatureEnabled('brain_tab_status_enabled');

  const unreadQuery = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsService.getUnreadCount(),
    enabled: showNotifications,
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const unread = unreadQuery.data?.data?.count ?? 0;
  // Wave-3 INT-4 — these come from local placeholder state until the
  // dispatch-router + module-orchestrator api-client ports land.
  // The component is renderer-pure: real data flows in via this hook
  // call once the SSE / polling sources exist.
  const captureActive = false;
  const pendingProposalCount = 0;

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-100">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {action}
          {brainStatusEnabled && (
            <BrainTabStatus
              captureActive={captureActive}
              pendingProposalCount={pendingProposalCount}
            />
          )}
          {showNotifications && (
            <Link
              href="/notifications"
              className="p-2 rounded-full hover:bg-gray-100 relative"
              aria-label={
                unread > 0 ? `Notifications: ${unread} unread` : 'Notifications'
              }
            >
              <Bell className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-danger-500 rounded-full" />
              )}
            </Link>
          )}
          {showProfile && (
            <Link
              href="/settings"
              className="p-2 rounded-full hover:bg-gray-100"
              aria-label="Settings"
            >
              <User className="w-5 h-5" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
