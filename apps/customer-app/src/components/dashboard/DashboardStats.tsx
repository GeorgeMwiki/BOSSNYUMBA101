'use client';

import type { LucideIcon } from 'lucide-react';

export interface DashboardStat {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
}

interface DashboardStatsProps {
  stats?: DashboardStat[];
  loading?: boolean;
  error?: string | null;
}

export function DashboardStats({ stats, loading, error }: DashboardStatsProps) {
  if (loading) {
    return <div className="card p-3 text-sm text-gray-500">Loading stats...</div>;
  }
  if (error) {
    return (
      <div className="card border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
        {error}
      </div>
    );
  }
  if (!stats || stats.length === 0) {
    return null;
  }
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
