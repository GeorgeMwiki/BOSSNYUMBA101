'use client';

import { useParams } from 'next/navigation';
import VendorDetail from '@/screens/vendors/VendorDetail';

export default function VendorDetailPage() {
  const params = useParams();
  return <VendorDetail vendorId={(params?.id ?? '') as string} />;
}
