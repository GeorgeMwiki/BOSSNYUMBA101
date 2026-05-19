/**
 * Klarna-pattern human-in-loop wrap.
 *
 * Lesson from Klarna's 2025 retreat (case study): replacing 700 CS agents
 * with an AI auto-resolver destroyed CSAT. Cause: empathy gap + poor
 * escalation + auto-resolution on judgment cases (disputes, refunds,
 * fee-waivers) that needed human discretion.
 *
 * Sierra's outcome-based posture: success only when the human confirms.
 *
 * BOSSNYUMBA mapping:
 *   - rent disputes      → judgment case → never auto-resolve.
 *   - late-fee waivers   → judgment case → never auto-resolve.
 *   - partial refunds    → financial irreversible → never auto-execute.
 *   - lease amendments   → legal-binding → never auto-execute.
 *   - eviction decisions → catastrophic-irreversible → never auto-execute.
 *
 * This wrap is the *only* entrypoint to those five action classes. The MD
 * drafts + routes the proposal — a human (tenant-owner OR BOSSNYUMBA
 * support tier when the owner is the actor's counterparty) must then
 * confirm before any irreversible side effect.
 *
 * The wrap NEVER returns `executed`. It returns one of two routing
 * decisions. The caller (kernel HQ tool) is responsible for blocking
 * until the routing target acks, and only then triggering the actual
 * domain action.
 */

import type {
  KlarnaActionAttempt,
  KlarnaActionClass,
  KlarnaRouting,
  KlarnaRoutingPort,
  KlarnaVerdict,
} from '../types.js';

const SLA_HOURS_BY_CLASS: Readonly<Record<KlarnaActionClass, number>> = Object.freeze({
  'rent-dispute-resolution': 48,
  'late-fee-waiver': 24,
  'partial-refund': 72,
  'lease-amendment': 120,
  'eviction-decision': 168,
});

const SUPPORT_TIER_BY_CLASS: Readonly<
  Record<KlarnaActionClass, 'tier-1' | 'tier-2' | 'tier-3'>
> = Object.freeze({
  'rent-dispute-resolution': 'tier-2',
  'late-fee-waiver': 'tier-1',
  'partial-refund': 'tier-2',
  'lease-amendment': 'tier-3',
  'eviction-decision': 'tier-3',
});

const AUDIT_CITATIONS: ReadonlyArray<string> = Object.freeze([
  'Klarna 2025 case-study — auto-resolution on judgment cases destroys CSAT',
  'Sierra outcome-based posture — success only when human confirms',
  'OWASP LLM06 (2025) — Excessive Agency — expanded section',
  'BOSSNYUMBA L3 #11 — never auto-resolve disputes/refunds/late-fee waivers/lease amendments/evictions',
]);

/**
 * Wrap an MD-drafted action. NEVER executes; always routes.
 *
 * Routing rule:
 *   - If actor is `md-on-behalf-of-owner` → route to tenant owner first.
 *   - If actor is `md-on-behalf-of-tenant-owner-customer` (i.e. the
 *     owner is on the *opposite* side of the action — e.g. they ARE the
 *     dispute counterparty) → route to BOSSNYUMBA support tier so the
 *     same person is not actor + approver.
 *   - If actor is `md-on-behalf-of-system` → route to BOSSNYUMBA support
 *     tier (no individual owner to route to).
 */
export async function routeKlarnaAction(
  args: {
    readonly attempt: KlarnaActionAttempt;
    readonly routing: KlarnaRoutingPort;
  },
): Promise<KlarnaVerdict> {
  const { attempt, routing } = args;
  const slaHours = SLA_HOURS_BY_CLASS[attempt.actionClass];
  const supportTier = SUPPORT_TIER_BY_CLASS[attempt.actionClass];

  const routingDecision: KlarnaRouting =
    attempt.actor.kind === 'md-on-behalf-of-owner'
      ? Object.freeze({
          kind: 'route-to-tenant-owner',
          ownerId: attempt.actor.ownerId,
          slaHours,
        })
      : Object.freeze({
          kind: 'route-to-bossnyumba-support',
          tier: supportTier,
          slaHours,
        });

  await routing.route({
    attemptId: attempt.attemptId,
    routing: routingDecision,
    draft: attempt.draft,
  });

  return Object.freeze({
    attemptId: attempt.attemptId,
    verdict: 'routed-not-executed',
    routing: routingDecision,
    auditCitations: AUDIT_CITATIONS,
    draftPreserved: attempt.draft,
    routedAt: new Date().toISOString(),
  });
}

/**
 * Predicate — is the action class one that requires the Klarna wrap?
 * Useful for the kernel HQ-tool dispatcher to refuse direct execution.
 */
export function requiresKlarnaWrap(actionClass: string): actionClass is KlarnaActionClass {
  switch (actionClass) {
    case 'rent-dispute-resolution':
    case 'late-fee-waiver':
    case 'partial-refund':
    case 'lease-amendment':
    case 'eviction-decision':
      return true;
    default:
      return false;
  }
}

/**
 * Re-export the action-class SLA + support-tier mapping for visibility.
 */
export const KLARNA_SLA_HOURS = SLA_HOURS_BY_CLASS;
export const KLARNA_SUPPORT_TIER = SUPPORT_TIER_BY_CLASS;
