'use client';

import { LiveDataRequiredPage } from '@/components/LiveDataRequiredPage';

interface InvoiceDetailProps {
  invoiceId: string;
}

export function InvoiceDetail({ invoiceId }: InvoiceDetailProps) {
  return (
    <LiveDataRequiredPage
      title={`Invoice ${invoiceId}`}
      feature="invoice detail data"
      description="Fallback invoice details have been removed. This view now requires a live invoice service response."
      showBack
    />
  );
}
