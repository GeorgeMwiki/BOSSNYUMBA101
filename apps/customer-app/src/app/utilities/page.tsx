'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Plus, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

interface UtilityReading {
  id: string;
  type: string;
  icon: LucideIcon;
  lastReading: number;
  unit: string;
  dueDate: string;
  amount: number;
  status: 'pending' | 'paid';
}

interface UtilityBill {
  id: string;
  month: string;
  total: number;
  paid: boolean;
}

// Utility readings and bill history are gated on live utility APIs.
// Until wired, render empty states rather than seeded entries.
const utilities: UtilityReading[] = [];
const recentBills: UtilityBill[] = [];

export default function UtilitiesPage() {
  return (
    <>
      <PageHeader
        title="Utilities"
        action={
          <Link href="/utilities/submit-reading" className="btn-primary text-sm">
            <Plus className="w-4 h-4 mr-1" />
            Submit Reading
          </Link>
        }
      />

      <div className="px-4 py-4 space-y-6">
        {/* Submit Reading CTA */}
        <Link
          href="/utilities/submit-reading"
          className="card p-4 flex items-center justify-between bg-primary-50 border-primary-100 hover:bg-primary-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500 rounded-lg">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-medium">Submit meter reading</div>
              <div className="text-sm text-gray-600">
                Enter your current readings
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-primary-600" />
        </Link>

        {/* Current Readings */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            Current Readings
          </h3>
          {utilities.length === 0 && (
            <div className="card p-4 text-sm text-gray-500">
              No utility readings yet. Submit a new reading to get started.
            </div>
          )}
          <div className="space-y-3">
            {utilities.map((util) => {
              const Icon = util.icon;
              return (
                <div key={util.id} className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Icon className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <div className="font-medium">{util.type}</div>
                        <div className="text-xs text-gray-500">
                          Last: {util.lastReading} {util.unit}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                    <span className="text-gray-500">Due {util.dueDate}</span>
                    <span className="font-medium">
                      KES {util.amount.toLocaleString()}
                    </span>
                  </div>
                  {util.status === 'pending' && (
                    <span className="badge-warning mt-2 inline-block">Pending</span>
                  )}
                  {util.status === 'paid' && (
                    <span className="badge-success mt-2 inline-block">Paid</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Recent Bills */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            Recent Bills
          </h3>
          {recentBills.length === 0 && (
            <div className="card p-4 text-sm text-gray-500">No utility bills yet.</div>
          )}
          <div className="card divide-y divide-gray-100">
            {recentBills.map((bill) => (
              <div
                key={bill.id}
                className="flex items-center justify-between p-4"
              >
                <div>
                  <div className="font-medium text-sm">{bill.month}</div>
                  <div className="text-xs text-gray-500">
                    KES {bill.total.toLocaleString()}
                  </div>
                </div>
                <span
                  className={
                    bill.paid ? 'badge-success' : 'badge-warning'
                  }
                >
                  {bill.paid ? 'Paid' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
