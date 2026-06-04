/**
 * Mr. Mwikila — Price Negotiator persona (LLM-backed AiCounterGenerator).
 *
 * KI-008 follow-up. The domain `NegotiationService`
 * (services/domain-services/src/negotiation/negotiation-service.ts) accepts
 * an injectable `AiCounterGenerator`. By default it uses a deterministic
 * midpoint STUB. This module builds a REAL generator that consults Anthropic
 * via the shared `anthropic-client.ts` (`generateStructured`) and returns a
 * Zod-validated counter-offer.
 *
 * SAFETY MODEL (do not weaken):
 *   - This generator NEVER decides whether a counter is allowed. The domain
 *     service re-checks the returned offer against policy (the hard floor,
 *     discount cap, and approval gate) AFTER this function returns. Even a
 *     prompt-injected below-floor offer is rejected + escalated there. This
 *     generator is therefore advisory; the post-LLM policy re-check is the
 *     compliance net.
 *   - We still clamp the proposed offer up to `lowerBound` as a courtesy
 *     pre-clamp so a well-behaved model lands in-band, but we do NOT rely on
 *     it for safety — the service's re-check is authoritative.
 *
 * BOUNDARY NOTE:
 *   `@bossnyumba/ai-copilot` does not depend on `@bossnyumba/domain-services`,
 *   so we cannot import `AiCounterGenerator`/`AiCounterRequest`/`AiCounterResult`
 *   from there. Instead we declare structural mirrors below. The composition
 *   root — which imports both packages — assigns the value produced here into
 *   the service's `aiCounterGenerator` slot; TypeScript's structural typing
 *   makes the shapes interchangeable at that seam. This mirrors the existing
 *   `property-grading/ports.ts` / `damage-deduction` port pattern in
 *   domain-services.
 */

import { z } from 'zod';

import {
  generateStructured,
  ModelTier,
  type AnthropicClient,
  type ModelTierId,
} from '../providers/anthropic-client.js';
import { logger } from '../logger.js';

// ---------------------------------------------------------------------------
// Structural mirrors of the domain `AiCounterGenerator` contract.
// (Kept in sync with services/domain-services/src/negotiation/negotiation-service.ts)
// ---------------------------------------------------------------------------

/** Mirrors `NegotiationConcession` (domain-services/.../negotiation/types.ts). */
export interface NegotiatorConcession {
  readonly kind:
    | 'free_month'
    | 'waived_deposit'
    | 'reduced_deposit'
    | 'payment_plan'
    | 'included_utilities'
    | 'flexible_move_in'
    | 'other';
  readonly description: string;
  readonly monetaryValue?: number;
  readonly maxCount?: number;
}

/**
 * Minimal, read-only view of the negotiation policy this generator needs.
 * Structurally a subset of the domain `NegotiationPolicy`.
 */
export interface NegotiatorPolicyView {
  readonly listPrice: number;
  readonly floorPrice: number;
  readonly approvalRequiredBelow: number;
  readonly maxDiscountPct: number;
  readonly currency: string;
  readonly toneGuide: 'firm' | 'warm' | 'flexible';
  readonly acceptableConcessions: ReadonlyArray<NegotiatorConcession>;
}

/** Minimal view of one turn in the negotiation history. */
export interface NegotiatorTurnView {
  readonly actor: 'prospect' | 'ai' | 'owner' | 'agent' | 'vendor';
  readonly offer: number | null;
  readonly rationale: string | null;
}

/** Minimal view of the negotiation envelope. */
export interface NegotiatorNegotiationView {
  readonly domain: 'lease_price' | 'tender_bid';
  readonly roundCount: number;
}

/** Structural mirror of the domain `AiCounterRequest`. */
export interface NegotiatorRequest {
  readonly policy: NegotiatorPolicyView;
  readonly negotiation: NegotiatorNegotiationView;
  readonly history: ReadonlyArray<NegotiatorTurnView>;
  readonly lowerBound: number;
}

/** Structural mirror of the domain `AiCounterResult`. */
export interface NegotiatorResult {
  readonly offer: number;
  readonly concessions: ReadonlyArray<NegotiatorConcession>;
  readonly rationale: string;
  readonly modelTier: string;
}

/** Structural mirror of the domain `AiCounterGenerator` function type. */
export type NegotiatorGenerator = (
  req: NegotiatorRequest,
) => Promise<NegotiatorResult>;

// ---------------------------------------------------------------------------
// Zod schema for the LLM's structured reply (validated at the boundary).
// ---------------------------------------------------------------------------

const ConcessionKindSchema = z.enum([
  'free_month',
  'waived_deposit',
  'reduced_deposit',
  'payment_plan',
  'included_utilities',
  'flexible_move_in',
  'other',
]);

const ConcessionSchema = z.object({
  kind: ConcessionKindSchema,
  description: z.string().min(1).max(280),
  monetaryValue: z.number().finite().nonnegative().optional(),
  maxCount: z.number().int().positive().optional(),
});

const CounterReplySchema = z.object({
  offer: z.number().finite().positive(),
  concessions: z.array(ConcessionSchema).max(5).default([]),
  rationale: z.string().min(1).max(800),
});

type CounterReply = z.infer<typeof CounterReplySchema>;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface NegotiatorGeneratorConfig {
  /**
   * Anthropic client (or budget-guarded wrapper — structurally identical).
   * Supplied by the composition root ONLY when `ANTHROPIC_API_KEY` is set.
   */
  readonly client: AnthropicClient;
  /** Model tier override. Defaults to Sonnet (cost/quality balance). */
  readonly model?: ModelTierId | string;
  /** Sampling temperature. Default 0.3 — some creativity, mostly anchored. */
  readonly temperature?: number;
  /** Max completion tokens. Default 1024 (a counter is small). */
  readonly maxTokens?: number;
}

const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_TOKENS = 1024;

const NEGOTIATOR_SYSTEM_PROMPT =
  'You are Mr. Mwikila, BossNyumba\'s senior real-estate negotiator acting ' +
  'on behalf of the LANDLORD/owner. You propose a single counter-offer that ' +
  'protects the owner\'s position while keeping the deal alive. You are NOT ' +
  'autonomous: a deterministic policy engine re-checks your offer against a ' +
  'hard floor, a discount cap, and an approval gate after you respond, and ' +
  'will reject and escalate anything out of bounds. Always propose at or ' +
  'above the provided lowerBound. Reply with ONLY a JSON object matching the ' +
  'schema: { "offer": number (minor currency units), "concessions": ' +
  'Concession[], "rationale": string }. Never include prose outside the JSON.';

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function renderHistory(history: ReadonlyArray<NegotiatorTurnView>): string {
  if (history.length === 0) return '(no prior turns)';
  return history
    .map((t, i) => {
      const offer = t.offer === null ? 'n/a' : String(t.offer);
      const why = t.rationale ? ` — ${t.rationale}` : '';
      return `${i + 1}. ${t.actor}: offer=${offer}${why}`;
    })
    .join('\n');
}

function buildPrompt(req: NegotiatorRequest): string {
  const { policy, negotiation, lowerBound } = req;
  const concessionMenu =
    policy.acceptableConcessions.length === 0
      ? '(none pre-approved)'
      : policy.acceptableConcessions
          .map((c) => `- ${c.kind}: ${c.description}`)
          .join('\n');

  return [
    `Domain: ${negotiation.domain}`,
    `Currency: ${policy.currency}`,
    `List price: ${policy.listPrice}`,
    `Hard floor (never below): ${policy.floorPrice}`,
    `Approval gate (escalates below): ${policy.approvalRequiredBelow}`,
    `Max discount fraction: ${policy.maxDiscountPct}`,
    `Tone guide: ${policy.toneGuide}`,
    `Lower bound for YOUR counter (>=): ${lowerBound}`,
    `Round: ${negotiation.roundCount}`,
    '',
    'Pre-approved concession menu (you may offer these instead of more price):',
    concessionMenu,
    '',
    'Negotiation history (oldest first):',
    renderHistory(req.history),
    '',
    `Propose your counter-offer now. The offer MUST be >= ${lowerBound}.`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Mapping LLM reply -> structural NegotiatorResult
// ---------------------------------------------------------------------------

function toConcessions(
  reply: CounterReply,
): ReadonlyArray<NegotiatorConcession> {
  return reply.concessions.map((c) =>
    Object.freeze({
      kind: c.kind,
      description: c.description,
      ...(c.monetaryValue !== undefined
        ? { monetaryValue: c.monetaryValue }
        : {}),
      ...(c.maxCount !== undefined ? { maxCount: c.maxCount } : {}),
    }),
  );
}

/**
 * Build a REAL `AiCounterGenerator` backed by Anthropic.
 *
 * The returned function is structurally assignable to the domain
 * `AiCounterGenerator` type and is intended to be injected at the composition
 * root ONLY when an Anthropic client is available. When the model fails or
 * returns unusable JSON, the function THROWS — the domain service catches the
 * throw and escalates to a human (it never silently proceeds), which is the
 * desired fail-closed behaviour.
 */
export function createNegotiatorCounterGenerator(
  config: NegotiatorGeneratorConfig,
): NegotiatorGenerator {
  const model = config.model ?? ModelTier.SONNET;
  const temperature = config.temperature ?? DEFAULT_TEMPERATURE;
  const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;

  return async (req: NegotiatorRequest): Promise<NegotiatorResult> => {
    const result = await generateStructured<CounterReply>(config.client, {
      prompt: buildPrompt(req),
      schema: CounterReplySchema,
      systemPrompt: NEGOTIATOR_SYSTEM_PROMPT,
      model,
      temperature,
      maxTokens,
    });

    // Courtesy pre-clamp to lowerBound. NOT a safety boundary — the domain
    // service re-checks against the authoritative policy after we return.
    const clampedOffer = Math.max(
      req.lowerBound,
      Math.round(result.data.offer),
    );

    if (clampedOffer !== result.data.offer) {
      logger.info('negotiator: pre-clamped LLM offer up to lowerBound', {
        proposed: result.data.offer,
        lowerBound: req.lowerBound,
        clamped: clampedOffer,
        modelId: result.modelId,
      });
    }

    return Object.freeze({
      offer: clampedOffer,
      concessions: toConcessions(result.data),
      rationale: result.data.rationale,
      modelTier: result.modelId,
    });
  };
}
