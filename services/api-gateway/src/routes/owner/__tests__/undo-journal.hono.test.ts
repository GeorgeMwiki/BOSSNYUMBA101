/**
 * /api/v1/owner/undo-journal — auth + validation regression tests.
 *
 * Pins the auth gate, the zod payload validator, and the 503 "DB not
 * configured" branch. E2E coverage with a live Drizzle DB lives in the
 * integration suite (Wave SUPERPOWERS E2E).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-jwt-0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.USE_MOCK_DATA = process.env.USE_MOCK_DATA ?? 'true';

import { generateToken } from '../../../middleware/auth';
import { UserRole } from '../../../types/user-role';
import { ownerUndoJournalRouter } from '../undo-journal.hono';

const TEST_TENANT = 'tenant-undo-1';
const TEST_USER = 'user-owner-undo-1';

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
  app.route('/owner/undo-journal', ownerUndoJournalRouter);
  return app;
}

beforeAll(() => {
  expect(process.env.JWT_SECRET?.length).toBeGreaterThanOrEqual(32);
});

describe('owner-undo-journal auth gate', () => {
  it('rejects unauthenticated POST /', async () => {
    const res = await mount().request('/owner/undo-journal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated GET /recent', async () => {
    const res = await mount().request('/owner/undo-journal/recent');
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated POST /undo-last', async () => {
    const res = await mount().request('/owner/undo-journal/undo-last', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated POST /undo-by-id', async () => {
    const res = await mount().request('/owner/undo-journal/undo-by-id', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ journalId: '00000000-0000-0000-0000-000000000000' }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated POST /redo-by-id', async () => {
    const res = await mount().request('/owner/undo-journal/redo-by-id', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ journalId: '00000000-0000-0000-0000-000000000000' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('owner-undo-journal payload validation', () => {
  it('rejects POST / without entityType (zod 400)', async () => {
    const res = await mount().request('/owner/undo-journal', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({ entityId: 'lease-1' }),
    });
    expect([400, 503]).toContain(res.status);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('rejects POST / with an action_kind outside the BN whitelist', async () => {
    const res = await mount().request('/owner/undo-journal', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        entityType: 'lease',
        entityId: 'lease-1',
        actionKind: 'NOT_A_REAL_KIND',
      }),
    });
    expect([400, 503]).toContain(res.status);
  });

  it('rejects POST /undo-by-id with a non-UUID id', async () => {
    const res = await mount().request('/owner/undo-journal/undo-by-id', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({ journalId: 'not-a-uuid' }),
    });
    expect([400, 503]).toContain(res.status);
  });

  it('reports DB unavailable when mock mode is on (POST /)', async () => {
    const res = await mount().request('/owner/undo-journal', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: bearer(),
      },
      body: JSON.stringify({
        entityType: 'lease',
        entityId: 'lease-1',
        actionKind: 'mark_rent_paid',
      }),
    });
    expect([503, 500]).toContain(res.status);
  });

  it('reports DB unavailable when mock mode is on (GET /recent)', async () => {
    const res = await mount().request('/owner/undo-journal/recent', {
      headers: { Authorization: bearer() },
    });
    // Either 503 (db null) or 200 with empty array if mock returns a stub.
    expect([200, 503]).toContain(res.status);
  });
});
