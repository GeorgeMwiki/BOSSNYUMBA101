'use client';

import { useParams } from 'next/navigation';
import { LeaseRenewal } from '@/pages/leases/LeaseRenewal';

export default function LeaseRenewalPage() {
  const params = useParams();
  const id = params.id as string;

  return <LeaseRenewal leaseId={id} />;
}
