'use client';

import Link from 'next/link';
import { Clock, ArrowRight } from 'lucide-react';

export function UpcomingPayment() {
  const dueInDays = 5;
  const amount = 'KES 45,000';
  const dueDate = 'March 1, 2024';

  return (
    <section>
      <h2 className="text-sm font-medium text-gray-500 mb-3">Upcoming Payment</h2>
      <div className="card p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-2xl font-bold text-gray-900">{amount}</div>
            <div className="text-sm text-gray-500">Due: {dueDate}</div>
          </div>
          <div className="badge-warning">
            <Clock className="w-3 h-3 mr-1" />
            {dueInDays} days
          </div>
        </div>
        
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Monthly Rent</span>
            <span>KES 40,000</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Service Charge</span>
            <span>KES 3,000</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Water Bill</span>
            <span>KES 2,000</span>
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
