'use client';

import Link from 'next/link';
import { Clock, ArrowRight } from 'lucide-react';

export function UpcomingPaymentSkeleton() {
  return (
    <section>
      <h2 className="text-sm font-medium text-gray-400 mb-3">Upcoming Payment</h2>
      <div className="card p-4 animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-2">
            <div className="h-7 w-32 bg-surface-card rounded" />
            <div className="h-3 w-24 bg-surface-card rounded" />
          </div>
          <div className="h-6 w-16 bg-surface-card rounded-full" />
        </div>
        <div className="space-y-2 mb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="h-3 w-24 bg-surface-card rounded" />
              <div className="h-3 w-16 bg-surface-card rounded" />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="h-10 flex-1 bg-surface-card rounded-lg" />
          <div className="h-10 w-12 bg-surface-card rounded-lg" />
        </div>
      </div>
    </section>
  );
}

export function UpcomingPayment() {
  const dueInDays = 5;
  const amount = 'TZS 45,000';
  const dueDate = 'March 1, 2024';

  return (
    <section>
      <h2 className="text-sm font-medium text-gray-400 mb-3">Upcoming Payment</h2>
      <div className="card p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-2xl font-bold text-white">{amount}</div>
            <div className="text-sm text-gray-400">Due: {dueDate}</div>
          </div>
          <div className="badge-warning">
            <Clock className="w-3 h-3 mr-1" />
            {dueInDays} days
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Monthly Rent</span>
            <span className="text-white">TZS 40,000</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Service Charge</span>
            <span className="text-white">TZS 3,000</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Water Bill</span>
            <span className="text-white">TZS 2,000</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Link href="/payments/pay" className="btn-primary flex-1">
            Pay Now
          </Link>
          <Link href="/payments" className="btn-secondary">
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
