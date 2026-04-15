'use client';

import type { LucideIcon } from 'lucide-react';

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  time: string;
  icon: LucideIcon;
  iconColor: string;
}

interface RecentActivityProps {
  activities?: ActivityItem[];
  loading?: boolean;
  error?: string | null;
}

export function RecentActivity({ activities, loading, error }: RecentActivityProps) {
  return (
    <section>
      <h2 className="text-sm font-medium text-gray-500 mb-3">Recent Activity</h2>
      {loading && (
        <div className="card p-4 text-sm text-gray-500">Loading activity...</div>
      )}
      {error && (
        <div className="card border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
          {error}
        </div>
      )}
      {!loading && !error && (!activities || activities.length === 0) && (
        <div className="card p-4 text-sm text-gray-500">No recent activity.</div>
      )}
      {activities && activities.length > 0 && (
        <div className="card divide-y divide-gray-100">
          {activities.map((activity) => {
            const Icon = activity.icon;
            return (
              <div key={activity.id} className="flex items-start gap-3 p-4">
                <div className={`p-2 rounded-lg ${activity.iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{activity.title}</div>
                  <div className="text-sm text-gray-500 truncate">
                    {activity.description}
                  </div>
                </div>
                <div className="text-xs text-gray-400 whitespace-nowrap">
                  {activity.time}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
