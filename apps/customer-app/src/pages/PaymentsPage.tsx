'use client';

import { Wallet } from 'lucide-react';

export default function PaymentsPage() {
  return (
    <div className="px-4 py-8 flex flex-col items-center justify-center text-center">
      <div className="p-3 bg-gray-800 rounded-full mb-4">
        <Wallet className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-white font-semibold text-lg">No payments yet</h3>
      <p className="text-gray-400 text-sm mt-1 max-w-xs">
        Your payment history and upcoming invoices will appear here once your lease is active.
      </p>
    </div>
  );
}
