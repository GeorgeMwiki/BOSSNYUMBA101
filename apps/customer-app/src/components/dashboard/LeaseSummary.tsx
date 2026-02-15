'use client';

import Link from 'next/link';
import { FileText, ChevronRight, Home } from 'lucide-react';

// Mock lease data - would come from API/React Query
const lease = {
  property: 'Sunset Apartments',
  unit: 'A-204',
  type: '2 Bedroom',
  endDate: '2024-05-31',
  daysRemaining: 75,
};

export function LeaseSummary() {
  return (
    <section>
      <h2 className="text-sm font-medium text-gray-500 mb-3">Current Lease</h2>
      <Link href="/lease">
        <div className="card p-4 active:scale-[0.99] transition-transform">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 bg-primary-50 rounded-lg flex-shrink-0">
                <Home className="w-5 h-5 text-primary-600" />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {lease.property} · {lease.unit}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {lease.type} · Ends in {lease.daysRemaining} days
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm text-primary-600">
            <FileText className="w-4 h-4" />
            <span>View full lease details</span>
          </div>
        </div>
      </Link>
    </section>
  );
}
