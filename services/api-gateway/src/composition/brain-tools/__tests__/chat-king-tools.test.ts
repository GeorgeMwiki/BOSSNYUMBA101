/**
 * chat-king-tools — descriptor metadata + http-client wiring tests.
 *
 * Verifies the 5 chat-king brain tools wrap their REAL gateway routes
 * correctly, that provenance is injected on every WRITE, and that the
 * persona scoping is OWNER-only per the wave's design.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  CHAT_KING_TOOLS,
  ownerDamageDeductionSettleTool,
  ownerDamageDeductionRespondTool,
  ownerNegotiationAcceptTool,
  ownerNegotiationRejectTool,
  ownerConditionalSurveyApprovePlanTool,
} from '../chat-king-tools.js';
import type { PersonaToolHandlerContext } from '../types.js';

function makeCtx(client: {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
}): PersonaToolHandlerContext {
  return {
    tenantId: '00000000-0000-0000-0000-000000000000',
    actorId: 'owner-1',
    personaSlug: 'T1_owner_strategist',
    chatSessionId: 'session-abc',
    chatTurnId: 'turn-42',
    httpClient: client as unknown as PersonaToolHandlerContext['httpClient'],
  };
}

describe('CHAT_KING_TOOLS catalog', () => {
  it('exports exactly 5 descriptors', () => {
    expect(CHAT_KING_TOOLS).toHaveLength(5);
  });

  it('includes all chat-king tool ids', () => {
    const ids = CHAT_KING_TOOLS.map((t) => t.id).sort();
    expect(ids).toEqual([
      'owner.conditional_survey.approve_plan',
      'owner.damage_deduction.respond',
      'owner.damage_deduction.settle',
      'owner.negotiation.accept',
      'owner.negotiation.reject',
    ]);
  });

  it('every descriptor is HIGH-stakes WRITE owner-only', () => {
    for (const tool of CHAT_KING_TOOLS) {
      expect(tool.stakes).toBe('HIGH');
      expect(tool.isWrite).toBe(true);
      expect(tool.personaSlugs).toEqual(['T1_owner_strategist']);
      expect(tool.requiresPolicyRuleLiteral).toBe(false);
    }
  });
});

describe('ownerDamageDeductionSettleTool', () => {
  it('posts to /damage-deductions/:id/settle with chat provenance', async () => {
    const post = vi.fn().mockResolvedValue({
      id: 'claim-1',
      status: 'agreed',
      agreedAmountMinor: 50000,
      settledAt: '2026-05-31T12:00:00Z',
    });
    const ctx = makeCtx({ get: vi.fn(), post });
    const res = await ownerDamageDeductionSettleTool.handler(
      { claimId: 'claim-1', agreedAmountMinor: 50000, notes: 'agreed' },
      ctx,
    );
    expect(res.status).toBe('agreed');
    expect(res.agreedAmountMinor).toBe(50000);
    expect(post).toHaveBeenCalledOnce();
    const [url, body] = post.mock.calls[0]!;
    expect(url).toBe('/damage-deductions/claim-1/settle');
    const typed = body as {
      agreedAmountMinor: number;
      notes: string | null;
      provenance: { via: string; sessionId: string | null; turnId: string | null };
    };
    expect(typed.agreedAmountMinor).toBe(50000);
    expect(typed.notes).toBe('agreed');
    expect(typed.provenance.via).toBe('chat');
    expect(typed.provenance.sessionId).toBe('session-abc');
    expect(typed.provenance.turnId).toBe('turn-42');
  });
});

describe('ownerDamageDeductionRespondTool', () => {
  it('posts to /damage-deductions/:id/respond with rationale + counter-proposal', async () => {
    const post = vi.fn().mockResolvedValue({
      id: 'claim-2',
      status: 'pending_tenant',
      counterProposalMinor: 25000,
    });
    const ctx = makeCtx({ get: vi.fn(), post });
    const res = await ownerDamageDeductionRespondTool.handler(
      {
        claimId: 'claim-2',
        counterProposalMinor: 25000,
        rationale: 'See report appendix B for itemized cost basis.',
      },
      ctx,
    );
    expect(res.status).toBe('pending_tenant');
    expect(res.counterProposalMinor).toBe(25000);
    const [url, body] = post.mock.calls[0]!;
    expect(url).toBe('/damage-deductions/claim-2/respond');
    const typed = body as {
      counterProposalMinor: number | null;
      rationale: string;
      provenance: { via: string };
    };
    expect(typed.rationale).toContain('appendix B');
    expect(typed.provenance.via).toBe('chat');
  });
});

describe('ownerNegotiationAcceptTool', () => {
  it('posts to /negotiations/:id/accept with actor=owner', async () => {
    const post = vi.fn().mockResolvedValue({
      id: 'neg-1',
      status: 'accepted',
      agreedPrice: 750000,
    });
    const ctx = makeCtx({ get: vi.fn(), post });
    const res = await ownerNegotiationAcceptTool.handler(
      { negotiationId: 'neg-1', agreedPrice: 750000 },
      ctx,
    );
    expect(res.status).toBe('accepted');
    const [url, body] = post.mock.calls[0]!;
    expect(url).toBe('/negotiations/neg-1/accept');
    const typed = body as {
      actor: string;
      agreedPrice: number;
      provenance: { via: string };
    };
    expect(typed.actor).toBe('owner');
    expect(typed.agreedPrice).toBe(750000);
    expect(typed.provenance.via).toBe('chat');
  });
});

describe('ownerNegotiationRejectTool', () => {
  it('posts to /negotiations/:id/reject with required reason', async () => {
    const post = vi.fn().mockResolvedValue({
      id: 'neg-2',
      status: 'rejected',
    });
    const ctx = makeCtx({ get: vi.fn(), post });
    const res = await ownerNegotiationRejectTool.handler(
      { negotiationId: 'neg-2', reason: 'Too low — below floor' },
      ctx,
    );
    expect(res.status).toBe('rejected');
    const [url, body] = post.mock.calls[0]!;
    expect(url).toBe('/negotiations/neg-2/reject');
    const typed = body as {
      actor: string;
      reason: string;
      provenance: { via: string };
    };
    expect(typed.actor).toBe('owner');
    expect(typed.reason).toContain('Too low');
    expect(typed.provenance.via).toBe('chat');
  });

  it('rejects empty reason at the schema layer', () => {
    const parsed = ownerNegotiationRejectTool.inputSchema.safeParse({
      negotiationId: 'neg-3',
      reason: '',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('ownerConditionalSurveyApprovePlanTool', () => {
  it('posts to /conditional-surveys/:id/plans/:planId/approve', async () => {
    const post = vi.fn().mockResolvedValue({
      id: 'plan-1',
      status: 'approved',
      approvedAt: '2026-05-31T12:00:00Z',
    });
    const ctx = makeCtx({ get: vi.fn(), post });
    const res = await ownerConditionalSurveyApprovePlanTool.handler(
      { surveyId: 'survey-1', actionPlanId: 'plan-1' },
      ctx,
    );
    expect(res.status).toBe('approved');
    const [url, body] = post.mock.calls[0]!;
    expect(url).toBe('/conditional-surveys/survey-1/plans/plan-1/approve');
    const typed = body as { provenance: { via: string } };
    expect(typed.provenance.via).toBe('chat');
  });
});

describe('chat-king tools — httpClient unavailable', () => {
  it('each tool returns a degraded shape without throwing', async () => {
    const ctx = {
      tenantId: 'tenant-1',
      actorId: 'owner-1',
      personaSlug: 'T1_owner_strategist',
    } as PersonaToolHandlerContext;
    const settleRes = await ownerDamageDeductionSettleTool.handler(
      { claimId: 'c', agreedAmountMinor: 1 },
      ctx,
    );
    expect(settleRes.status).toBe('unavailable');
    const acceptRes = await ownerNegotiationAcceptTool.handler(
      { negotiationId: 'n' },
      ctx,
    );
    expect(acceptRes.status).toBe('unavailable');
  });
});
