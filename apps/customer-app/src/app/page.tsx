'use client';

import { useQuery } from '@bossnyumba/api-client';
import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { UpcomingPayment, UpcomingPaymentSkeleton } from '@/components/dashboard/UpcomingPayment';
import { RecentActivity, RecentActivitySkeleton } from '@/components/dashboard/RecentActivity';
import { LeaseSummary } from '@/components/dashboard/LeaseSummary';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { DashboardStats, DashboardStatsSkeleton } from '@/components/dashboard/DashboardStats';

function DashboardSkeleton() {
  return (
    <div className="space-y-6 px-4 pt-4 pb-24">
      <DashboardStatsSkeleton />
      <UpcomingPaymentSkeleton />
      <div className="animate-pulse">
        <div className="h-4 w-28 bg-surface-card rounded mb-3" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-12 h-12 bg-surface-card rounded-xl mb-2" />
              <div className="h-3 w-10 bg-surface-card rounded" />
            </div>
          ))}
        </div>
      </div>
      <RecentActivitySkeleton />
    </div>
  );
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <AlertTriangle className="w-12 h-12 text-warning-400 mb-4" />
      <h2 className="text-lg font-semibold text-white mb-2">Something went wrong</h2>
      <p className="text-gray-400 text-sm mb-6">We could not load your dashboard. Please try again.</p>
      <button onClick={onRetry} className="btn-primary px-6 py-2">
        Retry
      </button>
    </div>
  );
}

export default function HomePage() {
  const { isLoading, isError, refetch } = useQuery('/dashboard', {
    staleTime: 60 * 1000,
  });

  return (
    <div>
      <PageHeader title="Home" showSettings />
      {isLoading ? (
        <DashboardSkeleton />
      ) : isError ? (
        <DashboardError onRetry={refetch} />
      ) : (
        <div className="space-y-6 px-4 pt-4 pb-24">
          <DashboardStats />
          <UpcomingPayment />
          <QuickActions />
          <LeaseSummary />
          <RecentActivity />
        </div>
      )}
    </div>
  );
}
