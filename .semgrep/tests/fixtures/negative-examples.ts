// =============================================================================
// Semgrep fixtures — NEGATIVE examples (rules MUST NOT fire here)
// =============================================================================
// Mirrors `positive-examples.ts`. If any rule fires on this file, the rule
// has a false-positive problem.
// =============================================================================
/* eslint-disable */
// @ts-nocheck

import type { Context } from 'hono';
import { errorResponse } from '../../../services/api-gateway/src/utils/error-response';

declare const customerRepo: any;
declare const logger: any;

// 1. tenant id present
async function goodTenantScope(id: string, tenantId: string) {
  return customerRepo.findById(id, tenantId);
}

// 2. uses canonical helper
function goodError(c: Context) {
  return errorResponse(c, 'NOT_FOUND', 'Customer not found', 404);
}

// 3. uses Object.create(null) base
async function goodProto(c: Context) {
  const body = await c.req.json();
  const safe = Object.create(null);
  Object.assign(safe, body);
  return safe;
}

// 4. small/explicit pagination
async function goodFindMany(tenantId: string) {
  return customerRepo.findMany({ status: 'active' }, tenantId, 50);
}

// 5. structured logger (no `console.*`)
export function goodLog() {
  logger.info('user signed in');
}

// 6. proper cast through unknown
function goodCast(input: unknown) {
  return (input as unknown as { id: string }).id;
}

// 7. awaited or returned
async function sendEmail(_to: string) {
  /* … */
}
async function goodAwait() {
  await sendEmail('user@example.com');
}

// 8. redacted log
function goodPiiLog(password: string) {
  logger.info({ passwordPresent: Boolean(password), action: 'login' });
}
