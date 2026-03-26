'use client';

import { CreditCard, Wrench, FileText, CheckCircle, Bell, AlertTriangle } from 'lucide-react';
import { useQuery } from '@bossnyumba/api-client';
import type { Notification } from '@bossnyumba/domain-models';

const CATEGORY_META: Record<string, { icon: typeof Bell; iconColor: string }> = {
  payment_received: { icon: CreditCard, iconColor: 'text-green-400 bg-green-500/20' },
  payment_due: { icon: CreditCard, iconColor: 'text-warning-400 bg-warning-500/20' },
  payment_overdue: { icon: CreditCard, iconColor: 'text-red-400 bg-red-500/20' },
  maintenance_update: { icon: Wrench, iconColor: 'text-warning-400 bg-warning-500/20' },
  maintenance_scheduled: { icon: Wrench, iconColor: 'text-primary-400 bg-primary-500/20' },
  maintenance_completed: { icon: CheckCircle, iconColor: 'text-green-400 bg-green-500/20' },
  document_ready: { icon: FileText, iconColor: 'text-primary-400 bg-primary-500/20' },
  lease_expiring: { icon: FileText, iconColor: 'text-warning-400 bg-warning-500/20' },
  lease_renewal: { icon: FileText, iconColor: 'text-primary-400 bg-primary-500/20' },
};

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

export function RecentActivitySkeleton() {
  return (
    <section>
      <h2 className="text-sm font-medium text-gray-400 mb-3">Recent Activity</h2>
      <div className="card divide-y divide-white/10">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start gap-3 p-4 animate-pulse">
            <div className="w-8 h-8 bg-surface-card rounded-lg flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-4 w-3/4 bg-surface-card rounded" />
              <div className="h-3 w-1/2 bg-surface-card rounded" />
            </div>
            <div className="h-3 w-14 bg-surface-card rounded flex-shrink-0" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function RecentActivity() {
  const { data: notifications, isLoading, isError } = useQuery<Notification[]>(
    '/notifications?limit=5',
    { staleTime: 30 * 1000 }
  );

  if (isLoading) {
    return <RecentActivitySkeleton />;
  }

  if (isError) {
    return (
      <section>
        <h2 className="text-sm font-medium text-gray-400 mb-3">Recent Activity</h2>
        <div className="card p-4 text-center">
          <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Unable to load recent activity</p>
        </div>
      </section>
    );
  }

  if (!notifications || notifications.length === 0) {
    return (
      <section>
        <h2 className="text-sm font-medium text-gray-400 mb-3">Recent Activity</h2>
        <div className="card p-6 text-center">
          <Bell className="w-8 h-8 text-gray-500 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No recent activity</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-sm font-medium text-gray-400 mb-3">Recent Activity</h2>
      <div className="card divide-y divide-white/10">
        {notifications.map((notification) => {
          const meta = CATEGORY_META[notification.category] || {
            icon: Bell,
            iconColor: 'text-gray-400 bg-gray-500/20',
          };
          const Icon = meta.icon;
          return (
            <div key={notification.id} className="flex items-start gap-3 p-4">
              <div className={`p-2 rounded-lg ${meta.iconColor}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-white">{notification.title}</div>
                <div className="text-sm text-gray-400 truncate">
                  {notification.body}
                </div>
              </div>
              <div className="text-xs text-gray-500 whitespace-nowrap">
                {formatTimeAgo(notification.createdAt)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
