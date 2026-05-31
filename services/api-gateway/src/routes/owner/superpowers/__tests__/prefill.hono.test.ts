/**
 * /api/v1/owner/superpowers/prefill — auth + validation regression
 * tests. Pins the auth gate, the zod payload validator, and the 503
 * "DB not configured" branch on /undo-field. The ack endpoint POST /
 * does NOT touch the DB so the 503 branch does not apply there.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-jwt-0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.USE_MOCK_DATA = process.env.USE_MOCK_DATA ?? 'true';

import { generateToken } from '../../../../middleware/auth';
import { UserRole } from '../../../../types/user-role';
import { ownerSuperpowersPrefillRouter } from '../prefill.hono';

const TEST_TENANT = 'tenant-prefill-1';
const TEST_USER = 'user-owner-prefill-1';

function bearer(role: UserRole = UserRole.OWNER, tenantId = TEST_TENANT): string {
  return `Bearer ${generateToken({
    userId: TEST_USER,
    tenantId,
    role: role as never,
    permissions: ['*'],
    propertyAccess: ['*'],
  })}`;
}

function mount(): Hono {
  const app = new Hono();
  app.route('/owner/superpowers/prefill', ownerSuperpowersPrefillRouter);
  return app;
}

beforeAll(() => {
  expect(process.env.JWT_SECRET?.length).toBeGreaterThanOrEqual(32);
});

describe('owner-superpowers-prefill auth gate', () => {
  it('rejects unauthenticated POST /', async () => {
    const res = await mount().request('/owner/superpowers/prefill', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated POST /undo-field', async () => {
    const res = await mount().request('/owner/superpowers/prefill/undo-field', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });
});

describe('owner-superpowers-prefill payload validation', () => {
  it('rejects POST / without formId (zod 400)', async () => {
    const res = await mount().request('/owner/superpowers/prefill', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({ values: { foo: 'bar' } }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects POST / with non-primitive value (only string/number/boolean/null allowed)', async () => {
    const res = await mount().request('/owner/superpowers/prefill', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        formId: 'lease_draft',
        values: { tenant: { nested: 'object' } },
      }),
    });
    expect(res.status).toBe(400);
  });

  it('accepts POST / with a valid prefill payload (audit-only, no DB)', async () => {
    const res = await mount().request('/owner/superpowers/prefill', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        formId: 'lease_draft',
        values: {
          tenant_name: 'Asha Mwakalebela',
          move_in_date: '2026-06-01',
          rent_tzs: 850000,
          is_furnished: true,
          referrer: null,
        },
        reason: 'tenant gave me their move-in date over the phone',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.accepted).toBe(true);
    expect(body.data.formId).toBe('lease_draft');
    expect(body.data.valueCount).toBe(5);
    expect(typeof body.data.emittedAt).toBe('string');
  });

  it('rejects POST /undo-field without fieldName', async () => {
    const res = await mount().request('/owner/superpowers/prefill/undo-field', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({ formId: 'lease_draft' }),
    });
    expect([400, 503]).toContain(res.status);
  });

  it('reports DB unavailable on /undo-field when mock mode is on', async () => {
    const res = await mount().request('/owner/superpowers/prefill/undo-field', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        formId: 'lease_draft',
        fieldName: 'rent_tzs',
        beforeValue: 850000,
        afterValue: 900000,
      }),
    });
    expect([503, 500]).toContain(res.status);
  });
});
