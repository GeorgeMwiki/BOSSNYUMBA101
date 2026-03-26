'use client';

import Link from 'next/link';
import { Clock, ArrowRight, AlertTriangle } from 'lucide-react';
import { useQuery, invoicesService, type Invoice } from '@bossnyumba/api-client';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 0 }).format(amount);

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
  const { data: invoices, isLoading, isError } = useQuery<Invoice[]>(
    '/invoices?status=PENDING&pageSize=1',
    { staleTime: 60 * 1000 }
  );

  if (isLoading) {
    return <UpcomingPaymentSkeleton />;
  }

  if (isError) {
    return (
      <section>
        <h2 className="text-sm font-medium text-gray-400 mb-3">Upcoming Payment</h2>
        <div className="card p-4 text-center">
          <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Unable to load payment info</p>
        </div>
      </section>
    );
  }

  const invoice = invoices?.[0];

  if (!invoice) {
    return (
      <section>
        <h2 className="text-sm font-medium text-gray-400 mb-3">Upcoming Payment</h2>
        <div className="card p-4 text-center">
          <p className="text-sm text-gray-400">No upcoming payments</p>
        </div>
      </section>
    );
  }

  const dueDate = new Date(invoice.dueDate);
  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const dueInDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  return (
    <section>
      <h2 className="text-sm font-medium text-gray-400 mb-3">Upcoming Payment</h2>
      <div className="card p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-2xl font-bold text-white">{formatCurrency(invoice.amountDue)}</div>
            <div className="text-sm text-gray-400">
              Due: {dueDate.toLocaleDateString('en-TZ', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
          <div className={dueInDays <= 0 ? 'badge-danger' : 'badge-warning'}>
            <Clock className="w-3 h-3 mr-1" />
            {dueInDays <= 0 ? 'Overdue' : `${dueInDays} days`}
          </div>
        </div>

        {invoice.lineItems && invoice.lineItems.length > 0 && (
          <div className="space-y-2 mb-4">
            {invoice.lineItems.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-gray-400">{item.description}</span>
                <span className="text-white">{formatCurrency(item.total)}</span>
              </div>
            ))}
          </div>
        )}

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
