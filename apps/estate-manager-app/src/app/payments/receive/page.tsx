'use client';

import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

export default function ReceivePaymentPage() {
  return (
    <>
      <PageHeader title="Receive Payment" showBack />

      <div className="px-4 py-6 max-w-2xl mx-auto">
        <div className="card p-8 text-center">
          <CreditCard className="w-12 h-12 mx-auto text-primary-500 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Record Payment</h2>
          <p className="text-gray-500 text-sm mb-6">
            This feature allows estate managers to record manual payments received from tenants.
            Full implementation coming soon.
          </p>
          <Link href="/" className="btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </>
  );
}
