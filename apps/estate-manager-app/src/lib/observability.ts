/**
 * Observability boot for estate-manager-app (Next.js 15).
 *
 * Reads NEXT_PUBLIC_SENTRY_DSN + NEXT_PUBLIC_POSTHOG_KEY from env at runtime.
 * Both are no-op when their env var is empty.
 */

import {
  initSentry,
  installGlobalSentryHandlers,
  initAnalytics,
  trackEvent,
  type AnalyticsEventName,
  type AnalyticsProperties,
} from '@bossnyumba/observability';

let booted = false;

export async function bootObservability(): Promise<void> {
  if (booted) return;
  booted = true;

  await initSentry({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    service: 'estate-manager-app',
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'production',
    release: process.env.NEXT_PUBLIC_GIT_SHA,
    tracesSampleRate: 0.1,
  });
  installGlobalSentryHandlers();

  await initAnalytics({
    apiKey: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    service: 'estate-manager-app',
    environment: process.env.NODE_ENV,
  });
}

export function track(event: AnalyticsEventName, properties?: AnalyticsProperties): void {
  trackEvent(event, properties);
}
