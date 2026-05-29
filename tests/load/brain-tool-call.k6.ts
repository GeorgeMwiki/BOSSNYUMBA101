/**
 * k6 load test — Hot brain tool calls (ported from Borjie).
 *
 * Tool calls are the dominant inner loop when the brain reasons over
 * the owner's day. Latency here directly drives the `brain.turn`
 * envelope — a slow tool blows the streaming SLO.
 *
 * Hot read tools for the property-management estate:
 *   1. owner.properties.list           — open property scan
 *   2. owner.dashboard.snapshot        — cockpit brief read-through
 *   3. owner.maintenance.openCases     — open maintenance roster
 *   4. owner.leases.expiringSoon       — leases ending in <30 days
 *   5. owner.tenants.list              — tenant roster
 *
 * Each is a plain HTTPS GET against its underlying REST endpoint.
 * Per-iteration the VU picks ONE tool at random (weighted equally) so
 * the latency histogram captures the realistic mix.
 *
 * Auth: Supabase bearer required. Without a token the test exercises
 * the 401 path on each tool.
 *
 * Run:
 *   K6_API_URL=http://localhost:4000 \
 *   K6_AUTH_TOKEN=eyJ... \
 *   K6_SCENARIO=normal \
 *   k6 run tests/load/brain-tool-call.k6.ts
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

import { url, buildOptions } from './lib/config';
import { authHeaders, HAS_AUTH_TOKEN } from './lib/auth';

export const options = buildOptions('brain.tool.call');

interface HotTool {
  readonly id: string;
  readonly path: string;
}

const HOT_TOOLS: ReadonlyArray<HotTool> = [
  { id: 'owner.properties.list', path: '/api/v1/properties?limit=25' },
  { id: 'owner.dashboard.snapshot', path: '/api/v1/dashboard' },
  {
    id: 'owner.maintenance.openCases',
    path: '/api/v1/work-orders?status=open&limit=25',
  },
  {
    id: 'owner.leases.expiringSoon',
    path: '/api/v1/leases?expiringWithinDays=30&limit=25',
  },
  { id: 'owner.tenants.list', path: '/api/v1/customers?role=tenant&limit=25' },
];

function pickTool(): HotTool {
  const idx = Math.floor(Math.random() * HOT_TOOLS.length);
  return HOT_TOOLS[idx] ?? HOT_TOOLS[0]!;
}

export default function brainToolCallIteration(): void {
  const tool = pickTool();
  const res = http.get(url(tool.path), {
    headers: authHeaders(),
    tags: { name: 'brain.tool.call', tool: tool.id },
    timeout: '4s',
  });

  if (HAS_AUTH_TOKEN) {
    check(res, {
      [`${tool.id}: 2xx`]: (r) => r.status >= 200 && r.status < 300,
      [`${tool.id}: json envelope`]: (r) => {
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
      [`${tool.id}: 401 (no token)`]: (r) => r.status === 401,
    });
  }

  sleep(0.3);
}
