'use client';

import Link from 'next/link';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-6">
        <WifiOff className="h-8 w-8 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold text-foreground text-center">
        You are offline
      </h1>
      <p className="mt-2 text-center text-muted-foreground text-sm">
        Check your connection and try again. Some features may be available from cache.
      </p>
      <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => window.location.reload()}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
        <Link
          href="/"
          className="flex items-center justify-center rounded-lg border border-border px-4 py-3 text-sm font-medium hover:bg-muted"
        >
          Go to home
        </Link>
      </div>
    </main>
  );
}
