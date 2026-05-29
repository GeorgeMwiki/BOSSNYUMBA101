/**
 * k6 load test — Owner dashboard composite read (ported from Borjie).
 *
 * Measured p95 / p99 for the compound dashboard load. The cockpit
 * issues three GETs per home paint, all on the owner's first second.
 *
 * The three calls are issued sequentially per iteration. The k6 tag
 * `name=dashboard.read` aggregates the three sub-requests; the per-tag
 * thresholds enforce the cockpit SLO at the compound level —
 * p95 < 800 ms, p99 < 1 500 ms.
 *
 * Auth: Supabase bearer via `K6_AUTH_TOKEN`. Without a token the
 * test exercises the 401 path so the route's gate is verified.
 *
 * Run:
 *   K6_API_URL=http://localhost:4000 \
 *   K6_AUTH_TOKEN=eyJ... \
 *   K6_SCENARIO=normal \
 *   k6 run tests/load/dashboard-read.k6.ts
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

import { url, buildOptions } from './lib/config';
import { authHeaders, HAS_AUTH_TOKEN } from './lib/auth';

export const options = buildOptions('dashboard.read');

const DASHBOARD_ENDPOINTS: ReadonlyArray<{
  readonly path: string;
  readonly tag: string;
}> = [
  { path: '/api/v1/dashboard', tag: 'dashboard.read.dashboard' },
  { path: '/api/v1/notifications?limit=10', tag: 'dashboard.read.notifications' },
  { path: '/api/v1/properties?limit=10', tag: 'dashboard.read.properties' },
];

export default function dashboardReadIteration(): void {
  const headers = authHeaders();

  for (const { path, tag } of DASHBOARD_ENDPOINTS) {
    const res = http.get(url(path), {
      headers,
      tags: { name: tag },
      timeout: '8s',
    });

    if (HAS_AUTH_TOKEN) {
      check(res, {
        [`${tag}: 2xx`]: (r) => r.status >= 200 && r.status < 300,
        [`${tag}: json envelope`]: (r) => {
          try {
            const j = r.json();
            return j !== null && typeof j === 'object';
          } catch {
            return false;
          }
        },
      });
    } else {
      check(res, {
        [`${tag}: 401 (no token)`]: (r) => r.status === 401,
      });
    }
  }

  // Mirror real-user think-time between dashboard paints.
  sleep(2);
}
