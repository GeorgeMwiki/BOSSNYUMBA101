/**
 * Integration tests for Work Order endpoints (wave-5 contract).
 *
 * NEW lifecycle (routes/work-orders.hono.ts):
 *   POST /work-orders                  -> 201, status=submitted
 *   POST /work-orders/:id/triage       -> 200, status=triaged
 *   POST /work-orders/:id/assign       -> 200, status=assigned, vendorId set
 *   POST /work-orders/:id/start        -> 200, status=in_progress
 *   POST /work-orders/:id/complete     -> 200, status=pending_verification
 *      Accepts both:
 *        - application/json body { completionNotes, afterPhotos: string[] }
 *        - multipart/form-data with `payload` JSON field plus uploaded files
 *          under `afterPhotos` / `photos` / `proof`
 *   POST /work-orders/:id/rating       -> 200, status -> completed if it was
 *                                                     pending_verification
 *   POST /work-orders/:id/cancel       -> 200, status=cancelled
 *
 * Tests mock `../middleware/database` with an in-memory work-orders repo plus
 * mock the storage and notification dispatcher so the multipart upload test
 * never touches S3.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { generateToken } from '../middleware/auth';
import { UserRole } from '../types/user-role';

// ---------------------------------------------------------------------------
// In-memory work orders repo
// ---------------------------------------------------------------------------

interface WorkOrderRow {
  id: string;
  tenantId: string;
  propertyId?: string;
  unitId?: string;
  customerId?: string;
  vendorId?: string;
  workOrderNumber: string;
  priority: string;
  status: string;
  category: string;
  source: string;
  title: string;
  description?: string;
  location?: string;
  attachments: any[];
  estimatedCost?: number;
  actualCost?: number;
  currency: string;
  scheduledAt?: Date | null;
  completedAt?: Date | null;
  completionNotes?: string;
  timeline: any[];
  createdBy: string;
  updatedBy: string;
}

const seed = () => ({
  workOrders: new Map<string, WorkOrderRow>(),
});

let store = seed();

const repos = {
  workOrders: {
    findMany: vi.fn(async (tenantId: string) => ({
      items: [...store.workOrders.values()].filter((w) => w.tenantId === tenantId),
    })),
    findById: vi.fn(async (id: string, tenantId: string) => {
      const row = store.workOrders.get(id);
      if (!row || row.tenantId !== tenantId) return null;
      return row;
    }),
    findByProperty: vi.fn(async (propertyId: string, tenantId: string) => ({
      items: [...store.workOrders.values()].filter(
        (w) => w.tenantId === tenantId && w.propertyId === propertyId
      ),
    })),
    findByCustomer: vi.fn(async (customerId: string, tenantId: string) => ({
      items: [...store.workOrders.values()].filter(
        (w) => w.tenantId === tenantId && w.customerId === customerId
      ),
    })),
    findByVendor: vi.fn(async (vendorId: string, tenantId: string) => ({
      items: [...store.workOrders.values()].filter(
        (w) => w.tenantId === tenantId && w.vendorId === vendorId
      ),
    })),
    findByStatus: vi.fn(async (status: string, tenantId: string) => ({
      items: [...store.workOrders.values()].filter(
        (w) => w.tenantId === tenantId && w.status === status
      ),
    })),
    create: vi.fn(async (data: WorkOrderRow) => {
      const row: WorkOrderRow = { ...data };
      store.workOrders.set(row.id, row);
      return row;
    }),
    update: vi.fn(async (id: string, tenantId: string, patch: Partial<WorkOrderRow>) => {
      const existing = store.workOrders.get(id);
      if (!existing || existing.tenantId !== tenantId) return null;
      const merged: WorkOrderRow = { ...existing, ...patch };
      store.workOrders.set(id, merged);
      return merged;
    }),
    delete: vi.fn(async (id: string, tenantId: string) => {
      const row = store.workOrders.get(id);
      if (!row || row.tenantId !== tenantId) return false;
      store.workOrders.delete(id);
      return true;
    }),
  },
};

// ---------------------------------------------------------------------------
// Mock middleware/database
// ---------------------------------------------------------------------------

vi.mock('../middleware/database', () => ({
  databaseMiddleware: async (c: any, next: any) => {
    c.set('db', {});
    c.set('repos', repos);
    c.set('useMockData', false);
    await next();
  },
  isUsingMockData: () => false,
  getDatabaseClient: () => ({}),
  generateId: () => crypto.randomUUID(),
}));

// ---------------------------------------------------------------------------
// Mock the storage layer so multipart proof uploads stay local.
// ---------------------------------------------------------------------------

vi.mock('../lib/storage', () => ({
  uploadFile: vi.fn(async (opts: any) => ({
    url: `mock://uploads/${opts.key}`,
    key: opts.key,
  })),
  readAndValidateUpload: vi.fn(async (file: any) => {
    const buffer = Buffer.from('test-file-bytes');
    return {
      buffer,
      filename: file?.name ?? 'proof.jpg',
      contentType: file?.type ?? 'image/jpeg',
      size: buffer.length,
    };
  }),
  uploadErrorToResponse: vi.fn(() => null),
}));

// ---------------------------------------------------------------------------
// Mock the notification dispatcher — no-op for tests.
// ---------------------------------------------------------------------------

vi.mock('../routes/notifications-dispatcher', () => ({
  dispatchWorkOrderNotification: vi.fn(async () => undefined),
}));

// ---------------------------------------------------------------------------
// Import router AFTER mocks.
// ---------------------------------------------------------------------------

const { workOrdersRouter } = await import('../routes/work-orders.hono');
const api = new Hono().route('/work-orders', workOrdersRouter);

beforeEach(() => {
  store = seed();
  for (const fn of Object.values(repos.workOrders)) (fn as any).mockClear?.();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bearer(role: UserRole = UserRole.PROPERTY_MANAGER): string {
  return generateToken({
    userId: 'user-mgr',
    tenantId: 'tenant-001',
    role,
    permissions: ['*', 'work_orders:*'],
    propertyAccess: ['*'],
  });
}

function jsonReq(method: string, url: string, body?: unknown) {
  return new Request(`http://x${url}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer()}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function createWorkOrder() {
  const res = await api.fetch(
    jsonReq('POST', '/work-orders', {
      propertyId: 'prop-1',
      unitId: 'unit-1',
      customerId: 'cust-1',
      category: 'plumbing',
      priority: 'high',
      title: 'Leaky faucet',
      description: 'Kitchen sink dripping',
      location: 'Kitchen',
    })
  );
  expect(res.status).toBe(201);
  const body = await res.json();
  return body.data;
}

// ---------------------------------------------------------------------------
// POST /work-orders
// ---------------------------------------------------------------------------

describe('POST /work-orders', () => {
  it('creates a work order with status=submitted and seeds the timeline', async () => {
    const res = await api.fetch(
      jsonReq('POST', '/work-orders', {
        propertyId: 'prop-1',
        unitId: 'unit-1',
        customerId: 'cust-1',
        category: 'plumbing',
        priority: 'high',
        title: 'Leaky faucet',
        description: 'Kitchen sink dripping',
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('submitted');
    expect(body.data.title).toBe('Leaky faucet');
    expect(body.data.workOrderNumber).toMatch(/^WO-/);

    const stored = store.workOrders.get(body.data.id);
    expect(stored?.timeline?.[0]?.status).toBe('submitted');
  });

  it('returns 401 without bearer token', async () => {
    const res = await api.fetch(
      new Request('http://x/work-orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'x' }),
      })
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Lifecycle: triage → assign → start → complete → rate
// ---------------------------------------------------------------------------

describe('Work order lifecycle (wave-5)', () => {
  it('walks the full lifecycle: create → assign → start → complete (JSON) → rate', async () => {
    const wo = await createWorkOrder();

    // Assign
    const assignRes = await api.fetch(
      jsonReq('POST', `/work-orders/${wo.id}/assign`, {
        vendorId: 'vendor-1',
        notes: 'Assigning to plumber on call',
      })
    );
    expect(assignRes.status).toBe(200);
    const assigned = (await assignRes.json()).data;
    expect(assigned.status).toBe('assigned');
    expect(assigned.vendorId).toBe('vendor-1');

    // Start
    const startRes = await api.fetch(
      jsonReq('POST', `/work-orders/${wo.id}/start`, { notes: 'En route' })
    );
    expect(startRes.status).toBe(200);
    const started = (await startRes.json()).data;
    expect(started.status).toBe('in_progress');

    // Complete (JSON variant — afterPhotos as URLs)
    const completeRes = await api.fetch(
      jsonReq('POST', `/work-orders/${wo.id}/complete`, {
        completionNotes: 'Replaced washer',
        afterPhotos: ['https://example.com/photo-1.jpg'],
        actualCost: { amount: 1500, currency: 'KES' },
      })
    );
    expect(completeRes.status).toBe(200);
    const completed = (await completeRes.json()).data;
    expect(completed.status).toBe('pending_verification');
    expect(completed.completedAt).toBeTruthy();
    const completedRow = store.workOrders.get(wo.id)!;
    expect(completedRow.attachments.length).toBeGreaterThanOrEqual(1);
    expect(completedRow.attachments[0].url).toContain('photo-1.jpg');

    // Rate (with rating between 1-5)
    const rateRes = await api.fetch(
      jsonReq('POST', `/work-orders/${wo.id}/rating`, {
        rating: 5,
        feedback: 'Fast and clean',
        wouldRecommend: true,
      })
    );
    expect(rateRes.status).toBe(200);
    const rated = (await rateRes.json()).data;
    // After rating a pending_verification WO, status flips to completed.
    expect(rated.status).toBe('completed');
    const finalRow = store.workOrders.get(wo.id)!;
    const ratingEntry = finalRow.timeline.find((t: any) => t.status === 'rated');
    expect(ratingEntry).toBeTruthy();
    expect(ratingEntry.rating).toBe(5);
  });

  it('completes via multipart/form-data with proof files uploaded to storage', async () => {
    const wo = await createWorkOrder();

    // Move to in_progress so completion is meaningful.
    await api.fetch(jsonReq('POST', `/work-orders/${wo.id}/assign`, { vendorId: 'vendor-1' }));
    await api.fetch(jsonReq('POST', `/work-orders/${wo.id}/start`, {}));

    const form = new FormData();
    form.set('payload', JSON.stringify({ completionNotes: 'See attached photos' }));
    const blob1 = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' });
    const blob2 = new Blob([new Uint8Array([5, 6, 7, 8])], { type: 'image/jpeg' });
    form.append('afterPhotos', new File([blob1], 'before.jpg', { type: 'image/jpeg' }));
    form.append('afterPhotos', new File([blob2], 'after.jpg', { type: 'image/jpeg' }));

    const res = await api.fetch(
      new Request(`http://x/work-orders/${wo.id}/complete`, {
        method: 'POST',
        headers: { authorization: `Bearer ${bearer()}` },
        body: form,
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('pending_verification');

    const completedRow = store.workOrders.get(wo.id)!;
    expect(completedRow.attachments.length).toBe(2);
    for (const att of completedRow.attachments) {
      expect(att.url).toMatch(/^mock:\/\/uploads\/work-orders\//);
    }
  });

  it('triages a work order and updates priority/category', async () => {
    const wo = await createWorkOrder();
    const res = await api.fetch(
      jsonReq('POST', `/work-orders/${wo.id}/triage`, {
        priority: 'urgent',
        category: 'electrical',
        notes: 'Sparks visible',
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('triaged');
    const row = store.workOrders.get(wo.id)!;
    expect(row.priority).toBe('urgent');
    expect(row.category).toBe('electrical');
  });

  it('cancels a work order with a reason', async () => {
    const wo = await createWorkOrder();
    const res = await api.fetch(
      jsonReq('POST', `/work-orders/${wo.id}/cancel`, { reason: 'Resident moved out' })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('cancelled');
    const row = store.workOrders.get(wo.id)!;
    const cancelEntry = row.timeline.find((t: any) => t.status === 'cancelled');
    expect(cancelEntry?.reason).toBe('Resident moved out');
  });

  it('rejects ratings outside 1-5 with 400 INVALID_RATING', async () => {
    const wo = await createWorkOrder();
    const res = await api.fetch(
      jsonReq('POST', `/work-orders/${wo.id}/rating`, { rating: 7 })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_RATING');
  });

  it('returns 404 from lifecycle endpoints when work order does not exist', async () => {
    const endpoints = ['triage', 'assign', 'start', 'complete', 'rating', 'cancel'] as const;
    for (const ep of endpoints) {
      const res = await api.fetch(jsonReq('POST', `/work-orders/wo-missing/${ep}`, {}));
      expect(res.status, `expected 404 for ${ep}`).toBe(404);
    }
  });
});
