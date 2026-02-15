'use client';

import { useParams } from 'next/navigation';
import { PaymentDetail } from '@/pages/payments/PaymentDetail';

export default function PaymentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return <PaymentDetail paymentId={id} />;
}
