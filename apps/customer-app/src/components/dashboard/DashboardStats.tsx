'use client';

import { Home, Calendar, Wrench } from 'lucide-react';

const stats = [
  {
    label: 'Unit',
    value: 'A-204',
    icon: Home,
    color: 'bg-primary-50 text-primary-600',
  },
  {
    label: 'Lease Ends',
    value: '45 days',
    icon: Calendar,
    color: 'bg-warning-50 text-warning-600',
  },
  {
    label: 'Open Tickets',
    value: '1',
    icon: Wrench,
    color: 'bg-success-50 text-success-600',
  },
];

export function DashboardStats() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="card p-3 text-center">
            <div className={`inline-flex p-2 rounded-lg ${stat.color} mb-2`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="text-lg font-semibold">{stat.value}</div>
            <div className="text-xs text-gray-500">{stat.label}</div>
          </div>
        );
      })}
    </div>
  );
}
