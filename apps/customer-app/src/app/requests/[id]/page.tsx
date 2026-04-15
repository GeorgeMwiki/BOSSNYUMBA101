'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';

/**
 * The customer app has two equivalent paths for work-order details:
 * `/requests/[id]` and `/maintenance/[id]`. The canonical surface is
 * `/maintenance/[id]`; this page simply redirects to keep links stable.
 */
export default function RequestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;

  useEffect(() => {
    if (id) {
      router.replace(`/maintenance/${id}`);
    } else {
      router.replace('/requests');
    }
  }, [id, router]);

  return (
    <>
      <PageHeader title="Request" showBack />
      <div className="flex items-center justify-center gap-2 px-4 py-16 text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Redirecting...
      </div>
    </>
  );
}
