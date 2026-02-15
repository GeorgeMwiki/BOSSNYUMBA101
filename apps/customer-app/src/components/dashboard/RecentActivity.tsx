'use client';

import { CreditCard, Wrench, FileText, CheckCircle } from 'lucide-react';

const activities = [
  {
    id: '1',
    type: 'payment',
    title: 'Rent Payment Received',
    description: 'KES 45,000 paid via M-Pesa',
    time: '2 days ago',
    icon: CreditCard,
    iconColor: 'text-success-600 bg-success-50',
  },
  {
    id: '2',
    type: 'maintenance',
    title: 'Maintenance Request Updated',
    description: 'Plumbing issue scheduled for tomorrow',
    time: '3 days ago',
    icon: Wrench,
    iconColor: 'text-warning-600 bg-warning-50',
  },
  {
    id: '3',
    type: 'document',
    title: 'Statement Available',
    description: 'February 2024 statement ready',
    time: '1 week ago',
    icon: FileText,
    iconColor: 'text-primary-600 bg-primary-50',
  },
  {
    id: '4',
    type: 'maintenance',
    title: 'Maintenance Completed',
    description: 'Electrical repair completed',
    time: '2 weeks ago',
    icon: CheckCircle,
    iconColor: 'text-success-600 bg-success-50',
  },
];

export function RecentActivity() {
  return (
    <section>
      <h2 className="text-sm font-medium text-gray-500 mb-3">Recent Activity</h2>
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
    </section>
  );
}
