'use client';

import { useParams } from 'next/navigation';
import { InvoiceDetail } from '@/pages/payments/InvoiceDetail';

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return <InvoiceDetail invoiceId={id} />;
}
