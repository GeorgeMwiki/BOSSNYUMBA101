/**
 * k6 load test — Cockpit SSE subscriber (ported from Borjie).
 *
 * Owner-portal opens a long-lived SSE stream against
 * `/api/v1/cockpit/stream` (see
 * `services/api-gateway/src/routes/cockpit-stream.hono.ts`). The first
 * frame the server emits is `event: connected` with the opened-at
 * timestamp — that is the user-perceived "the dot turned green"
 * moment. We measure how quickly that first frame arrives.
 *
 * Endpoint: GET /api/v1/cockpit/stream  (Accept: text/event-stream)
 *
 * SLO: p95 < 250 ms / p99 < 600 ms (per `lib/config.ts` →
 *      `cockpit.sse.subscribe`).
 *
 * Auth: Supabase bearer required. The route hard-rejects a missing
 * `auth.tenantId` so unsigned runs land on the 401 path.
 *
 * Run:
 *   K6_API_URL=http://localhost:4000 \
 *   K6_AUTH_TOKEN=eyJ... \
 *   K6_SCENARIO=normal \
 *   k6 run tests/load/cockpit-sse-subscriber.k6.ts
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

import { url, buildOptions } from './lib/config';
import { sseHeaders, HAS_AUTH_TOKEN } from './lib/auth';

export const options = buildOptions('cockpit.sse.subscribe');

export default function cockpitSseIteration(): void {
  // k6 cannot consume an open SSE stream forever — we cap the read at
  // 2 seconds. The server emits the `connected` packet immediately
  // after the abort-signal wiring runs.
  const res = http.get(url('/api/v1/cockpit/stream'), {
    headers: sseHeaders(),
    tags: { name: 'cockpit.sse.subscribe' },
    timeout: '2s',
  });

  if (HAS_AUTH_TOKEN) {
    check(res, {
      'status is 200': (r) => r.status === 200,
      'content-type is event-stream': (r) => {
        const ct = (r.headers['Content-Type'] ??
          r.headers['content-type'] ??
          '') as string;
        return ct.includes('text/event-stream');
      },
      'first event is connected': (r) => {
        const body = typeof r.body === 'string' ? r.body : '';
        if (body.length === 0) return false;
        const head = body.slice(0, 512);
        return head.includes('event: connected');
      },
    });
  } else {
    check(res, {
      'status is 401 (no token)': (r) => r.status === 401,
    });
  }

  // 1s think-time mirrors a slow user reload cadence.
  sleep(1);
}
