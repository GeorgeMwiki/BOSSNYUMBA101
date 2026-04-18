'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

export function InvoicesList() {
  return (
    <LiveDataRequiredPage
      title="Invoices"
      feature="invoice list data"
      description="Fallback invoices have been removed. This list now requires the live invoicing backend."
    />
  );
}
