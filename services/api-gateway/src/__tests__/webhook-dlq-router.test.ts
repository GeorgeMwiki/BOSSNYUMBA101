/**
 * Integration-ish tests for the webhook DLQ admin router.
 *
 * We mount the router exactly as the gateway does — `api.route('/', router)`
 * onto a base Hono app — and hit it with fetch-shaped Request objects. A valid
 * admin JWT is minted via `generateToken` from the gateway's own auth
 * middleware so `authMiddleware` accepts the call.
 *
 * SURFACE CONTRACT: in production the base `api` app is served by Express at
 * `app.use('/api/v1', handle(api))`, and the `@hono/node-server` adapter STRIPS
 * the `/api/v1` mount prefix before Hono routes. So the router registers
 * RELATIVE paths (`/webhooks/dead-letters`, …) and the live public surface is
 * `/api/v1/webhooks/dead-letters`. These tests therefore drive the relative
 * path (post-strip) — the same string Hono sees behind the adapter. Requesting
 * the absolute `/api/v1/...` literal here would 404, which is exactly the
 * regression this suite now guards (see `RELATIVE_BASE` / the 404 assertion).
 *
 * NOTE: `getJwtSecret()` captures the secret once per process, so do NOT
 * rewrite JWT_SECRET from inside a test — it won't propagate. The ephemeral
 * dev secret (generated on first import) is shared by auth.ts and
 * hono-auth.ts, which is exactly what we need here.
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createWebhookDlqRouter } from '../routes/webhook-dlq.hono';
import { generateToken } from '../middleware/auth';
import { UserRole } from '../types/user-role';
import type {
  WebhookDeliveryRepository,
  WebhookDeadLetterRecord,
  WebhookDeliveryQueued,
} from '../workers/webhook-retry-worker';

/**
 * The path Hono actually sees behind the `app.use('/api/v1', handle(api))`
 * adapter (the `/api/v1` prefix is stripped). The composed public URL is
 * `${COMPOSED_PUBLIC_BASE}` = `/api/v1${RELATIVE_BASE}`.
 */
const RELATIVE_BASE = '/webhooks/dead-letters';
const COMPOSED_PUBLIC_BASE = `/api/v1${RELATIVE_BASE}`;

function makeRepo(seed: WebhookDeadLetterRecord[] = []) {
  const state = {
    dlq: [...seed] as WebhookDeadLetterRecord[],
    replayed: [] as { id: string; by: string; replayDeliveryId: string }[],
    attempts: [] as unknown[],
  };
  const repo: WebhookDeliveryRepository = {
    async recordAttempt() {
      /* not exercised here */
    },
    async moveToDeadLetters() {
      /* not exercised here */
    },
    async listDeadLetters(f) {
      const items = f.tenantId
        ? state.dlq.filter((e) => e.tenantId === f.tenantId)
        : state.dlq;
      return items.slice(f.offset ?? 0, (f.offset ?? 0) + (f.limit ?? items.length));
    },
    async getDeadLetter(id) {
      return state.dlq.find((e) => e.id === id) ?? null;
    },
    async markDeadLetterReplayed(id, by, replayDeliveryId) {
      state.replayed.push({ id, by, replayDeliveryId });
    },
  };
  return { state, repo };
}

function adminToken(tenantId = 'tnt-1'): string {
  return generateToken({
    userId: 'admin-1',
    tenantId,
    role: UserRole.TENANT_ADMIN,
    permissions: ['*'],
    propertyAccess: [],
  });
}

function memberToken(): string {
  return generateToken({
    userId: 'user-1',
    tenantId: 'tnt-1',
    role: UserRole.RESIDENT,
    permissions: [],
    propertyAccess: [],
  });
}

function buildApp(deps: {
  repo: WebhookDeliveryRepository;
  requeue: (e: WebhookDeliveryQueued) => Promise<string>;
}) {
  // Mirror the gateway's composition root: `api.route('/', webhookDlqRouter)`
  // onto a base Hono app. Behind the Express `/api/v1` adapter the prefix is
  // stripped, so requests in these tests use the post-strip RELATIVE_BASE.
  const app = new Hono();
  app.route(
    '/',
    createWebhookDlqRouter({
      repository: deps.repo,
      requeue: deps.requeue,
      now: () => 1_700_000_000_000,
      generateId: () => 'abc123xy',
    })
  );
  return app;
}

function sampleDlq(
  overrides: Partial<WebhookDeadLetterRecord> = {}
): WebhookDeadLetterRecord {
  return {
    id: 'dlq-1',
    deliveryId: 'del-1',
    tenantId: 'tnt-1',
    targetUrl: 'https://example.test/webhook',
    eventType: 'invoice.paid',
    payload: { id: 'inv-1' },
    totalAttempts: 5,
    lastStatusCode: 503,
    lastError: 'upstream timeout',
    firstAttemptAt: new Date('2026-04-01T00:00:00Z'),
    lastAttemptAt: new Date('2026-04-01T00:05:00Z'),
    ...overrides,
  };
}

describe('webhook DLQ router', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const { repo } = makeRepo();
    const app = buildApp({ repo, requeue: async () => 'new-id' });
    const res = await app.request(RELATIVE_BASE);
    expect(res.status).toBe(401);
  });

  it('rejects non-admin roles with 403', async () => {
    const { repo } = makeRepo();
    const app = buildApp({ repo, requeue: async () => 'new-id' });
    const res = await app.request(RELATIVE_BASE, {
      headers: { Authorization: `Bearer ${memberToken()}` },
    });
    expect(res.status).toBe(403);
  });

  it('LIVE DETECTOR: routes are RELATIVE so the composed Express+Hono surface is /api/v1/webhooks/dead-letters', async () => {
    const { repo } = makeRepo([sampleDlq({ tenantId: 'tnt-1' })]);
    const app = buildApp({ repo, requeue: async () => 'new-id' });

    // Document the contract explicitly.
    expect(COMPOSED_PUBLIC_BASE).toBe('/api/v1/webhooks/dead-letters');

    // The router (mounted at '/') must answer the POST-STRIP relative path —
    // the exact string Hono receives behind `app.use('/api/v1', handle(api))`.
    const relative = await app.request(RELATIVE_BASE, {
      headers: { Authorization: `Bearer ${adminToken('tnt-1')}` },
    });
    expect(relative.status).toBe(200);

    // Regression guard: the OLD absolute literal must NOT match anymore. If the
    // router ever re-adds the `/api/v1` prefix, this un-stripped path would 200
    // here while 404-ing in production. Behind the adapter Hono never sees the
    // prefix, so requesting it against the un-mounted router must 404.
    const absolute = await app.request(COMPOSED_PUBLIC_BASE, {
      headers: { Authorization: `Bearer ${adminToken('tnt-1')}` },
    });
    expect(absolute.status).toBe(404);
  });

  it('lists DLQ entries scoped to the caller tenant', async () => {
    const { repo } = makeRepo([
      sampleDlq({ id: 'dlq-a', tenantId: 'tnt-1' }),
      sampleDlq({ id: 'dlq-b', tenantId: 'tnt-other' }),
    ]);
    const app = buildApp({ repo, requeue: async () => 'new-id' });
    const res = await app.request(RELATIVE_BASE, {
      headers: { Authorization: `Bearer ${adminToken('tnt-1')}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: WebhookDeadLetterRecord[];
    };
    expect(body.success).toBe(true);
    expect(body.data.map((e) => e.id)).toEqual(['dlq-a']);
  });

  it('fetches a single DLQ entry by id', async () => {
    const { repo } = makeRepo([sampleDlq()]);
    const app = buildApp({ repo, requeue: async () => 'new-id' });
    const res = await app.request(`${RELATIVE_BASE}/dlq-1`, {
      headers: { Authorization: `Bearer ${adminToken()}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: WebhookDeadLetterRecord };
    expect(body.data.deliveryId).toBe('del-1');
  });

  it('returns 404 when fetching another tenant’s DLQ entry', async () => {
    const { repo } = makeRepo([sampleDlq({ tenantId: 'tnt-other' })]);
    const app = buildApp({ repo, requeue: async () => 'new-id' });
    const res = await app.request(`${RELATIVE_BASE}/dlq-1`, {
      headers: { Authorization: `Bearer ${adminToken('tnt-1')}` },
    });
    expect(res.status).toBe(404);
  });

  it('replays a DLQ entry: requeues + marks replayed + returns new deliveryId', async () => {
    const { repo, state } = makeRepo([sampleDlq()]);
    const requeued: WebhookDeliveryQueued[] = [];
    const app = buildApp({
      repo,
      requeue: async (e) => {
        requeued.push(e);
        return e.deliveryId;
      },
    });

    const res = await app.request(`${RELATIVE_BASE}/dlq-1/replay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken()}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { id: string; replayDeliveryId: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.replayDeliveryId).toMatch(/^del-1-replay-/);
    expect(requeued).toHaveLength(1);
    expect(requeued[0].targetUrl).toBe('https://example.test/webhook');
    expect(requeued[0].payload).toEqual({ id: 'inv-1' });
    expect(state.replayed).toHaveLength(1);
    expect(state.replayed[0].id).toBe('dlq-1');
    expect(state.replayed[0].by).toBe('admin-1');
  });

  it('returns 404 when replaying a non-existent entry', async () => {
    const { repo } = makeRepo();
    const app = buildApp({ repo, requeue: async () => 'x' });
    const res = await app.request(`${RELATIVE_BASE}/missing/replay`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken()}` },
    });
    expect(res.status).toBe(404);
  });
});
