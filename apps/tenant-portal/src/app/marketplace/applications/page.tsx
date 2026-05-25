'use client';

/**
 * My applications. Today the api-gateway doesn't expose a read-side
 * `/me/applications` route — when it does we'll wire it. Until then
 * the page renders an informational placeholder with a CTA to keep
 * browsing.
 *
 * Keeping the page in the route tree NOW (rather than later) so:
 *   - the marketplace header link doesn't 404
 *   - the URL is stable: `/marketplace/applications`
 *   - the test surface only changes shape, not location, when the
 *     read-side endpoint ships.
 */

import Link from 'next/link';

export default function ApplicationsPage(): JSX.Element {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold text-ink">My applications</h1>
      <p className="text-sm text-ink-muted">
        Your open applications across every organisation will appear here once
        the read-side endpoint ships. In the meantime, you'll get an email
        confirmation each time you submit one.
      </p>
      <div className="rounded-chat border border-ink-muted/10 bg-surface p-4 text-sm text-ink-muted">
        Tip: applications you submit live in your organisation's pipeline. Each
        org typically replies within 3–5 business days.
      </div>
      <Link
        href="/marketplace/listings"
        className="self-start rounded-chat bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
      >
        Browse listings
      </Link>
    </div>
  );
}
