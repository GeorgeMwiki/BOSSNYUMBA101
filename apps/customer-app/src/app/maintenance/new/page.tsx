'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function NewMaintenancePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the requests/new page which handles maintenance requests
    router.replace('/requests/new');
  }, [router]);

  return null;
}
