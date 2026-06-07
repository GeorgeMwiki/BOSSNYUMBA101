/**
 * Monitor predicate source — the REAL `MonitorChecker` behind the
 * orchestrator's `monitor` Decision.
 *
 * Context
 * -------
 * The main loop emits `monitor` Decisions that carry a FREE-TEXT predicate
 * string (e.g. `rent.paid`, `inspection.completed for property:P1`,
 * "notify when work order WO-12 is closed"). The in-process supervisor
 * (`in-process-wake-scheduler.ts`) and the durable actuators
 * (`durable-loop-actuators.ts`) both poll a `MonitorChecker(predicate,
 * scope) => Promise<boolean>` once per tick; when it returns `true` the
 * watched turn is resumed, otherwise the watch expires cleanly at its
 * timeout. Until now that checker was an honest `async () => false` stub,
 * so every monitor degrade-recorded instead of firing.
 *
 * This module binds a real predicate evaluator backed by tenant-scoped
 * Drizzle reads:
 *
 *   1. PARSE the free-text predicate into a structured intent (zod-
 *      validated). The grammar recognises the property-ops conditions the
 *      brain actually emits:
 *        - payment / arrears  → rent / invoice paid, balance cleared,
 *                               arrears case settled.
 *        - inspection         → inspection completed.
 *        - work-order         → work order closed (completed / verified).
 *        - lease              → lease signed / renewed / expired / active.
 *      Optional entity references (`lease:L1`, `invoice:INV-1`,
 *      `property:P1`, or a bare id token) scope the existence check.
 *
 *   2. MAP each structured kind to a Drizzle existence / threshold query,
 *      run INSIDE `withTenantContext(db, tenantId, ...)` so the
 *      `app.current_tenant_id` GUC is bound and RLS filters the read to
 *      the watch's tenant. A boolean is derived from row existence.
 *
 *   3. FALL BACK to a cheap Haiku LLM boolean for genuinely free-text
 *      predicates the grammar does not recognise — but ONLY when an
 *      Anthropic client is bound AND a small tenant-scoped data snapshot
 *      can be fetched to ground the judgement. Without a client the
 *      evaluator returns `false` + a Pino log (the watch then simply
 *      expires honestly; free-text-without-LLM is a documented residual).
 *
 * Honesty + safety contract
 * -------------------------
 *   - NEVER throws. A DB fault, an unparseable predicate, or an LLM error
 *     resolves to `false` + a Pino log. The poll loop continues / expires
 *     honestly rather than crashing the supervisor.
 *   - RLS-correct. Every read runs through `withTenantContext` so it is
 *     filtered to the watch's tenant. A `platform`-scoped watch (no
 *     tenant) cannot be grounded against tenant tables → `false` + log.
 *   - Immutable. Inputs are `readonly`; the parser returns fresh objects.
 *   - Pino only. The injected logger is the gateway's structured logger.
 */

import { z } from 'zod';
import { and, desc, eq, gt, isNotNull, or } from 'drizzle-orm';
import {
  createDatabaseClient,
  withTenantContext,
  invoices,
  payments,
  arrearsCases,
  inspections,
  workOrders,
  leases,
} from '@bossnyumba/database';
import { getModelLatest } from '@bossnyumba/brain-llm-router/dynamic-registry';
import type { MonitorChecker } from '@bossnyumba/central-intelligence';

/**
 * DatabaseClient type — derived from the factory return rather than the
 * package-barrel `type` export, which TypeScript resolves as a *namespace*
 * through the `export *` re-export chain (TS2709). The middleware
 * (`middleware/database.ts`) uses the identical workaround.
 */
type DatabaseClient = ReturnType<typeof createDatabaseClient>;

// ---------------------------------------------------------------------------
// Logger — structural subset of Pino the gateway threads in. Optional so a
// test can omit it.
// ---------------------------------------------------------------------------

export interface MonitorPredicateLogger {
  info?(meta: object, msg: string): void;
  warn?(meta: object, msg: string): void;
  error?(meta: object, msg: string): void;
}

/**
 * Minimal Anthropic Messages surface used for the free-text fallback. This
 * is exactly the shape `BudgetGuardedAnthropicClient.sdk` exposes, so the
 * composition root can pass `buildBudgetGuardedAnthropicClient(...).sdk`
 * directly. Kept duck-typed so this module compiles without the SDK.
 */
export interface MonitorAnthropicClient {
  messages: {
    create(request: {
      model: string;
      max_tokens: number;
      system?: string;
      messages: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>;
    }): Promise<{ content: ReadonlyArray<{ type: string; text?: string }> }>;
  };
}

export interface MonitorPredicateSourceDeps {
  /**
   * Process-singleton Drizzle client. Reads are wrapped in
   * `withTenantContext(db, tenantId, ...)` per check so RLS binds the
   * watch's tenant. When `null` the evaluator cannot read anything →
   * returns `false` + logs (honest: nothing is being watched).
   */
  readonly db: DatabaseClient | null;
  /**
   * Optional per-tenant Anthropic client factory for the free-text fallback.
   * The composition root binds this to
   * `(tenantId) => buildBudgetGuardedAnthropicClient(tenantId, 'monitor.predicate').sdk`
   * so a free-text evaluation debits the WATCH'S tenant budget (not a shared
   * platform pool). Omitted / returns null ⇒ free-text predicates resolve to
   * `false` + a Pino log (documented residual); structured ones still fire.
   */
  readonly buildAnthropicClient?: (tenantId: string) => MonitorAnthropicClient | null;
  /** Model id for the free-text fallback. Defaults to the latest Haiku. */
  readonly llmModelId?: string;
  readonly logger?: MonitorPredicateLogger;
}

// ---------------------------------------------------------------------------
// Parsed predicate — the structured intent the free-text string maps onto.
// A discriminated union so each kind owns exactly the fields its query needs.
// `unknown` routes to the LLM fallback (or honest `false`).
//
// The TYPE is written explicitly (not `z.infer`): the api-gateway tsconfig
// runs with `strict: false`, under which zod's `discriminatedUnion` inference
// degrades (`Extract<…, {kind:'payment'}>` collapses to `never`). The zod
// schema below is kept PURELY for runtime validation in `safeParse`, so a
// malformed parse can never reach a query with a non-string entity id.
// ---------------------------------------------------------------------------

export type PaymentCondition = 'paid' | 'balance_cleared' | 'arrears_settled';
export type LeaseCondition = 'signed' | 'renewed' | 'expired' | 'active';

export type ParsedPredicate =
  | {
      readonly kind: 'payment';
      readonly condition: PaymentCondition;
      readonly invoiceId?: string;
      readonly leaseId?: string;
      readonly customerId?: string;
    }
  | {
      readonly kind: 'inspection';
      readonly inspectionId?: string;
      readonly propertyId?: string;
    }
  | { readonly kind: 'work_order'; readonly workOrderId?: string }
  | {
      readonly kind: 'lease';
      readonly condition: LeaseCondition;
      readonly leaseId?: string;
    }
  | { readonly kind: 'unknown' };

const PaymentConditionSchema = z.enum(['paid', 'balance_cleared', 'arrears_settled']);
const LeaseConditionSchema = z.enum(['signed', 'renewed', 'expired', 'active']);

const ParsedPredicateSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('payment'),
    condition: PaymentConditionSchema,
    invoiceId: z.string().min(1).optional(),
    leaseId: z.string().min(1).optional(),
    customerId: z.string().min(1).optional(),
  }),
  z.object({
    kind: z.literal('inspection'),
    inspectionId: z.string().min(1).optional(),
    propertyId: z.string().min(1).optional(),
  }),
  z.object({
    kind: z.literal('work_order'),
    workOrderId: z.string().min(1).optional(),
  }),
  z.object({
    kind: z.literal('lease'),
    condition: LeaseConditionSchema,
    leaseId: z.string().min(1).optional(),
  }),
  z.object({ kind: z.literal('unknown') }),
]);

// ---------------------------------------------------------------------------
// Predicate parser — free-text → structured intent.
// ---------------------------------------------------------------------------

/** Regex-escape a literal so multi-word kinds (`work order`) are safe. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * An id-looking token: starts alphanumeric and contains at least one digit
 * somewhere (lookahead) so `L1`, `INV-2`, `WO-7`, `P-9` match but a trailing
 * verb like `renewed` / `completed` / `closed` does NOT.
 */
const ID_TOKEN = '((?=[A-Za-z0-9_\\-.]*[0-9])[A-Za-z0-9][A-Za-z0-9_\\-.]*)';
/** A separator-tagged token: anything after `:` / `=` / `#`. */
const TAGGED_TOKEN = '([A-Za-z0-9_\\-.]+)';

/**
 * Extract an entity id for one of `kinds` from the predicate. Tries, in
 * order: a `kind:id` tag (`lease:L1`), a prepositional phrase
 * (`for lease L1`), then a bare `kind <id>` where the id token contains a
 * digit (`lease L2`, `invoice INV-2`) — the digit requirement avoids
 * mistaking a trailing verb (`lease renewed`) for an id. Returns the FIRST
 * match in the ORIGINAL case. Pure — no I/O.
 */
function extractRef(text: string, kinds: ReadonlyArray<string>): string | undefined {
  for (const kind of kinds) {
    const k = escapeRe(kind);
    // eslint-disable-next-line security/detect-non-literal-regexp -- reason: k is regex-escaped via escapeRe(); kinds are internal predicate config strings, not user input
    const tagged = new RegExp(`${k}\\s*[:=#]\\s*${TAGGED_TOKEN}`, 'i').exec(text);
    if (tagged?.[1]) return tagged[1];
  }
  for (const kind of kinds) {
    const k = escapeRe(kind);
    // eslint-disable-next-line security/detect-non-literal-regexp -- reason: k is regex-escaped via escapeRe(); kinds are internal predicate config strings, not user input
    const phrased = new RegExp(`(?:for|on|of|the)\\s+${k}\\s+${ID_TOKEN}`, 'i').exec(text);
    if (phrased?.[1]) return phrased[1];
  }
  for (const kind of kinds) {
    const k = escapeRe(kind);
    // eslint-disable-next-line security/detect-non-literal-regexp -- reason: k is regex-escaped via escapeRe(); kinds are internal predicate config strings, not user input
    const bare = new RegExp(`${k}\\s+${ID_TOKEN}`, 'i').exec(text);
    if (bare?.[1]) return bare[1];
  }
  return undefined;
}

/** True when `text` contains any of `needles` as a word/substring. */
function hasAny(text: string, needles: ReadonlyArray<string>): boolean {
  return needles.some((n) => text.includes(n));
}

/**
 * `{ [key]: value }` when `value` is defined, else `{}`. Keeps the parser's
 * candidate objects free of `undefined`-valued optional keys (which zod's
 * `.optional()` accepts but `exactOptionalPropertyTypes` would reject).
 */
function optionalField<K extends string>(
  key: K,
  value: string | undefined,
): Record<K, string> | Record<string, never> {
  return value !== undefined ? ({ [key]: value } as Record<K, string>) : {};
}

/**
 * Parse a free-text monitor predicate into a structured intent. Always
 * returns a value validated against {@link ParsedPredicateSchema}; an
 * unrecognised predicate maps to `{ kind: 'unknown' }` (LLM fallback).
 *
 * Pure + total — never throws. Exported for unit tests.
 */
export function parseMonitorPredicate(predicate: string): ParsedPredicate {
  const raw = String(predicate ?? '').trim();
  // `text` (lowercase) drives keyword detection; `raw` (original case) drives
  // entity-id extraction so an id like `L1` / `INV-2` is NOT case-folded.
  const text = raw.toLowerCase();
  if (!text) return { kind: 'unknown' };

  // ── Payment / arrears ────────────────────────────────────────────────
  const mentionsPayment = hasAny(text, [
    'rent',
    'invoice',
    'payment',
    'paid',
    'balance',
    'arrear',
    'settle',
  ]);
  const mentionsInspection = hasAny(text, ['inspection', 'inspect']);
  const mentionsWorkOrder =
    hasAny(text, ['work order', 'work_order', 'workorder', 'work-order']) ||
    (text.includes('wo') && hasAny(text, ['close', 'closed', 'complete']));
  const mentionsLease = text.includes('lease') || text.includes('tenancy');

  // Inspection takes priority over a stray "complete" matching elsewhere.
  if (mentionsInspection && hasAny(text, ['complete', 'completed', 'done', 'finish'])) {
    return safeParse({
      kind: 'inspection' as const,
      ...optionalField('inspectionId', extractRef(raw, ['inspection'])),
      ...optionalField('propertyId', extractRef(raw, ['property', 'unit'])),
    });
  }

  if (
    mentionsWorkOrder &&
    hasAny(text, ['close', 'closed', 'complete', 'completed', 'done', 'resolved', 'verified'])
  ) {
    const ref = extractRef(raw, ['work order', 'work_order', 'workorder', 'work-order', 'wo']);
    return safeParse({
      kind: 'work_order' as const,
      ...optionalField('workOrderId', ref),
    });
  }

  if (mentionsLease) {
    const leaseId = extractRef(raw, ['lease', 'tenancy']);
    let condition: LeaseCondition | null = null;
    if (hasAny(text, ['sign', 'signed', 'execute', 'executed'])) condition = 'signed';
    else if (hasAny(text, ['renew', 'renewed', 'renewal'])) condition = 'renewed';
    else if (hasAny(text, ['expire', 'expired', 'lapse', 'ended', 'terminat'])) condition = 'expired';
    else if (hasAny(text, ['active', 'activated', 'commence'])) condition = 'active';
    if (condition) {
      return safeParse({
        kind: 'lease' as const,
        condition,
        ...optionalField('leaseId', leaseId),
      });
    }
    // A lease mention without a recognised verb falls through to payment
    // (e.g. "rent paid for lease X") or to unknown.
  }

  if (mentionsPayment) {
    let condition: PaymentCondition;
    if (hasAny(text, ['arrear']) && hasAny(text, ['settle', 'settled', 'clear', 'cleared', 'resolved'])) {
      condition = 'arrears_settled';
    } else if (hasAny(text, ['balance']) && hasAny(text, ['clear', 'cleared', 'zero', 'nil', 'settled'])) {
      condition = 'balance_cleared';
    } else {
      condition = 'paid';
    }
    return safeParse({
      kind: 'payment' as const,
      condition,
      ...optionalField('invoiceId', extractRef(raw, ['invoice'])),
      ...optionalField('leaseId', extractRef(raw, ['lease', 'tenancy'])),
      ...optionalField('customerId', extractRef(raw, ['customer', 'tenant'])),
    });
  }

  return { kind: 'unknown' };
}

/**
 * Validate a parser candidate against the zod schema; on any failure fall
 * back to `unknown`. The cast bridges zod's degraded (strict:false) inferred
 * type to the explicit {@link ParsedPredicate} — the runtime shape is
 * guaranteed identical because it is the SAME schema.
 */
function safeParse(candidate: unknown): ParsedPredicate {
  const result = ParsedPredicateSchema.safeParse(candidate);
  return result.success ? (result.data as ParsedPredicate) : { kind: 'unknown' };
}

// ---------------------------------------------------------------------------
// Structured evaluators — one Drizzle existence query per kind. Each runs
// inside the caller's tenant tx (RLS bound). Returns a boolean.
// ---------------------------------------------------------------------------

async function evalPayment(
  tx: DatabaseClient,
  p: Extract<ParsedPredicate, { kind: 'payment' }>,
): Promise<boolean> {
  if (p.condition === 'arrears_settled') {
    // An arrears case is settled when its status flips to settled / written-off.
    const rows = await tx
      .select({ id: arrearsCases.id })
      .from(arrearsCases)
      .where(
        and(
          ...(p.leaseId ? [eq(arrearsCases.leaseId, p.leaseId)] : []),
          ...(p.customerId ? [eq(arrearsCases.customerId, p.customerId)] : []),
          or(eq(arrearsCases.status, 'settled'), eq(arrearsCases.status, 'written_off')),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  if (p.condition === 'balance_cleared') {
    // Balance cleared = a targeted invoice reached zero balance, OR (when an
    // invoice id is given) the invoice is paid. Requires an entity to avoid a
    // tenant-wide "any cleared invoice" false positive.
    if (p.invoiceId) {
      const rows = await tx
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.id, p.invoiceId),
            or(eq(invoices.balanceAmount, 0), eq(invoices.status, 'paid')),
          ),
        )
        .limit(1);
      return rows.length > 0;
    }
    if (p.leaseId) {
      // Every invoice on the lease is paid ⇔ no open (non-paid, non-void)
      // invoice remains with a positive balance.
      const open = await tx
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.leaseId, p.leaseId),
            gt(invoices.balanceAmount, 0),
            or(
              eq(invoices.status, 'pending'),
              eq(invoices.status, 'sent'),
              eq(invoices.status, 'viewed'),
              eq(invoices.status, 'partially_paid'),
              eq(invoices.status, 'overdue'),
            ),
          ),
        )
        .limit(1);
      // Cleared only if at least one invoice exists for the lease AND none
      // are open — guard against "no invoices at all" reading as cleared.
      if (open.length > 0) return false;
      const any = await tx
        .select({ id: invoices.id })
        .from(invoices)
        .where(eq(invoices.leaseId, p.leaseId))
        .limit(1);
      return any.length > 0;
    }
    return false;
  }

  // condition === 'paid' — a completed payment (optionally scoped) exists,
  // or the targeted invoice reached `paid`.
  if (p.invoiceId) {
    const paidInvoice = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.id, p.invoiceId), eq(invoices.status, 'paid')))
      .limit(1);
    if (paidInvoice.length > 0) return true;
    const paidViaPayment = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.invoiceId, p.invoiceId), eq(payments.status, 'completed')))
      .limit(1);
    return paidViaPayment.length > 0;
  }
  const conds = [
    eq(payments.status, 'completed'),
    ...(p.leaseId ? [eq(payments.leaseId, p.leaseId)] : []),
    ...(p.customerId ? [eq(payments.customerId, p.customerId)] : []),
  ];
  // Without ANY entity scope a bare "rent paid" cannot be grounded to a
  // specific obligation — refuse to fire on a tenant-wide match (that would
  // resume on the next unrelated payment). Honest: requires a target.
  if (!p.leaseId && !p.customerId) return false;
  const rows = await tx
    .select({ id: payments.id })
    .from(payments)
    .where(and(...conds))
    .limit(1);
  return rows.length > 0;
}

async function evalInspection(
  tx: DatabaseClient,
  p: Extract<ParsedPredicate, { kind: 'inspection' }>,
): Promise<boolean> {
  // A specific inspection requires its own id; a property-scoped watch fires
  // on the first completed inspection for that property. A bare
  // "inspection completed" with no target cannot be grounded → false.
  if (!p.inspectionId && !p.propertyId) return false;
  const rows = await tx
    .select({ id: inspections.id })
    .from(inspections)
    .where(
      and(
        eq(inspections.status, 'completed'),
        ...(p.inspectionId ? [eq(inspections.id, p.inspectionId)] : []),
        ...(p.propertyId ? [eq(inspections.propertyId, p.propertyId)] : []),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function evalWorkOrder(
  tx: DatabaseClient,
  p: Extract<ParsedPredicate, { kind: 'work_order' }>,
): Promise<boolean> {
  // "Closed" = completed OR verified. A specific id is required; a bare
  // "work order closed" cannot be grounded → false.
  if (!p.workOrderId) return false;
  const rows = await tx
    .select({ id: workOrders.id })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.id, p.workOrderId),
        or(eq(workOrders.status, 'completed'), eq(workOrders.status, 'verified')),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function evalLease(
  tx: DatabaseClient,
  p: Extract<ParsedPredicate, { kind: 'lease' }>,
): Promise<boolean> {
  if (!p.leaseId) {
    // A lease-state watch needs a target lease to avoid firing on any
    // tenant lease reaching the state.
    return false;
  }
  if (p.condition === 'signed') {
    const rows = await tx
      .select({ id: leases.id })
      .from(leases)
      .where(
        and(
          eq(leases.id, p.leaseId),
          eq(leases.signedByTenant, true),
          eq(leases.signedByLandlord, true),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }
  if (p.condition === 'renewed') {
    const rows = await tx
      .select({ id: leases.id })
      .from(leases)
      .where(
        and(
          eq(leases.id, p.leaseId),
          or(
            eq(leases.status, 'renewed'),
            eq(leases.renewalStatus, 'accepted'),
            isNotNull(leases.renewalDecidedAt),
          ),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }
  if (p.condition === 'expired') {
    const rows = await tx
      .select({ id: leases.id })
      .from(leases)
      .where(
        and(
          eq(leases.id, p.leaseId),
          or(eq(leases.status, 'expired'), eq(leases.status, 'terminated')),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }
  // condition === 'active'
  const rows = await tx
    .select({ id: leases.id })
    .from(leases)
    .where(and(eq(leases.id, p.leaseId), eq(leases.status, 'active')))
    .limit(1);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Free-text fallback — cheap Haiku boolean grounded in a small snapshot.
// ---------------------------------------------------------------------------

const FREE_TEXT_SYSTEM_PROMPT = `You evaluate whether a monitoring condition for a property-management system is currently SATISFIED, given a small JSON snapshot of the tenant's recent records.

Return ONLY a JSON object: {"satisfied": BOOLEAN, "reason": STRING}.
- "satisfied" is true ONLY when the snapshot clearly shows the condition is met right now. When the snapshot does not show it (or is empty / ambiguous), return false.
- "reason" is one short sentence (<= 20 words).
Never invent records not present in the snapshot. No markdown. No commentary.`;

/** Snapshot the free-text fallback grounds its judgement on. Small + bounded. */
interface PredicateSnapshot {
  readonly recentCompletedPayments: ReadonlyArray<{ id: string; leaseId: string | null; amount: number; completedAt: string | null }>;
  readonly recentPaidInvoices: ReadonlyArray<{ id: string; leaseId: string | null; status: string; balanceAmount: number }>;
  readonly recentCompletedInspections: ReadonlyArray<{ id: string; propertyId: string; status: string }>;
  readonly recentClosedWorkOrders: ReadonlyArray<{ id: string; status: string }>;
  readonly recentLeaseStates: ReadonlyArray<{ id: string; status: string; renewalStatus: string }>;
}

async function fetchSnapshot(tx: DatabaseClient): Promise<PredicateSnapshot> {
  const [pmts, invs, insp, wos, lz] = await Promise.all([
    tx
      .select({ id: payments.id, leaseId: payments.leaseId, amount: payments.amount, completedAt: payments.completedAt })
      .from(payments)
      .where(eq(payments.status, 'completed'))
      .orderBy(desc(payments.completedAt))
      .limit(10),
    tx
      .select({ id: invoices.id, leaseId: invoices.leaseId, status: invoices.status, balanceAmount: invoices.balanceAmount })
      .from(invoices)
      .where(eq(invoices.status, 'paid'))
      .orderBy(desc(invoices.updatedAt))
      .limit(10),
    tx
      .select({ id: inspections.id, propertyId: inspections.propertyId, status: inspections.status })
      .from(inspections)
      .where(eq(inspections.status, 'completed'))
      .orderBy(desc(inspections.completedDate))
      .limit(10),
    tx
      .select({ id: workOrders.id, status: workOrders.status })
      .from(workOrders)
      .where(or(eq(workOrders.status, 'completed'), eq(workOrders.status, 'verified')))
      .orderBy(desc(workOrders.completedAt))
      .limit(10),
    tx
      .select({ id: leases.id, status: leases.status, renewalStatus: leases.renewalStatus })
      .from(leases)
      .orderBy(desc(leases.updatedAt))
      .limit(10),
  ]);
  return {
    recentCompletedPayments: pmts.map((r) => ({
      id: r.id,
      leaseId: r.leaseId,
      amount: r.amount,
      completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null,
    })),
    recentPaidInvoices: invs.map((r) => ({ id: r.id, leaseId: r.leaseId, status: r.status, balanceAmount: r.balanceAmount })),
    recentCompletedInspections: insp.map((r) => ({ id: r.id, propertyId: r.propertyId, status: r.status })),
    recentClosedWorkOrders: wos.map((r) => ({ id: r.id, status: r.status })),
    recentLeaseStates: lz.map((r) => ({ id: r.id, status: r.status, renewalStatus: r.renewalStatus })),
  };
}

const FreeTextVerdictSchema = z.object({
  satisfied: z.boolean(),
  reason: z.string().optional(),
});

function parseFreeTextVerdict(body: string): boolean {
  const match = body.match(/\{[\s\S]*\}/);
  if (!match) return false;
  try {
    const parsed = FreeTextVerdictSchema.safeParse(JSON.parse(match[0]));
    return parsed.success ? parsed.data.satisfied : false;
  } catch {
    return false;
  }
}

async function evalFreeText(
  deps: MonitorPredicateSourceDeps,
  tx: DatabaseClient,
  tenantId: string,
  predicate: string,
): Promise<boolean> {
  const client = deps.buildAnthropicClient?.(tenantId) ?? null;
  if (!client) return false; // documented residual: no LLM ⇒ no free-text firing.
  const snapshot = await fetchSnapshot(tx);
  const model = deps.llmModelId ?? getModelLatest('haiku');
  const response = await client.messages.create({
    model,
    max_tokens: 256,
    system: FREE_TEXT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content:
          `Condition to evaluate (verbatim): ${predicate}\n\n` +
          `Tenant snapshot (recent records):\n${JSON.stringify(snapshot)}\n\n` +
          `Return the JSON verdict now.`,
      },
    ],
  });
  let body = '';
  for (const block of response.content) {
    if (block.type === 'text' && typeof block.text === 'string') body += block.text;
  }
  return parseFreeTextVerdict(body);
}

// ---------------------------------------------------------------------------
// Public factory — build the bound MonitorChecker.
// ---------------------------------------------------------------------------

/**
 * Build the real `MonitorChecker`. The returned function is what
 * `service-registry.ts` binds into BOTH the in-process supervisor and the
 * durable actuators (replacing the `async () => false` stub) once
 * `monitorAvailable` is flipped to `true`.
 *
 * Cheap + idempotent (one existence query, or one bounded snapshot + Haiku
 * call) so it is safe to invoke once per poll tick. NEVER throws.
 */
export function createMonitorPredicateChecker(
  deps: MonitorPredicateSourceDeps,
): MonitorChecker {
  return async function monitorChecker({ watchId, predicate, scope }) {
    try {
      // A monitor must be grounded against a tenant's data. A platform-scoped
      // watch has no tenant GUC to bind, so it cannot be evaluated against
      // tenant-scoped tables — honest false (the watch expires).
      if (scope.kind !== 'tenant') {
        deps.logger?.info?.(
          { watchId, predicate, scope: scope.kind },
          'monitor-predicate-source: non-tenant scope cannot be grounded; not firing',
        );
        return false;
      }
      if (!deps.db) {
        deps.logger?.warn?.(
          { watchId, predicate },
          'monitor-predicate-source: no db handle; cannot evaluate predicate (not firing)',
        );
        return false;
      }
      const db = deps.db;
      const tenantId = scope.tenantId;
      const parsed = parseMonitorPredicate(predicate);

      return await withTenantContext(db, tenantId, async (tx) => {
        switch (parsed.kind) {
          case 'payment':
            return evalPayment(tx, parsed);
          case 'inspection':
            return evalInspection(tx, parsed);
          case 'work_order':
            return evalWorkOrder(tx, parsed);
          case 'lease':
            return evalLease(tx, parsed);
          case 'unknown':
            return evalFreeText(deps, tx, tenantId, predicate);
          default: {
            // Exhaustiveness guard — a new kind must add a branch above.
            const _never: never = parsed;
            void _never;
            return false;
          }
        }
      });
    } catch (err) {
      // NEVER throw out of the checker — the poll loop continues / expires.
      deps.logger?.error?.(
        { watchId, predicate, err: err instanceof Error ? err.message : String(err) },
        'monitor-predicate-source: predicate evaluation failed (treating as not-fired)',
      );
      return false;
    }
  };
}
