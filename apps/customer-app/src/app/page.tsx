'use client';

import { useEffect } from 'react';
// placeholder for testing search_replace
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { UpcomingPayment } from '@/components/dashboard/UpcomingPayment';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { LeaseSummary } from '@/components/dashboard/LeaseSummary';
import { CreditCard } from 'lucide-react';

export default function CustomerAppHome() {
  const { isAuthenticated, loading, user } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = '/auth/login';
    }
  }, [isAuthenticated, loading]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const greeting = user?.firstName
    ? `Welcome back, ${user.firstName}!`
    : 'Welcome back!';

  return (
    <main className="min-h-screen bg-background">
      <PageHeader title="BOSSNYUMBA" />

      <div className="px-4 py-4 pb-24">
        {/* Greeting */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">{greeting}</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage your tenancy</p>
        </div>

        {/* Current Balance Card */}
        <section className="mb-6">
          <div className="card p-5 bg-gradient-to-br from-primary-600 to-primary-700 text-white rounded-xl">
            <div className="text-sm opacity-90 mb-1">Current Balance Due</div>
            <div className="text-3xl font-bold mb-1">KES 45,000</div>
            <div className="text-sm opacity-90 mb-4">Next due: March 1, 2024</div>
            <Link
              href="/payments/pay"
              className="btn bg-white text-primary-700 flex items-center justify-center gap-2 py-4 text-base font-semibold rounded-xl w-full min-h-[48px] active:scale-[0.98] transition-transform"
            >
              <CreditCard className="w-5 h-5" />
              Quick Pay
            </Link>
          </div>
        </section>

        {/* Stats */}
        <div className="mb-6">
          <DashboardStats />
        </div>

        {/* Upcoming Payment */}
        <div className="mb-6">
          <UpcomingPayment />
        </div>

        {/* Current Lease Summary */}
        <div className="mb-6">
          <LeaseSummary />
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <QuickActions />
        </div>

        {/* Recent Activity */}
        <RecentActivity />
      </div>
    </main>
  );
}
