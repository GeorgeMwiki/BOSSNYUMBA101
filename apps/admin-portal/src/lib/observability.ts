/**
 * Observability boot for admin-portal (Vite).
 *
 * Reads VITE_SENTRY_DSN + VITE_POSTHOG_KEY at runtime. No-op when empty.
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

type ViteEnv = Readonly<{
  VITE_SENTRY_DSN?: string;
  VITE_POSTHOG_KEY?: string;
  VITE_POSTHOG_HOST?: string;
  VITE_GIT_SHA?: string;
  MODE?: string;
}>;

function readEnv(): ViteEnv {
  // import.meta.env is only available in browser bundlers. Fallback to a
  // read-through into process.env so node-side unit tests also work.
  try {
    const metaEnv = (import.meta as unknown as { env?: ViteEnv }).env;
    if (metaEnv) return metaEnv;
  } catch {
    /* ignored */
  }
  return (typeof process !== 'undefined' ? (process.env as ViteEnv) : {}) ?? {};
}

export async function bootObservability(): Promise<void> {
  if (booted) return;
  booted = true;
  const env = readEnv();

  await initSentry({
    dsn: env.VITE_SENTRY_DSN,
    service: 'admin-portal',
    environment: env.MODE ?? 'production',
    release: env.VITE_GIT_SHA,
    tracesSampleRate: 0.1,
  });
  installGlobalSentryHandlers();

  await initAnalytics({
    apiKey: env.VITE_POSTHOG_KEY,
    host: env.VITE_POSTHOG_HOST,
    service: 'admin-portal',
    environment: env.MODE,
  });
}

export function track(event: AnalyticsEventName, properties?: AnalyticsProperties): void {
  trackEvent(event, properties);
}
