'use client';

/**
 * WebVitalsReporter — marketing Web Vitals reporter.
 *
 * Marketing has the strictest perf budget (LCP <= 1.5 s, CLS <= 0.05).
 * Gated by `NEXT_PUBLIC_ENABLE_WEB_VITALS=1` so the dev server can opt
 * out of the dynamic import (chunks that aren't needed for first paint
 * shouldn't enter the watcher graph in dev).
 *
 * Intelligence-loss audit: ZERO. Pure additive observer.
 */

import { useEffect } from 'react';
import type { Metric } from 'web-vitals';

import { getCsrfHeaders } from '@/lib/csrf';

interface WebVitalsReporterProps {
  readonly surface: 'marketing';
  readonly endpoint?: string;
}

function postBeacon(endpoint: string, payload: unknown): void {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
      return;
    }
    void fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...getCsrfHeaders() },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never throw from telemetry.
  }
}

export function WebVitalsReporter({
  surface,
  endpoint = '/api/perf/web-vitals',
}: WebVitalsReporterProps): null {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_WEB_VITALS !== '1') return;
    let cancelled = false;

    void import('web-vitals')
      .then((mod) => {
        if (cancelled) return;
        const handle = (metric: Metric) => {
          if (cancelled) return;
          postBeacon(endpoint, {
            surface,
            name: metric.name,
            value: metric.value,
            rating: metric.rating,
            id: metric.id,
            delta: metric.delta,
            navigationType: metric.navigationType,
          });
        };
        mod.onLCP(handle);
        mod.onINP(handle);
        mod.onCLS(handle);
        mod.onTTFB(handle);
        mod.onFCP(handle);
      })
      .catch(() => {
        // web-vitals optional — silent no-op when load fails.
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint, surface]);

  return null;
}
