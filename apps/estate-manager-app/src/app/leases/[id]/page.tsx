'use client';

import { useParams } from 'next/navigation';
import { LeaseDetail } from '@/pages/leases/LeaseDetail';

export default function LeaseDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return <LeaseDetail leaseId={id} />;
}
