'use client';

import { CreditCard, Wrench, FileText, CheckCircle } from 'lucide-react';

const activities = [
  {
    id: '1',
    type: 'payment',
    title: 'Rent Payment Received',
    description: 'TZS 45,000 paid via M-Pesa',
    time: '2 days ago',
    icon: CreditCard,
    iconColor: 'text-green-400 bg-green-500/20',
  },
  {
    id: '2',
    type: 'maintenance',
    title: 'Maintenance Request Updated',
    description: 'Plumbing issue scheduled for tomorrow',
    time: '3 days ago',
    icon: Wrench,
    iconColor: 'text-warning-400 bg-warning-500/20',
  },
  {
    id: '3',
    type: 'document',
    title: 'Statement Available',
    description: 'February 2024 statement ready',
    time: '1 week ago',
    icon: FileText,
    iconColor: 'text-primary-400 bg-primary-500/20',
  },
  {
    id: '4',
    type: 'maintenance',
    title: 'Maintenance Completed',
    description: 'Electrical repair completed',
    time: '2 weeks ago',
    icon: CheckCircle,
    iconColor: 'text-green-400 bg-green-500/20',
  },
];

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
  return (
    <section>
      <h2 className="text-sm font-medium text-gray-400 mb-3">Recent Activity</h2>
      <div className="card divide-y divide-white/10">
        {activities.map((activity) => {
          const Icon = activity.icon;
          return (
            <div key={activity.id} className="flex items-start gap-3 p-4">
              <div className={`p-2 rounded-lg ${activity.iconColor}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-white">{activity.title}</div>
                <div className="text-sm text-gray-400 truncate">
                  {activity.description}
                </div>
              </div>
              <div className="text-xs text-gray-500 whitespace-nowrap">
                {activity.time}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
