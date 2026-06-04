/**
 * `@bossnyumba/belief-engine` — shared domain types + boundary schemas.
 *
 * Backs the always-learning, convince-yourself loop. Every chat turn /
 * decision can fire the learning hook; the hook extracts factual claims and
 * either investigates (no prior belief) or runs the convince-loop (a prior
 * belief exists). The brain revises a belief ONLY when the confidence delta
 * clears the 0.25 gate.
 *
 * Beliefs are property facts: tenant reliability, unit demand, arrears risk,
 * rent comparables, occupancy seasonality, neighbourhood demand, and the
 * regulatory rules (tenancy act, withholding-tax rates, rent regulation) the
 * platform reasons over.
 *
 * Tenant mapping per the port conventions: `subjectUserId` is an owner /
 * operator id; `subjectOrgId` an org id (a managed portfolio). Both null ⇒
 * platform-wide / domain-scoped fact, readable by all.
 *
 * Tables backing these types at the app composition root:
 *   - brain_beliefs            (one row per subject+scope)
 *   - belief_revisions         (immutable revision history)
 *   - belief_review_queue      (the 0.05-0.25 split band)
 *   - correlation_findings     (nightly belief x outcome pass)
 *
 * All domain types are readonly; the zod schemas validate at boundaries.
 */

import { z } from 'zod';

export type BeliefDomain =
  | 'regulatory' // tenancy-act rules, WHT rate, rent-regulation caps
  | 'market-economics' // rent yields, occupancy seasonality, deposit norms
  | 'regional-economics' // demand patterns per region / neighbourhood
  | 'market-prices' // rent comparables, property valuations, FX rates
  | 'portfolio-pattern' // empirical patterns across properties / owners
  | 'process' // operational facts about the platform itself
  | 'general';

export const ALL_BELIEF_DOMAINS: ReadonlyArray<BeliefDomain> = [
  'regulatory',
  'market-economics',
  'regional-economics',
  'market-prices',
  'portfolio-pattern',
  'process',
  'general',
];

export type BeliefValueKind =
  | 'scalar'
  | 'range'
  | 'categorical'
  | 'boolean'
  | 'text';

export interface BeliefValue {
  readonly kind: BeliefValueKind;
  readonly scalar?: number;
  readonly rangeMin?: number;
  readonly rangeMax?: number;
  readonly unit?: string;
  readonly categorical?: string;
  readonly boolean?: boolean;
  readonly text?: string;
}

export type BeliefSourceKind =
  | 'user-claim'
  | 'web-research'
  | 'internal-data'
  | 'regulator-doc'
  | 'prior-belief'
  | 'manager-input'
  | 'admin-input';

export interface BeliefSource {
  readonly kind: BeliefSourceKind;
  /** 0..1 authority weight. */
  readonly authority: number;
  readonly url?: string;
  readonly excerpt?: string;
  readonly capturedAt: string;
  /** owner/operator id, org id, or doc id (anonymised when public). */
  readonly authorRef?: string;
}

export interface Belief {
  readonly id: string;
  readonly domain: BeliefDomain;
  /** canonical key, e.g. 'kinondoni-2br-rent-comparable'. */
  readonly subject: string;
  readonly description: string;
  readonly value: BeliefValue;
  /** 0..1 */
  readonly confidence: number;
  readonly sources: ReadonlyArray<BeliefSource>;
  readonly revisedAt: string;
  readonly revisionCount: number;
  readonly tags: ReadonlyArray<string>;
  /**
   * Nullable tenant scope.
   *   subjectUserId set → owner/operator-scoped (only readable by that user)
   *   subjectOrgId set  → org/portfolio-scoped (only readable by org members)
   *   both null         → platform-wide / domain-scoped (readable by all)
   */
  readonly subjectUserId?: string | null;
  readonly subjectOrgId?: string | null;
}

/** Product surfaces a claim can arrive from (owner > admin > manager > agent). */
export type ChatPortal = 'agent' | 'manager' | 'admin' | 'owner';

export const ALL_CHAT_PORTALS: ReadonlyArray<ChatPortal> = [
  'agent',
  'manager',
  'admin',
  'owner',
];

export interface ExtractedClaim {
  readonly subject: string;
  readonly description: string;
  readonly proposedValue: BeliefValue;
  /** exact phrase from the source turn. */
  readonly evidenceFromTurn: string;
  /** initial confidence from the extractor (0..1). */
  readonly confidence: number;
  readonly conversationId: string;
  readonly turnId: string;
  readonly portal: ChatPortal;
  readonly domain: BeliefDomain;
  readonly subjectUserId?: string | null;
  readonly subjectOrgId?: string | null;
  /**
   * Quarantine flag set by the prompt-injection defence layer when the
   * source span looked suspicious. When true the convince-loop raises the
   * required revise floor from 0.25 to 0.4 before the belief becomes writable.
   */
  readonly quarantined?: boolean;
}

export type ConvinceAction = 'no-change' | 'strengthen' | 'revise' | 'split';

export interface ConvinceResult {
  readonly action: ConvinceAction;
  readonly priorBelief: Belief | null;
  readonly newBelief: Belief;
  readonly confidenceDelta: number;
  readonly rationale: string;
  readonly newSourcesAdded: number;
  readonly contradictionDetected: boolean;
  /** Set when action === 'split' — the queued review item id (if persisted). */
  readonly reviewQueued?: boolean;
}

export interface CorrelationFinding {
  readonly id: string;
  readonly segment: string | null;
  readonly region: string | null;
  readonly beliefSubject: string;
  readonly outcomeMetric: string;
  readonly r: number;
  readonly p: number;
  readonly n: number;
  readonly summary: string;
  readonly generatedAt: string;
}

export interface WebSearchResult {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
  readonly authority: number;
}

export type RevisionTrigger =
  | 'chat-hook'
  | 'admin-force'
  | 'cron-pass'
  | 'self-revision'
  | 'signal-emitter';

/** Optional tenant scope passed alongside a subject lookup / list. */
export interface BeliefScope {
  readonly subjectUserId?: string | null;
  readonly subjectOrgId?: string | null;
}

export interface RevisionRecord {
  readonly beliefId: string;
  readonly before: Belief;
  readonly after: Belief;
  readonly rationale: string;
  readonly newSources: ReadonlyArray<BeliefSource>;
  readonly triggeredBy?: RevisionTrigger;
}

export interface ReviewQueueItem {
  readonly beliefId: string;
  readonly subject: string;
  readonly proposedValue: BeliefValue;
  readonly confidenceDelta: number;
  readonly rationale: string;
  readonly subjectUserId?: string | null;
  readonly subjectOrgId?: string | null;
}

// ─────────────────────────────────────────────────────────────────────
// Boundary schemas — zod validates external input at the facade seam.
// ─────────────────────────────────────────────────────────────────────

const beliefValueSchema = z
  .object({
    kind: z.enum(['scalar', 'range', 'categorical', 'boolean', 'text']),
    scalar: z.number().finite().optional(),
    rangeMin: z.number().finite().optional(),
    rangeMax: z.number().finite().optional(),
    unit: z.string().optional(),
    categorical: z.string().optional(),
    boolean: z.boolean().optional(),
    text: z.string().optional(),
  })
  .strict();

/**
 * Request schema for an extracted claim crossing the facade boundary. The
 * parse is the boundary guard — handlers forward the original already-typed
 * value into exact-optional interfaces rather than `parsed.data`.
 */
export const extractedClaimSchema = z
  .object({
    subject: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    proposedValue: beliefValueSchema,
    evidenceFromTurn: z.string().max(4000),
    confidence: z.number().min(0).max(1),
    conversationId: z.string().min(1),
    turnId: z.string().min(1),
    portal: z.enum(['agent', 'manager', 'admin', 'owner']),
    domain: z.enum([
      'regulatory',
      'market-economics',
      'regional-economics',
      'market-prices',
      'portfolio-pattern',
      'process',
      'general',
    ]),
    subjectUserId: z.string().nullable().optional(),
    subjectOrgId: z.string().nullable().optional(),
    quarantined: z.boolean().optional(),
  })
  .strict();

/**
 * Numeric-input schema for a single finite, bounded confidence/authority
 * value. Used to reject NaN / Infinity payloads at a boundary.
 */
export const unitIntervalSchema = z.number().min(0).max(1);
