'use client';

import { useParams } from 'next/navigation';
import { PaymentDetail } from '@/screens/payments/PaymentDetail';

export default function PaymentDetailPage() {
  const params = useParams();
  const id = (params?.id ?? '') as string;

  return <PaymentDetail paymentId={id} />;
}
