'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Legacy /pages entry. The active Next.js App Router implementation lives at
 * src/app/maintenance/. This page simply redirects users there.
 */
export default function MaintenancePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/maintenance');
  }, [router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-gray-50">
      <Loader2 className="w-8 h-8 text-primary-600 animate-spin mb-4" />
      <p className="text-gray-600 mb-4">Redirecting to Maintenance…</p>
      <Link href="/maintenance" className="btn-primary">
        Open Maintenance
      </Link>
    </main>
  );
}
