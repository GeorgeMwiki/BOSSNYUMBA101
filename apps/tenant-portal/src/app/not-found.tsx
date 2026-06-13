/**
 * 404 boundary — Next.js convention. Renders whenever a route fails to
 * match or a server component calls `notFound()`. Mirrors the look of
 * `error.tsx` so users get a consistent recovery affordance.
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function NotFound(): Promise<JSX.Element> {
  const t = await getTranslations('notFound');
  return (
    <div
      role="alert"
      aria-live="polite"
      className="min-h-screen flex items-center justify-center p-6 bg-surface-subtle text-ink"
    >
      <div className="max-w-md text-center space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t('code')}</p>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-ink-muted">{t('description')}</p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="px-4 py-2 rounded-md bg-brand text-white text-sm font-medium hover:bg-brand/90"
          >
            {t('backToStart')}
          </Link>
        </div>
      </div>
    </div>
  );
}
