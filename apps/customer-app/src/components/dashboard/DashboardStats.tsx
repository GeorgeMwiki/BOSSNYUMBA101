'use client';

import { Home, Calendar, Wrench } from 'lucide-react';
import { useQuery, type LeaseWithDetails } from '@bossnyumba/api-client';

export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card p-3 text-center animate-pulse">
          <div className="w-9 h-9 bg-surface-card rounded-lg mx-auto mb-2" />
          <div className="h-5 w-10 bg-surface-card rounded mx-auto mb-1" />
          <div className="h-3 w-12 bg-surface-card rounded mx-auto" />
        </div>
      ))}
    </div>
  );
}

function getDaysUntil(dateString: string | undefined): string {
  if (!dateString) return '-';
  const end = new Date(dateString);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Expired';
  return `${days} days`;
}

export function DashboardStats() {
  const { data: leases, isLoading } = useQuery<LeaseWithDetails[]>(
    '/leases?status=ACTIVE&pageSize=1',
    { staleTime: 5 * 60 * 1000 }
  );
  const { data: tickets } = useQuery<{ id: string }[]>(
    '/work-orders?status=OPEN&pageSize=100',
    { staleTime: 2 * 60 * 1000 }
  );

  if (isLoading) {
    return <DashboardStatsSkeleton />;
  }

  const lease = leases?.[0];
  const openTicketCount = tickets?.length ?? 0;

  const stats = [
    {
      label: 'Unit',
      value: lease?.unit?.unitNumber ?? '-',
      icon: Home,
      color: 'bg-primary-500/20 text-primary-400',
    },
    {
      label: 'Lease Ends',
      value: getDaysUntil(lease?.endDate),
      icon: Calendar,
      color: 'bg-warning-500/20 text-warning-400',
    },
    {
      label: 'Open Tickets',
      value: String(openTicketCount),
      icon: Wrench,
      color: 'bg-green-500/20 text-green-400',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="card p-3 text-center">
            <div className={`inline-flex p-2 rounded-lg ${stat.color} mb-2`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="text-lg font-semibold text-white">{stat.value}</div>
            <div className="text-xs text-gray-400">{stat.label}</div>
          </div>
        );
      })}
    </div>
  );
}
