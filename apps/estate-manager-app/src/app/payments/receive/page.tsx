'use client';

/**
 * /payments/receive is an alias — the real implementation lives at
 * /payments/record (the RecordPayment screen). Keep a single source of truth
 * by delegating, so estate managers can hit either URL without seeing a
 * "coming soon" dead-end.
 */

import { RecordPayment } from '@/screens/payments/RecordPayment';

export default function ReceivePaymentPage() {
  return <RecordPayment />;
}
