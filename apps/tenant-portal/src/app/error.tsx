'use client';

/**
 * Root segment error boundary — Next.js convention. Catches any unhandled
 * error thrown inside the (admittedly small) tenant-portal route tree so
 * users get an actionable message + reset button instead of a blank page.
 *
 * Sibling `global-error.tsx` would catch errors thrown inside the root
 * <html>/<body> shell itself; this file handles every page rendered
 * underneath the root layout (chat, marketplace, etc.).
 *
 * Closes the "0 of 11 pages have an error state" gap from the
 * 2026-05-25 P91 UI live-test readiness audit.
 */

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

export default function SegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  const t = useTranslations('error');
  useEffect(() => {
    // Surface the failure in the browser console so we can correlate with
    // Sentry / server logs; the digest is server-side to avoid leaking
    // sensitive details to the client UI.
    console.error('[tenant-portal] segment error', error);
  }, [error]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="min-h-screen flex items-center justify-center p-6 bg-surface-subtle text-ink"
    >
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-ink-muted">
          {error.message || t('fallbackMessage')}
        </p>
        {error.digest && (
          <p className="text-xs text-ink-muted/70">{t('reference', { digest: error.digest })}</p>
        )}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 rounded-md bg-brand text-white text-sm font-medium hover:bg-brand/90"
          >
            {t('tryAgain')}
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-md border border-ink-muted/20 text-sm font-medium text-ink hover:bg-ink-muted/5"
          >
            {t('backToStart')}
          </a>
        </div>
      </div>
    </div>
  );
}
