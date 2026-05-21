// =============================================================================
// Semgrep fixtures — POSITIVE examples (rules MUST fire here)
// =============================================================================
// Each block below is a synthetic case the matching rule in
// `.semgrep/bossnyumba-rules.yml` must detect. CI does not lint these files;
// they exist so contributors can verify their rule changes locally:
//
//   semgrep --config=.semgrep/bossnyumba-rules.yml .semgrep/tests/fixtures/
//
// Expected: one finding per rule below (8 total).
// =============================================================================
/* eslint-disable */
// @ts-nocheck

import type { Context } from 'hono';

declare const customerRepo: any;
declare const logger: any;
declare const c: Context;

// ---------------------------------------------------------------------------
// 1. missing-tenant-id-arg — repo lookup missing tenantId
// ---------------------------------------------------------------------------
async function badTenantScope(id: string) {
  return customerRepo.findById(id); // <-- should fire
}

// ---------------------------------------------------------------------------
// 2. raw-error-response — raw envelope outside error-response.ts
// ---------------------------------------------------------------------------
function badError(c: Context) {
  return c.json({ error: 'NOT_FOUND' }, 404); // <-- should fire
}

// ---------------------------------------------------------------------------
// 3. prototype-pollution-spread — spread untrusted body
// ---------------------------------------------------------------------------
async function badProto(c: Context) {
  const body = await c.req.json();
  const target = { ...body, createdAt: new Date() }; // <-- should fire
  return target;
}

// ---------------------------------------------------------------------------
// 4. unbounded-find-many — limit >= 1000
// ---------------------------------------------------------------------------
async function badFindMany() {
  return customerRepo.findMany({ status: 'active' }, 5000); // <-- should fire
}

// ---------------------------------------------------------------------------
// 5. console-statement-in-production-path
// ---------------------------------------------------------------------------
export function badLog() {
  console.log('user signed in'); // <-- should fire
}

// ---------------------------------------------------------------------------
// 6. as-any-cast
// ---------------------------------------------------------------------------
function badCast(input: unknown) {
  return (input as any).id; // <-- should fire
}

// ---------------------------------------------------------------------------
// 7. missing-await-on-promise
// ---------------------------------------------------------------------------
async function sendEmail(_to: string) {
  /* … */
}
function badAwait() {
  sendEmail('user@example.com'); // <-- should fire
}

// ---------------------------------------------------------------------------
// 8. pii-in-log
// ---------------------------------------------------------------------------
function badPiiLog(password: string) {
  logger.info({ password, action: 'login' }); // <-- should fire
}
