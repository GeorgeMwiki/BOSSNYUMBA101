/**
 * Shared k6 auth helper.
 *
 * BossNyumba auth (per CLAUDE.md) is canonically Supabase JWT bearer
 * tokens. We never mint tokens inside k6 — that would require pulling
 * a JOSE library through xk6, breaking the "no new pnpm deps" rule
 * and shifting the test from a load probe to an auth-server stress
 * test. Instead:
 *
 *   1. Operator generates a long-lived test JWT.
 *   2. They export it as `K6_AUTH_TOKEN` (and optionally a tenant id
 *      as `K6_TENANT_ID` for routes that read it from the principal).
 *   3. Every test imports `authHeaders()` and the bearer is attached.
 */

import { AUTH_TOKEN, LOADTEST_RUN_ID, TEST_TENANT_ID } from './config';

export type HttpHeaders = Readonly<Record<string, string>>;

function baseHeaders(): HttpHeaders {
  return {
    'User-Agent': `bossnyumba-k6/1 (${LOADTEST_RUN_ID})`,
    'X-Loadtest-Run-Id': LOADTEST_RUN_ID,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export function authHeaders(extra: HttpHeaders = {}): HttpHeaders {
  const headers: Record<string, string> = {
    ...baseHeaders(),
    ...extra,
  };
  if (AUTH_TOKEN.length > 0) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }
  if (TEST_TENANT_ID.length > 0) {
    headers['X-Tenant-Id'] = TEST_TENANT_ID;
  }
  return headers;
}

export function publicHeaders(extra: HttpHeaders = {}): HttpHeaders {
  return {
    ...baseHeaders(),
    ...extra,
  };
}

export function sseHeaders(extra: HttpHeaders = {}): HttpHeaders {
  return {
    ...authHeaders(extra),
    Accept: 'text/event-stream',
    'Cache-Control': 'no-cache',
  };
}

export const HAS_AUTH_TOKEN: boolean = AUTH_TOKEN.length > 0;
