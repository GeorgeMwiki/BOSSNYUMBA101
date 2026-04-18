'use client';

import { useParams } from 'next/navigation';
import { LeaseDetail } from '@/screens/leases/LeaseDetail';

export default function LeaseDetailPage() {
  const params = useParams();
  const id = (params?.id ?? '') as string;

  return <LeaseDetail leaseId={id} />;
}
