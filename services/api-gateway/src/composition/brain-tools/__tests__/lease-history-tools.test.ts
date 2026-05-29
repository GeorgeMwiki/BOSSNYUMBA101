/**
 * lease-history-tools — descriptor metadata + http-client wiring tests.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  LEASE_HISTORY_TOOLS,
  leaseHistoryAppendStepTool,
  leaseHistoryShowTraceTool,
} from '../lease-history-tools.js';
import type { PersonaToolHandlerContext } from '../types.js';

function makeCtx(client: {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
}): PersonaToolHandlerContext {
  return {
    tenantId: '00000000-0000-0000-0000-000000000000',
    actorId: 'actor-1',
    personaSlug: 'T1_owner_strategist',
    httpClient: client as unknown as PersonaToolHandlerContext['httpClient'],
  };
}

describe('LEASE_HISTORY_TOOLS catalog', () => {
  it('exports exactly 2 descriptors', () => {
    expect(LEASE_HISTORY_TOOLS).toHaveLength(2);
  });
  it('includes append_step + show_trace ids', () => {
    const ids = LEASE_HISTORY_TOOLS.map((t) => t.id).sort();
    expect(ids).toEqual([
      'lease_history.append_step',
      'lease_history.show_trace',
    ]);
  });
});

describe('leaseHistoryAppendStepTool', () => {
  it('is HIGH-stakes, isWrite=true', () => {
    expect(leaseHistoryAppendStepTool.stakes).toBe('HIGH');
    expect(leaseHistoryAppendStepTool.isWrite).toBe(true);
  });
  it('posts to /leases/:id/history/steps with provenance + evidence', async () => {
    const post = vi.fn().mockResolvedValue({
      id: 'step-1',
      stepIndex: 5,
      auditHash: 'hash-5',
      prevAuditHash: 'hash-4',
    });
    const ctx = makeCtx({ get: vi.fn(), post });
    const res = await leaseHistoryAppendStepTool.handler(
      {
        leaseId: 'lease-xyz',
        action: 'rent_payment',
        actorRole: 'tenant',
        amount: 500000,
        currencyCode: 'TZS',
        evidenceRef: 'evidence-1',
      },
      ctx,
    );
    expect(res.stepIndex).toBe(5);
    expect(post).toHaveBeenCalledOnce();
    const [url, body] = post.mock.calls[0]!;
    expect(url).toBe('/leases/lease-xyz/history/steps');
    const typed = body as { evidenceRefs?: string[]; provenance?: { via: string } };
    expect(typed.evidenceRefs).toEqual(['evidence-1']);
    expect(typed.provenance?.via).toBe('chat');
  });
});

describe('leaseHistoryShowTraceTool', () => {
  it('is LOW-stakes, read-only', () => {
    expect(leaseHistoryShowTraceTool.stakes).toBe('LOW');
    expect(leaseHistoryShowTraceTool.isWrite).toBe(false);
  });
  it('fetches /leases/:id/history with limit', async () => {
    const get = vi.fn().mockResolvedValue({
      leaseId: 'lease-1',
      steps: [],
      verification: { ok: true, brokenAt: null },
      latestHash: '',
    });
    const ctx = makeCtx({ get, post: vi.fn() });
    const res = await leaseHistoryShowTraceTool.handler(
      { leaseId: 'lease-1', limit: 50 },
      ctx,
    );
    expect(res.verification.ok).toBe(true);
    expect(get).toHaveBeenCalledOnce();
    const [url, opts] = get.mock.calls[0]!;
    expect(url).toBe('/leases/lease-1/history');
    expect((opts as { query: { limit: string } }).query.limit).toBe('50');
  });
});
