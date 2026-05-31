/**
 * Chat-King brain tools — close BN owner-portal chat-reachability gaps.
 *
 * The "chat-king" bar (per user mandate): every UI action a person can
 * perform via clicks / forms must ALSO be reachable through home chat —
 * the user should never have to leave Mr. Mwikila to operate the
 * platform. This file closes the highest-value gaps identified in the
 * BN owner-portal audit pass:
 *
 *   1. owner.damage_deduction.settle           — agree + finalize damage claim
 *   2. owner.damage_deduction.respond          — owner counter / rationale
 *   3. owner.negotiation.accept                — accept a lease/tender turn
 *   4. owner.negotiation.reject                — reject a lease/tender turn
 *   5. owner.conditional_survey.approve_plan   — approve a proposed action plan
 *
 * All five tools are HIGH-stakes WRITE tools that wrap REAL existing
 * gateway routes (no mock data, no fallback stubs). The handlers
 * dispatch through `ctx.httpClient` (loopback) so the SAME auth, RLS,
 * audit-trail, kill-switch, and rate-limit guards apply as a browser
 * request — the chat-king bar must NEVER weaken the existing security
 * surface.
 *
 * Provenance discipline (CLAUDE.md hard rule):
 *   Each WRITE body carries `provenance: { via: 'chat', sessionId,
 *   turnId, actorId }` so the downstream audit row deep-links back to
 *   the originating chat turn. The "via Mr. Mwikila" pill in the UI
 *   reads this envelope.
 *
 * Persona scoping:
 *   All five are OWNER-only (T1_owner_strategist). Managers + tenants
 *   have their own approval surfaces (manager.contractor.engage,
 *   tenant.lease.renewal.respond) that wrap the corresponding routes.
 */

import { z } from 'zod';

import type {
  PersonaToolDescriptor,
  PersonaToolHandlerContext,
} from './types.js';

const OWNER: ReadonlyArray<'T1_owner_strategist'> = ['T1_owner_strategist'];

/**
 * Inline provenance shim. Adds `provenance: { via: 'chat', ... }` to a
 * write body so the downstream audit row carries the chat trail. Same
 * shape as the canonical `provenance-injector.ts` helper — embedded
 * inline to keep this file self-contained until the BN provenance
 * service lands.
 */
function withChatProvenance<T extends Record<string, unknown>>(
  body: T,
  ctx: PersonaToolHandlerContext,
): T & {
  provenance: {
    via: 'chat';
    sessionId: string | null;
    turnId: string | null;
    actorId: string;
  };
} {
  return {
    ...body,
    provenance: {
      via: 'chat',
      sessionId: ctx.chatSessionId ?? null,
      turnId: ctx.chatTurnId ?? null,
      actorId: ctx.actorId,
    },
  };
}

// ───────────────────────────────────────────────────────────────────
// 1. owner.damage_deduction.settle
// ───────────────────────────────────────────────────────────────────

const DamageSettleInput = z.object({
  claimId: z.string().min(1).max(120),
  agreedAmountMinor: z.number().int().nonnegative(),
  notes: z.string().max(4000).optional(),
});

const DamageSettleOutput = z.object({
  id: z.string(),
  status: z.string(),
  agreedAmountMinor: z.number().int().nonnegative(),
  settledAt: z.string().nullable(),
});

export const ownerDamageDeductionSettleTool: PersonaToolDescriptor<
  typeof DamageSettleInput,
  typeof DamageSettleOutput
> = {
  id: 'owner.damage_deduction.settle',
  name: 'Owner — settle damage deduction (en) / Mwenye — maliza dai la uharibifu (sw)',
  description:
    'Agree and finalize a damage-deduction claim with a confirmed ' +
    'amount in minor currency units. HIGH stakes — moves the claim ' +
    'to `agreed` status and emits the canonical audit row. Use when ' +
    'the owner replies "approve $300", "settle for 50000 TZS", ' +
    '"finalize at the proposed amount" in chat.',
  personaSlugs: OWNER,
  inputSchema: DamageSettleInput,
  outputSchema: DamageSettleOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        id: '',
        status: 'unavailable',
        agreedAmountMinor: input.agreedAmountMinor,
        settledAt: null,
      };
    }
    const body = withChatProvenance(
      {
        agreedAmountMinor: input.agreedAmountMinor,
        notes: input.notes ?? null,
      },
      ctx,
    );
    return client.post<{
      id: string;
      status: string;
      agreedAmountMinor: number;
      settledAt: string | null;
    }>(
      `/damage-deductions/${encodeURIComponent(input.claimId)}/settle`,
      body,
    );
  },
};

// ───────────────────────────────────────────────────────────────────
// 2. owner.damage_deduction.respond
// ───────────────────────────────────────────────────────────────────

const DamageRespondInput = z.object({
  claimId: z.string().min(1).max(120),
  counterProposalMinor: z.number().int().nonnegative().optional(),
  rationale: z.string().min(1).max(4000),
});

const DamageRespondOutput = z.object({
  id: z.string(),
  status: z.string(),
  counterProposalMinor: z.number().int().nullable(),
});

export const ownerDamageDeductionRespondTool: PersonaToolDescriptor<
  typeof DamageRespondInput,
  typeof DamageRespondOutput
> = {
  id: 'owner.damage_deduction.respond',
  name: 'Owner — respond to damage deduction (en) / Mwenye — jibu dai la uharibifu (sw)',
  description:
    'Record a counter-proposal or rationale on an open damage claim. ' +
    'Use when the owner wants to push back ("reject — request photos", ' +
    '"counter at 25000 — see report appendix B"). Rationale is required.',
  personaSlugs: OWNER,
  inputSchema: DamageRespondInput,
  outputSchema: DamageRespondOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        id: '',
        status: 'unavailable',
        counterProposalMinor: input.counterProposalMinor ?? null,
      };
    }
    const body = withChatProvenance(
      {
        counterProposalMinor: input.counterProposalMinor ?? null,
        rationale: input.rationale,
      },
      ctx,
    );
    return client.post<{
      id: string;
      status: string;
      counterProposalMinor: number | null;
    }>(
      `/damage-deductions/${encodeURIComponent(input.claimId)}/respond`,
      body,
    );
  },
};

// ───────────────────────────────────────────────────────────────────
// 3. owner.negotiation.accept
// ───────────────────────────────────────────────────────────────────

const NegotiationAcceptInput = z.object({
  negotiationId: z.string().min(1).max(120),
  agreedPrice: z.number().positive().optional(),
  reason: z.string().max(2000).optional(),
});

const NegotiationAcceptOutput = z.object({
  id: z.string(),
  status: z.string(),
  agreedPrice: z.number().nullable(),
});

export const ownerNegotiationAcceptTool: PersonaToolDescriptor<
  typeof NegotiationAcceptInput,
  typeof NegotiationAcceptOutput
> = {
  id: 'owner.negotiation.accept',
  name: 'Owner — accept negotiation (en) / Mwenye — kubali mazungumzo (sw)',
  description:
    'Accept a lease-price or tender-bid negotiation turn. HIGH stakes — ' +
    'closes the negotiation, books the agreed price, and triggers the ' +
    'downstream lease / tender finalization workflow. Use when the ' +
    'owner says "accept", "agreed", "let\'s do it", "go with this price".',
  personaSlugs: OWNER,
  inputSchema: NegotiationAcceptInput,
  outputSchema: NegotiationAcceptOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        id: '',
        status: 'unavailable',
        agreedPrice: input.agreedPrice ?? null,
      };
    }
    const body = withChatProvenance(
      {
        actor: 'owner',
        agreedPrice: input.agreedPrice ?? undefined,
        reason: input.reason ?? undefined,
      },
      ctx,
    );
    return client.post<{
      id: string;
      status: string;
      agreedPrice: number | null;
    }>(
      `/negotiations/${encodeURIComponent(input.negotiationId)}/accept`,
      body,
    );
  },
};

// ───────────────────────────────────────────────────────────────────
// 4. owner.negotiation.reject
// ───────────────────────────────────────────────────────────────────

const NegotiationRejectInput = z.object({
  negotiationId: z.string().min(1).max(120),
  reason: z.string().min(1).max(2000),
});

const NegotiationRejectOutput = z.object({
  id: z.string(),
  status: z.string(),
});

export const ownerNegotiationRejectTool: PersonaToolDescriptor<
  typeof NegotiationRejectInput,
  typeof NegotiationRejectOutput
> = {
  id: 'owner.negotiation.reject',
  name: 'Owner — reject negotiation (en) / Mwenye — kataa mazungumzo (sw)',
  description:
    'Reject and close a negotiation turn. Reason is required. Use when ' +
    'the owner says "reject — too low", "no deal", "decline this offer". ' +
    'HIGH stakes — closes the negotiation permanently.',
  personaSlugs: OWNER,
  inputSchema: NegotiationRejectInput,
  outputSchema: NegotiationRejectOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        id: '',
        status: 'unavailable',
      };
    }
    const body = withChatProvenance(
      {
        actor: 'owner',
        reason: input.reason,
      },
      ctx,
    );
    return client.post<{
      id: string;
      status: string;
    }>(
      `/negotiations/${encodeURIComponent(input.negotiationId)}/reject`,
      body,
    );
  },
};

// ───────────────────────────────────────────────────────────────────
// 5. owner.conditional_survey.approve_plan
// ───────────────────────────────────────────────────────────────────

const SurveyApprovePlanInput = z.object({
  surveyId: z.string().min(1).max(120),
  actionPlanId: z.string().min(1).max(120),
});

const SurveyApprovePlanOutput = z.object({
  id: z.string(),
  status: z.string(),
  approvedAt: z.string().nullable(),
});

export const ownerConditionalSurveyApprovePlanTool: PersonaToolDescriptor<
  typeof SurveyApprovePlanInput,
  typeof SurveyApprovePlanOutput
> = {
  id: 'owner.conditional_survey.approve_plan',
  name: 'Owner — approve survey action plan (en) / Mwenye — idhinisha mpango wa hatua (sw)',
  description:
    'Approve a proposed action plan tied to a conditional-survey finding. ' +
    'HIGH stakes — unblocks the downstream work-order dispatch. Use when ' +
    'the owner says "approve the remediation plan", "green-light the ' +
    'fix proposal", "okay to proceed with plan X".',
  personaSlugs: OWNER,
  inputSchema: SurveyApprovePlanInput,
  outputSchema: SurveyApprovePlanOutput,
  stakes: 'HIGH',
  isWrite: true,
  requiresPolicyRuleLiteral: false,
  async handler(input, ctx) {
    const client = ctx.httpClient;
    if (!client) {
      return {
        id: '',
        status: 'unavailable',
        approvedAt: null,
      };
    }
    const body = withChatProvenance({}, ctx);
    return client.post<{
      id: string;
      status: string;
      approvedAt: string | null;
    }>(
      `/conditional-surveys/${encodeURIComponent(input.surveyId)}` +
        `/plans/${encodeURIComponent(input.actionPlanId)}/approve`,
      body,
    );
  },
};

// ───────────────────────────────────────────────────────────────────
// Catalog export
// ───────────────────────────────────────────────────────────────────

export const CHAT_KING_TOOLS: ReadonlyArray<
  PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>
> = Object.freeze([
  ownerDamageDeductionSettleTool,
  ownerDamageDeductionRespondTool,
  ownerNegotiationAcceptTool,
  ownerNegotiationRejectTool,
  ownerConditionalSurveyApprovePlanTool,
] as unknown as ReadonlyArray<PersonaToolDescriptor<z.ZodTypeAny, z.ZodTypeAny>>);
