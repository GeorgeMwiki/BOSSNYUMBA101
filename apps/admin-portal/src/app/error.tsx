'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Logomark } from '@bossnyumba/design-system';

/**
 * Admin portal — App Router error boundary.
 *
 * Client component (required by Next.js). Stack traces never render in
 * production — only the digest is user-facing in that mode.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[admin-portal] route error:', error);
  }, [error]);

  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="absolute left-6 top-6">
        <Logomark size={32} aria-label="BossNyumba" />
      </div>

      <div className="mx-auto w-full max-w-xl rounded-2xl border border-border bg-surface p-8 text-center shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-signal-500/15 text-signal-500">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </div>

        <h1 className="mt-6 font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          Something broke. We&rsquo;re on it.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          Mwikila has already logged this to the audit trail. Try again, or go
          home.
        </p>

        {isDev && error?.message ? (
          <pre className="mt-6 overflow-x-auto rounded-md border border-border bg-background px-4 py-3 text-left font-mono text-xs text-neutral-500">
            {truncate(error.message)}
            {error.digest ? `\n\ndigest: ${error.digest}` : ''}
          </pre>
        ) : null}

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-md bg-signal-500 px-5 py-2.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-signal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-signal-500/60 hover:text-signal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}

function truncate(input: string, max = 480): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max)}...`;
}
