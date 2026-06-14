/**
 * POST /outcomes/events — manual OutcomeEvent submission endpoint.
 *
 * Production traffic lands on the brain-event-bus consumer
 * (`createBrainEventConsumer`); this HTTP route exists for two
 * concrete use cases:
 *
 *   - Operators and integration tests can replay a single
 *     OutcomeEvent without standing up a bus.
 *   - The billing engine and admin UI can backfill an event that
 *     was lost in an outage with full traceability.
 *
 * Idempotent on `(tenantId, eventId)` — the underlying store commits
 * the idempotency anchor AND the billing line in ONE transaction
 * (`store.commitOutcome`), so a duplicate that returns
 * `{ inserted: false }` is a TRUE replay: the prior commit already
 * wrote the billing line atomically. We propagate that as a 200 with
 * `idempotent: true` rather than 4xx. A partial commit can never
 * happen — there is no window where the anchor lands without the
 * billing line (finding ANCHOR-BEFORE-BILLING).
 *
 * Tenant scoping: the caller supplies `tenantId` in the request
 * header `X-Tenant-Id`. The route refuses requests with no header in
 * production (when `NODE_ENV === 'production'`); dev/test deploys
 * trust the header for simplicity.
 */

import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  scoreRentCollected,
  scoreTicketResolved,
  scoreVacancyFilled,
  type MeteringRecord,
  type OutcomeEvent,
} from '@bossnyumba/outcomes';
import {
  recordSecurityEvent,
  withSecurityEventsFastify,
} from '@bossnyumba/observability';
import { requireUser } from '../middleware/auth.js';
import type { BillingStore } from '../store/billing-store.js';
import type { ConsumerLogger } from '../consumers/brain-event-consumer.js';
// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const OutcomeEventInputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('ticket_resolved_within_sla'),
    eventId: z.string().min(1),
    tenantId: z.string().min(1),
    propertyId: z.string().min(1),
    agentId: z.string().min(1),
    occurredAt: z.string().min(1),
    confidence: z.number().min(0).max(1),
    evidenceHash: z.string(),
    ticketId: z.string().min(1),
    slaWindowHours: z.number().int().min(0),
    resolutionTimeHours: z.number().min(0),
    tenantConfirmed: z.boolean(),
    reopenedWithinWindow: z.boolean(),
    /** Optional industry-baseline human-cost cents. Defaults 4000 ($40). */
    humanCostMinor: z.number().int().min(0).optional(),
  }),
  z.object({
    kind: z.literal('rent_collected'),
    eventId: z.string().min(1),
    tenantId: z.string().min(1),
    propertyId: z.string().min(1),
    agentId: z.string().min(1),
    occurredAt: z.string().min(1),
    confidence: z.number().min(0).max(1),
    evidenceHash: z.string(),
    billingPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    collectedMinor: z.number().int().min(0),
    recoveredDelinquencyMinor: z.number().int().min(0),
    baselineCollectedMinor: z.number().int().min(0),
    bankReconciled: z.boolean(),
    chargedBack: z.boolean(),
  }),
  z.object({
    kind: z.literal('vacancy_filled'),
    eventId: z.string().min(1),
    tenantId: z.string().min(1),
    propertyId: z.string().min(1),
    agentId: z.string().min(1),
    occurredAt: z.string().min(1),
    confidence: z.number().min(0).max(1),
    evidenceHash: z.string(),
    unitId: z.string().min(1),
    leaseId: z.string().min(1),
    leaseExecuted: z.boolean(),
    moveInCompleted: z.boolean(),
    monthlyRentMinor: z.number().int().min(0),
    currency: z.string().length(3),
    cancelledWithinWindow: z.boolean(),
  }),
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the effective tenantId for a request. ALWAYS returns the
 * session-bound value from the verified JWT — the legacy `X-Tenant-Id`
 * header trust path was removed (P75 / P86 closure CWE-285). The
 * body's `tenantId` is still cross-checked further down: a mismatch
 * fires a security event and rejects the request, since it indicates
 * either an operator confusion or a tampering attempt.
 */
function pickTenantId(request: FastifyRequest): string {
  return requireUser(request).tenantId;
}

function scoreOutcome(
  event: OutcomeEvent,
  nowIso: string,
  recordId: string,
  humanCostMinor: number | undefined,
): MeteringRecord {
  switch (event.kind) {
    case 'ticket_resolved_within_sla':
      return scoreTicketResolved(event, {
        recordId,
        nowIso,
        humanCostMinor: humanCostMinor ?? 4000,
      });
    case 'rent_collected':
      return scoreRentCollected(event, { recordId, nowIso });
    case 'vacancy_filled':
      return scoreVacancyFilled(event, { recordId, nowIso });
    default: {
      // Exhaustiveness — never reached because the schema is closed.
      const _exhaustive: never = event;
      throw new Error(`outcomes-metering: unhandled outcome kind ${String(_exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export interface RegisterEventsRoutesDeps {
  readonly store: BillingStore;
  readonly clock?: () => Date;
  readonly newRecordId?: () => string;
  /** Optional structured logger threaded into the failure-alert path. */
  readonly logger?: ConsumerLogger;
}

/**
 * Emit a staff alert when a money-path commit fails AFTER validation.
 * A failed commit means revenue may be at risk (the event was valid +
 * billable but the billing line did not land), so this fires a
 * `critical` security event — which routes to SRE per
 * `recordSecurityEvent` semantics — and logs at error level. Best
 * effort: `recordSecurityEvent` never throws, and we swallow logger
 * errors so the alert path cannot itself crash the request.
 */
async function emitBillingPersistFailureAlert(args: {
  readonly tenantId: string;
  readonly actorId: string;
  readonly eventId: string;
  readonly recordId: string;
  readonly route: string;
  readonly method: string;
  readonly err: unknown;
  readonly logger?: ConsumerLogger;
}): Promise<void> {
  const errMessage = args.err instanceof Error ? args.err.message : String(args.err);
  args.logger?.error?.(
    {
      tenantId: args.tenantId,
      eventId: args.eventId,
      recordId: args.recordId,
      err: errMessage,
    },
    'outcomes-metering: billing commit failed — revenue at risk, retry expected',
  );
  await recordSecurityEvent({
    action: 'outcomes.events.billing_commit_failed',
    resource: 'events',
    severity: 'critical',
    method: args.method,
    route: args.route,
    tenantId: args.tenantId,
    actorId: args.actorId,
    detail: {
      eventId: args.eventId,
      recordId: args.recordId,
      err: errMessage,
      note: 'idempotency anchor + billing line commit failed; no success reported; retry safe',
    },
  });
}

export async function registerEventsRoutes(
  app: FastifyInstance,
  deps: RegisterEventsRoutesDeps,
): Promise<void> {
  const clock = deps.clock ?? (() => new Date());
  const newRecordId = deps.newRecordId ?? (() => randomUUID());

  app.post('/outcomes/events', withSecurityEventsFastify({ action: 'events.create', resource: 'events', severity: 'info' }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = OutcomeEventInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_event_payload',
        details: parsed.error.flatten(),
      });
    }
    const event = parsed.data;
    const tenantId = pickTenantId(request);

    // Cross-check: the body's tenantId MUST match the session-derived
    // tenantId. Otherwise a confused operator could write into the
    // wrong tenant's billing log. Emit a security event so SREs can
    // detect tampering attempts or stale clients.
    if (event.tenantId !== tenantId) {
      void recordSecurityEvent({
        action: 'outcomes.events.create.tenant_mismatch',
        resource: 'events',
        severity: 'warn',
        method: request.method,
        route: request.url,
        tenantId,
        actorId: requireUser(request).userId,
        detail: {
          sessionTenantId: tenantId,
          bodyTenantId: event.tenantId,
          note: 'request rejected — body tenant disagrees with session tenant',
        },
      });
      return reply.code(403).send({
        error: 'tenant_id_mismatch',
        message: 'session tenant and payload tenantId disagree',
      });
    }

    const tightEvent: OutcomeEvent = event;

    // 1. Score the (PURE) outcome FIRST — before any DB claim. A scorer
    //    throw here returns 500 with NO row written, so it can never
    //    orphan an idempotency anchor (finding ANCHOR-BEFORE-BILLING).
    //    Pull humanCostMinor off the request body (the schema carries
    //    it ONLY for the ticket variant); it's a scorer option, not an
    //    event field, so the OutcomeEvent type does not declare it.
    const humanCostMinor =
      event.kind === 'ticket_resolved_within_sla'
        ? event.humanCostMinor
        : undefined;
    const meteringRecord = scoreOutcome(
      tightEvent,
      clock().toISOString(),
      newRecordId(),
      humanCostMinor,
    );

    // 2. Commit the anchor + billing line ATOMICALLY (one transaction).
    //    The idempotency claim is taken ONLY when the billing line
    //    lands too — no window where the anchor exists without revenue.
    let commit: { inserted: boolean };
    try {
      commit = await deps.store.commitOutcome(
        {
          tenantId,
          eventId: tightEvent.eventId,
          outcomeKind: tightEvent.kind,
          propertyId: tightEvent.propertyId,
          agentId: tightEvent.agentId,
          occurredAtIso: tightEvent.occurredAt,
          payload: tightEvent,
          sourceEventType: 'http.outcome.event',
        },
        meteringRecord,
      );
    } catch (err) {
      // Post-validation persistence failure. Do NOT report idempotent
      // success — the anchor was NOT claimed (the transaction rolled
      // back), so a retry will reprocess cleanly. Emit a staff alert
      // and return a RETRYABLE error.
      await emitBillingPersistFailureAlert({
        tenantId,
        actorId: requireUser(request).userId,
        eventId: tightEvent.eventId,
        recordId: meteringRecord.recordId,
        route: request.url,
        method: request.method,
        err,
        logger: deps.logger,
      });
      return reply.code(503).send({
        error: 'billing_commit_failed',
        message: 'failed to commit outcome — safe to retry',
        eventId: tightEvent.eventId,
        retryable: true,
      });
    }

    if (!commit.inserted) {
      // TRUE duplicate — the prior commit wrote the billing line
      // atomically, so this is a safe replay, not a lost-revenue case.
      return reply.code(200).send({
        idempotent: true,
        message: 'event already recorded',
        eventId: tightEvent.eventId,
      });
    }

    return reply.code(201).send({
      idempotent: false,
      eventId: tightEvent.eventId,
      recordId: meteringRecord.recordId,
      qualified: meteringRecord.qualified,
      reason: meteringRecord.reason,
      billableAmountMinor: meteringRecord.billableAmountMinor,
      currency: meteringRecord.currency,
      clawbackClosesAt: meteringRecord.clawbackClosesAt,
    });
  }));
}
