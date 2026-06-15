/**
 * /api/v1/tenders — tenant bid loop (#8) route tests.
 *
 * Live detector for BLOCKER #8: the tenant-mobile applicant bid loop calls
 * tender-scoped bid routes that previously 404'd. These pin the NEW gateway
 * handlers added to tenders.hono.ts:
 *   - GET  /tenders/bids/mine                       (My Bids — JWT applicant)
 *   - POST /tenders/:id/bids/:bidId/messages        (append message)
 *   - GET  /tenders/:id/bids/:bidId/messages        (list thread)
 *   - POST /tenders/:id/bids/:bidId/accept          (status transition)
 *   - POST /tenders/:id/bids/:bidId/withdraw        (status transition)
 *
 * AND the full happy path: place → list-mine → message → accept/withdraw.
 * AND the anti-IDOR guard: another applicant's bid resolves to a uniform 404.
 *
 * Auth + database middlewares are stubbed (no live Postgres). The db stub is a
 * faithful in-memory bids + bid_messages store driven off the SQL statement
 * text, so the SELECT/INSERT/UPDATE handlers exercise their real logic,
 * including the (tender_id, bid_id, vendor_id) anti-IDOR triple and the
 * status-IN compare-and-set guard.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

interface BidRow {
  id: string;
  tenant_id: string;
  tender_id: string;
  vendor_id: string;
  price: number;
  currency: string;
  timeline_days: number;
  notes: string | null;
  status: string;
  submitted_at: string;
  awarded_at: string | null;
  // Joined from the parent tender + negotiation linkage. Present on the
  // My-Bids read (LEFT JOIN tenders); drive listingTitle + the countered
  // status signal.
  tender_scope?: string | null;
  negotiation_id?: string | null;
  negotiation_turns?: unknown[];
}

interface MsgRow {
  id: string;
  tenant_id: string;
  bid_id: string;
  tender_id: string;
  sender: string;
  sender_user_id: string;
  body: string;
  created_at: string;
}

const state = vi.hoisted(() => ({
  tenantId: 'tenant-A' as string | null,
  userId: 'applicant-1' as string | null,
  bids: [] as Array<Record<string, unknown>>,
  messages: [] as Array<Record<string, unknown>>,
  seq: 0,
}));

vi.mock('../../middleware/hono-auth', () => ({
  authMiddleware: async (
    c: { set: (k: string, v: unknown) => void },
    next: () => Promise<void>,
  ) => {
    if (state.tenantId && state.userId) {
      c.set('auth', { tenantId: state.tenantId, userId: state.userId, role: 'TENANT' });
    }
    await next();
  },
}));

// Flatten a drizzle sql`` object into { text, params } in chunk order.
function record(query: unknown): { text: string; params: unknown[] } {
  const chunks = (query as { queryChunks?: unknown[] })?.queryChunks ?? [];
  const params: unknown[] = [];
  const text: string[] = [];
  const walk = (xs: unknown[]): void => {
    for (const x of xs) {
      if (
        x &&
        typeof x === 'object' &&
        Array.isArray((x as { queryChunks?: unknown[] }).queryChunks)
      ) {
        walk((x as { queryChunks: unknown[] }).queryChunks);
      } else if (
        x &&
        typeof x === 'object' &&
        'value' in (x as Record<string, unknown>) &&
        Array.isArray((x as { value?: unknown }).value)
      ) {
        text.push(((x as { value: string[] }).value ?? []).join(''));
      } else {
        text.push('?');
        params.push((x as { value?: unknown })?.value ?? x);
      }
    }
  };
  walk(chunks as unknown[]);
  return { text: text.join(' '), params };
}

vi.mock('../../middleware/database', () => {
  const execute = async (query: unknown): Promise<unknown> => {
    const { text, params } = record(query);

    // --- bids reads ---------------------------------------------------------
    if (/FROM bids/i.test(text) && /vendor_id\s*=\s*\?[\s\S]*ORDER BY/i.test(text) && !/WHERE id\s*=/i.test(text)) {
      // GET /bids/mine — WHERE vendor_id = ? ORDER BY submitted_at DESC
      const vendorId = params[0];
      const rows = state.bids
        .filter((b) => b.vendor_id === vendorId)
        .sort((a, b) =>
          String(b.submitted_at).localeCompare(String(a.submitted_at)),
        );
      return rows;
    }
    if (/FROM bids/i.test(text) && /WHERE id\s*=\s*\?/i.test(text)) {
      // findApplicantBid — id + tender_id + vendor_id
      const [bidId, tenderId, vendorId] = params;
      const row = state.bids.find(
        (b) =>
          b.id === bidId && b.tender_id === tenderId && b.vendor_id === vendorId,
      );
      return row ? [row] : [];
    }

    // --- bids writes (compare-and-set) -------------------------------------
    if (/UPDATE bids/i.test(text)) {
      const newStatus = /status = 'awarded'/i.test(text)
        ? 'awarded'
        : 'withdrawn';
      // params order: id, tender_id, vendor_id (status IN list is literal)
      const [bidId, tenderId, vendorId] = params;
      const row = state.bids.find(
        (b) =>
          b.id === bidId &&
          b.tender_id === tenderId &&
          b.vendor_id === vendorId &&
          (b.status === 'submitted' || b.status === 'negotiating'),
      );
      if (!row) return [];
      row.status = newStatus;
      if (newStatus === 'awarded') row.awarded_at = new Date().toISOString();
      return [row];
    }

    // --- bid_messages ------------------------------------------------------
    if (/INSERT INTO bid_messages/i.test(text)) {
      // params order: tenant_id, bid_id, tender_id, sender_user_id, body
      const [tenantId, bidId, tenderId, senderUserId, body] = params;
      const row: MsgRow = {
        id: `msg-${++state.seq}`,
        tenant_id: String(tenantId),
        bid_id: String(bidId),
        tender_id: String(tenderId),
        sender: 'applicant',
        sender_user_id: String(senderUserId),
        body: String(body),
        created_at: new Date(Date.now() + state.seq).toISOString(),
      };
      state.messages = [...state.messages, row];
      return [row];
    }
    if (/FROM bid_messages/i.test(text)) {
      // Single-bid thread (WHERE bid_id = ?) or the My-Bids IN-list hydrate
      // (WHERE bid_id IN (?, ?, ...)). Either way the params are the bid ids
      // to include, so membership over the full param list is faithful to both.
      const bidIds = new Set(params.map(String));
      return state.messages
        .filter((m) => bidIds.has(String(m.bid_id)))
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    }

    return [];
  };
  return {
    databaseMiddleware: async (
      c: { set: (k: string, v: unknown) => void },
      next: () => Promise<void>,
    ) => {
      c.set('db', {
        execute,
        transaction: async <T>(
          cb: (tx: { execute(q: unknown): Promise<unknown> }) => Promise<T>,
        ): Promise<T> => cb({ execute }),
      });
      await next();
    },
  };
});

// withSecurityEvents must pass through to the handler unchanged.
vi.mock('@bossnyumba/observability', () => ({
  withSecurityEvents:
    (_meta: unknown, handler: (c: unknown) => unknown) =>
    (c: unknown) =>
      handler(c),
}));

import { tendersRouter } from '../tenders.hono';

function mount(): Hono {
  const app = new Hono();
  app.route('/tenders', tendersRouter);
  return app;
}

function seedBid(overrides: Partial<BidRow> = {}): BidRow {
  const bid: BidRow = {
    id: overrides.id ?? `bid-${++state.seq}`,
    tenant_id: overrides.tenant_id ?? 'tenant-A',
    tender_id: overrides.tender_id ?? 'tender-1',
    vendor_id: overrides.vendor_id ?? 'applicant-1',
    price: overrides.price ?? 500000,
    currency: overrides.currency ?? 'TZS',
    timeline_days: overrides.timeline_days ?? 1,
    notes: overrides.notes ?? null,
    status: overrides.status ?? 'submitted',
    submitted_at: overrides.submitted_at ?? new Date().toISOString(),
    awarded_at: overrides.awarded_at ?? null,
    // Preserve an EXPLICIT null (orphan-tender case) — `??` would swallow it
    // and hide the impl's null→tender_id fallback. Default only when omitted.
    tender_scope:
      'tender_scope' in overrides
        ? overrides.tender_scope ?? null
        : 'Riverside 2-bed apartment',
    negotiation_id: overrides.negotiation_id ?? null,
    negotiation_turns: overrides.negotiation_turns ?? [],
  };
  state.bids = [...state.bids, bid as unknown as Record<string, unknown>];
  return bid;
}

function seedMessage(
  bidId: string,
  body: string,
  tenderId = 'tender-1',
): void {
  state.messages = [
    ...state.messages,
    {
      id: `msg-${++state.seq}`,
      tenant_id: 'tenant-A',
      bid_id: bidId,
      tender_id: tenderId,
      sender: 'owner',
      sender_user_id: 'owner-1',
      body,
      created_at: new Date(Date.now() + state.seq).toISOString(),
    },
  ];
}

beforeEach(() => {
  state.tenantId = 'tenant-A';
  state.userId = 'applicant-1';
  state.bids = [];
  state.messages = [];
  state.seq = 0;
});

describe('tenders bid loop — auth gate', () => {
  it('rejects unauthenticated My Bids', async () => {
    state.tenantId = null;
    state.userId = null;
    const res = await mount().request('/tenders/bids/mine');
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated message send', async () => {
    state.tenantId = null;
    state.userId = null;
    const res = await mount().request('/tenders/tender-1/bids/bid-1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'hi' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('tenders bid loop — My Bids', () => {
  it('returns only the authenticated applicant own bids', async () => {
    seedBid({ id: 'mine-1', vendor_id: 'applicant-1' });
    seedBid({ id: 'mine-2', vendor_id: 'applicant-1' });
    seedBid({ id: 'other-1', vendor_id: 'applicant-2' });

    const res = await mount().request('/tenders/bids/mine');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const ids = body.data.map((b: { id: string }) => b.id).sort();
    expect(ids).toEqual(['mine-1', 'mine-2']);
  });
});

describe('tenders bid loop — My Bids returns the tenant-mobile Bid shape', () => {
  it('maps every field the BidDetail screen reads (no nulls on render paths)', async () => {
    seedBid({
      id: 'shape-1',
      tender_id: 'tender-7',
      tender_scope: 'Riverside 2-bed apartment',
      price: 850000,
    });
    seedMessage('shape-1', 'Welcome — can you move in May?', 'tender-7');

    const res = await mount().request('/tenders/bids/mine');
    expect(res.status).toBe(200);
    const body = await res.json();
    const bid = body.data.find((b: { id: string }) => b.id === 'shape-1');

    // listingId / listingTitle come from the JOINed tender.
    expect(bid.listingId).toBe('tender-7');
    expect(bid.listingTitle).toBe('Riverside 2-bed apartment');
    // price → offerRentPerMonthTzs (number, never null — formatTzs calls it).
    expect(bid.offerRentPerMonthTzs).toBe(850000);
    expect(typeof bid.offerRentPerMonthTzs).toBe('number');
    // floorAreaSqm is a number (formatSqm calls .toFixed on it).
    expect(typeof bid.floorAreaSqm).toBe('number');
    // submitted_at → placedAt.
    expect(typeof bid.placedAt).toBe('string');
    // thread is hydrated from bid_messages and is always an array.
    expect(Array.isArray(bid.thread)).toBe(true);
    expect(bid.thread).toHaveLength(1);
    expect(bid.thread[0].body).toBe('Welcome — can you move in May?');
    // No leftover gateway-only fields on the render path.
    expect(bid.price).toBeUndefined();
    expect(bid.submittedAt).toBeUndefined();
  });

  it('falls back to the tender id as the title when the tender is gone', async () => {
    seedBid({ id: 'shape-orphan', tender_id: 'tender-x', tender_scope: null });
    const res = await mount().request('/tenders/bids/mine');
    const body = await res.json();
    const bid = body.data.find((b: { id: string }) => b.id === 'shape-orphan');
    expect(bid.listingTitle).toBe('tender-x');
  });

  it('defaults thread to an empty array when the bid has no messages', async () => {
    seedBid({ id: 'shape-no-thread' });
    const res = await mount().request('/tenders/bids/mine');
    const body = await res.json();
    const bid = body.data.find((b: { id: string }) => b.id === 'shape-no-thread');
    expect(bid.thread).toEqual([]);
  });
});

describe('tenders bid loop — status enum maps to the FE BidStatus vocabulary', () => {
  it('submitted → pending', async () => {
    seedBid({ id: 's1', status: 'submitted' });
    const body = await (await mount().request('/tenders/bids/mine')).json();
    expect(body.data.find((b: { id: string }) => b.id === 's1').status).toBe('pending');
  });

  it('negotiating → pending when no counter is on record', async () => {
    seedBid({ id: 's2', status: 'negotiating' });
    const body = await (await mount().request('/tenders/bids/mine')).json();
    expect(body.data.find((b: { id: string }) => b.id === 's2').status).toBe('pending');
  });

  it('awarded → accepted', async () => {
    seedBid({ id: 's3', status: 'awarded' });
    const body = await (await mount().request('/tenders/bids/mine')).json();
    expect(body.data.find((b: { id: string }) => b.id === 's3').status).toBe('accepted');
  });

  it('withdrawn → rejected', async () => {
    seedBid({ id: 's4', status: 'withdrawn' });
    const body = await (await mount().request('/tenders/bids/mine')).json();
    expect(body.data.find((b: { id: string }) => b.id === 's4').status).toBe('rejected');
  });

  it('rejected → rejected', async () => {
    seedBid({ id: 's5', status: 'rejected' });
    const body = await (await mount().request('/tenders/bids/mine')).json();
    expect(body.data.find((b: { id: string }) => b.id === 's5').status).toBe('rejected');
  });

  it('surfaces countered when a negotiation is linked to a live bid', async () => {
    seedBid({ id: 's6', status: 'negotiating', negotiation_id: 'neg-1' });
    const body = await (await mount().request('/tenders/bids/mine')).json();
    expect(body.data.find((b: { id: string }) => b.id === 's6').status).toBe('countered');
  });

  it('surfaces countered when an inline negotiation turn exists', async () => {
    seedBid({
      id: 's7',
      status: 'submitted',
      negotiation_turns: [{ actor: 'owner', offer: 800000 }],
    });
    const body = await (await mount().request('/tenders/bids/mine')).json();
    expect(body.data.find((b: { id: string }) => b.id === 's7').status).toBe('countered');
  });

  it('never re-maps a terminal awarded bid to countered even with a negotiation', async () => {
    seedBid({ id: 's8', status: 'awarded', negotiation_id: 'neg-2' });
    const body = await (await mount().request('/tenders/bids/mine')).json();
    expect(body.data.find((b: { id: string }) => b.id === 's8').status).toBe('accepted');
  });
});

describe('tenders bid loop — messages', () => {
  it('appends a message then lists it', async () => {
    seedBid({ id: 'bid-x', tender_id: 'tender-1', vendor_id: 'applicant-1' });

    const post = await mount().request(
      '/tenders/tender-1/bids/bid-x/messages',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'Can we discuss move-in date?' }),
      },
    );
    expect(post.status).toBe(201);
    const posted = await post.json();
    expect(posted.data.sender).toBe('applicant');
    expect(posted.data.body).toBe('Can we discuss move-in date?');

    const list = await mount().request('/tenders/tender-1/bids/bid-x/messages');
    expect(list.status).toBe(200);
    const listed = await list.json();
    expect(listed.data).toHaveLength(1);
    expect(listed.data[0].body).toBe('Can we discuss move-in date?');
  });

  it('rejects an empty message body (zod 400)', async () => {
    seedBid({ id: 'bid-x', tender_id: 'tender-1', vendor_id: 'applicant-1' });
    const res = await mount().request('/tenders/tender-1/bids/bid-x/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: '' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('tenders bid loop — accept / withdraw', () => {
  it('accepts a submitted bid (transition to awarded)', async () => {
    seedBid({ id: 'bid-acc', tender_id: 'tender-1', status: 'submitted' });
    const res = await mount().request(
      '/tenders/tender-1/bids/bid-acc/accept',
      { method: 'POST' },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // The transition response is mapped to the FE BidStatus vocabulary:
    // awarded → accepted (the applicant never sees raw gateway statuses).
    expect(body.data.status).toBe('accepted');
  });

  it('withdraws a submitted bid (transition to withdrawn)', async () => {
    seedBid({ id: 'bid-wd', tender_id: 'tender-1', status: 'submitted' });
    const res = await mount().request(
      '/tenders/tender-1/bids/bid-wd/withdraw',
      { method: 'POST' },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // withdrawn → rejected in the FE vocabulary.
    expect(body.data.status).toBe('rejected');
  });

  it('rejects accept on an already-awarded bid (compare-and-set 409)', async () => {
    seedBid({ id: 'bid-done', tender_id: 'tender-1', status: 'awarded' });
    const res = await mount().request(
      '/tenders/tender-1/bids/bid-done/accept',
      { method: 'POST' },
    );
    expect(res.status).toBe(409);
  });
});

describe('tenders bid loop — anti-IDOR (uniform 404)', () => {
  it("returns 404 for another applicant's bid on message send", async () => {
    // Bid belongs to applicant-2; the JWT is applicant-1.
    seedBid({ id: 'bid-foreign', tender_id: 'tender-1', vendor_id: 'applicant-2' });
    const res = await mount().request(
      '/tenders/tender-1/bids/bid-foreign/messages',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'sneaky' }),
      },
    );
    expect(res.status).toBe(404);
    // No message must have been written for the foreign bid.
    expect(state.messages).toHaveLength(0);
  });

  it("returns 404 for another applicant's bid on accept", async () => {
    seedBid({ id: 'bid-foreign', tender_id: 'tender-1', vendor_id: 'applicant-2', status: 'submitted' });
    const res = await mount().request(
      '/tenders/tender-1/bids/bid-foreign/accept',
      { method: 'POST' },
    );
    expect(res.status).toBe(404);
    // Status must be untouched.
    const foreign = state.bids.find((b) => b.id === 'bid-foreign');
    expect(foreign?.status).toBe('submitted');
  });

  it('returns 404 when the bid is on a different tender', async () => {
    seedBid({ id: 'bid-other-tender', tender_id: 'tender-99', vendor_id: 'applicant-1' });
    const res = await mount().request(
      '/tenders/tender-1/bids/bid-other-tender/withdraw',
      { method: 'POST' },
    );
    expect(res.status).toBe(404);
  });
});
