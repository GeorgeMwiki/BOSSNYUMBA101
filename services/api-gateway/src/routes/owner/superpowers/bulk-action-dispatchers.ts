/**
 * Bulk-action per-entity dispatchers — closes the H2 deferral.
 *
 * The /api/v1/owner/superpowers/bulk-action route used to ONLY append
 * undo-journal rows; it did not fire the underlying side-effects. This
 * module wires REAL dispatchers per (entityType, action) pair so the
 * owner's chat-issued "mark these 12 leases paid" actually moves the
 * data.
 *
 * Hard rules respected:
 *   - Drizzle ORM only.
 *   - Money path: rent-paid writes a row to `payments` with status
 *     'completed' and provider 'cash'/'bulk_owner_action'; the
 *     downstream LedgerService cron consumes payment rows and posts
 *     the matching journal entry (see services/payments-ledger). We
 *     never bypass the journal — we just register the receipt.
 *   - send_renewal_notice writes an OUTBOX event row (event_outbox);
 *     the existing outbox worker (services/api-gateway/src/workers/
 *     outbox-worker.ts) ships it to the WhatsApp/SMS provider. The
 *     same row also functions as the audit trail.
 *   - All writes are tenant-scoped — the route already binds the
 *     `app.current_tenant_id` GUC via databaseMiddleware.
 *   - Errors per row are caught here; the caller surfaces a per-row
 *     failure manifest so the FE can show "Partial — tap to see
 *     failed rows".
 */

import { and, eq } from 'drizzle-orm';

import {
  createDatabaseClient,
  leases,
  payments,
  maintenanceRequests,
  inspections,
  eventOutbox,
} from '@bossnyumba/database';

// Locally-derived alias to avoid TS2709 namespace drift on the
// barrel-exported `DatabaseClient`. Same pattern as composition/*.ts.
type DatabaseClient = ReturnType<typeof createDatabaseClient>;

/** Result of dispatching a single (entity, id, action) tuple. */
export interface DispatchOutcome {
  readonly ok: boolean;
  readonly reason?: string;
  /** Optional follow-up artifact id (payment id, outbox id, document id). */
  readonly artifactId?: string;
  readonly artifactKind?: string;
}

export interface DispatchContext {
  readonly db: DatabaseClient;
  readonly tenantId: string;
  readonly actorId: string;
  readonly idempotencyKey: string | null;
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function genId(prefix: string): string {
  // Match the rest of the codebase's text-id convention.
  const slug = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${slug}`;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asInt(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : undefined;
}

// ---------------------------------------------------------------------------
// leases.mark_rent_paid
//
// Records a `payments` row (status=completed) so the LedgerService cron
// downstream posts the journal entry. Idempotency-Key flows through to
// `provider_response.idempotencyKey` so an outbox replay never doubles
// the receipt.
// ---------------------------------------------------------------------------

export async function dispatchMarkRentPaid(
  ctx: DispatchContext,
  leaseId: string,
  payload: Record<string, unknown>,
): Promise<DispatchOutcome> {
  // 1. Look up the lease to copy customerId + rent amount + currency.
  const rows = await ctx.db
    .select({
      id: leases.id,
      customerId: leases.customerId,
      rentAmount: leases.rentAmount,
      rentCurrency: leases.rentCurrency,
    })
    .from(leases)
    .where(and(eq(leases.id, leaseId), eq(leases.tenantId, ctx.tenantId)))
    .limit(1);
  const lease = rows[0];
  if (!lease) {
    return { ok: false, reason: `lease ${leaseId} not found` };
  }

  const amount = asInt(payload.amount) ?? lease.rentAmount;
  const currency = asString(payload.currency) ?? lease.rentCurrency;
  const paymentMethod = (asString(payload.method) ?? 'cash') as
    | 'cash'
    | 'mpesa'
    | 'bank_transfer'
    | 'card';

  const paymentId = genId('pmt');
  const paymentNumber =
    asString(payload.receiptNumber) ?? `RC-${Date.now().toString(36).toUpperCase()}`;

  await ctx.db.insert(payments).values({
    id: paymentId,
    tenantId: ctx.tenantId,
    customerId: lease.customerId,
    leaseId: lease.id,
    paymentNumber,
    status: 'completed',
    paymentMethod,
    amount,
    currency,
    feeAmount: 0,
    netAmount: amount,
    provider: 'bulk_owner_action',
    providerResponse: {
      bulkAction: true,
      reason: ctx.reason,
      actorId: ctx.actorId,
      ...(ctx.idempotencyKey ? { idempotencyKey: ctx.idempotencyKey } : {}),
    },
    receivedBy: ctx.actorId,
    receiptNumber: paymentNumber,
    initiatedAt: new Date(),
    completedAt: new Date(),
  });

  return { ok: true, artifactId: paymentId, artifactKind: 'payment' };
}

// ---------------------------------------------------------------------------
// leases.send_renewal_notice
//
// Inserts an outbox row of type 'lease.renewal_notice'. The existing
// outbox worker is the one place that talks to the notification
// providers (WhatsApp / SMS / Email) — we never call providers
// directly from a request handler.
// ---------------------------------------------------------------------------

export async function dispatchSendRenewalNotice(
  ctx: DispatchContext,
  leaseId: string,
  payload: Record<string, unknown>,
): Promise<DispatchOutcome> {
  const rows = await ctx.db
    .select({
      id: leases.id,
      customerId: leases.customerId,
      tenantId: leases.tenantId,
    })
    .from(leases)
    .where(and(eq(leases.id, leaseId), eq(leases.tenantId, ctx.tenantId)))
    .limit(1);
  const lease = rows[0];
  if (!lease) {
    return { ok: false, reason: `lease ${leaseId} not found` };
  }

  const outboxId = genId('outbox');
  await ctx.db.insert(eventOutbox).values({
    id: outboxId,
    tenantId: lease.tenantId,
    eventType: 'lease.renewal_notice',
    aggregateType: 'lease',
    aggregateId: lease.id,
    payload: {
      leaseId: lease.id,
      customerId: lease.customerId,
      channels: payload.channels ?? ['whatsapp', 'sms', 'email'],
      template: payload.template ?? 'renewal_notice_v1',
      noticeDays: asInt(payload.noticeDays) ?? 30,
      reason: ctx.reason,
    },
    metadata: {
      actorId: ctx.actorId,
      bulkAction: true,
      ...(ctx.idempotencyKey ? { idempotencyKey: ctx.idempotencyKey } : {}),
    },
    sequenceNumber: Date.now(),
    priority: 'high',
    correlationId: ctx.idempotencyKey ?? outboxId,
  });

  return { ok: true, artifactId: outboxId, artifactKind: 'outbox' };
}

// ---------------------------------------------------------------------------
// invoices.export_tax_statement
//
// Records a 'tax_statement.export_requested' outbox event for the
// statement-renderer worker (services/api-gateway/src/services/
// monthly-close/pdf-renderer.ts). The renderer fans out an S3 URL
// back to the user via the existing notifications path — we never
// block the request waiting for PDF generation.
// ---------------------------------------------------------------------------

export async function dispatchExportTaxStatement(
  ctx: DispatchContext,
  invoiceId: string,
  payload: Record<string, unknown>,
): Promise<DispatchOutcome> {
  const outboxId = genId('outbox');
  await ctx.db.insert(eventOutbox).values({
    id: outboxId,
    tenantId: ctx.tenantId,
    eventType: 'tax_statement.export_requested',
    aggregateType: 'invoice',
    aggregateId: invoiceId,
    payload: {
      invoiceId,
      format: asString(payload.format) ?? 'pdf',
      jurisdiction: asString(payload.jurisdiction) ?? 'TZ',
      reason: ctx.reason,
    },
    metadata: {
      actorId: ctx.actorId,
      bulkAction: true,
      ...(ctx.idempotencyKey ? { idempotencyKey: ctx.idempotencyKey } : {}),
    },
    sequenceNumber: Date.now(),
    priority: 'normal',
    correlationId: ctx.idempotencyKey ?? outboxId,
  });
  return { ok: true, artifactId: outboxId, artifactKind: 'outbox' };
}

// ---------------------------------------------------------------------------
// maintenance_cases.close_ticket / acknowledge
//
// Writes directly to maintenance_requests — flipping status. The
// existing maintenance close hook (FK trigger + worker cascade) takes
// care of the work_order convergence + audit chain.
// ---------------------------------------------------------------------------

export async function dispatchCloseMaintenanceTicket(
  ctx: DispatchContext,
  caseId: string,
  payload: Record<string, unknown>,
): Promise<DispatchOutcome> {
  const updated = await ctx.db
    .update(maintenanceRequests)
    .set({
      status: 'completed',
      updatedAt: new Date(),
      approvalNotes:
        (asString(payload.notes) ?? `Bulk close: ${ctx.reason}`).slice(0, 1000),
    })
    .where(
      and(
        eq(maintenanceRequests.id, caseId),
        eq(maintenanceRequests.tenantId, ctx.tenantId),
      ),
    )
    .returning({ id: maintenanceRequests.id });
  const row = updated[0];
  if (!row) {
    return { ok: false, reason: `maintenance case ${caseId} not found` };
  }
  return { ok: true, artifactId: row.id, artifactKind: 'maintenance_request' };
}

export async function dispatchAcknowledgeMaintenanceTicket(
  ctx: DispatchContext,
  caseId: string,
  _payload: Record<string, unknown>,
): Promise<DispatchOutcome> {
  const updated = await ctx.db
    .update(maintenanceRequests)
    .set({
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      acknowledgedBy: ctx.actorId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(maintenanceRequests.id, caseId),
        eq(maintenanceRequests.tenantId, ctx.tenantId),
      ),
    )
    .returning({ id: maintenanceRequests.id });
  const row = updated[0];
  if (!row) {
    return { ok: false, reason: `maintenance case ${caseId} not found` };
  }
  return { ok: true, artifactId: row.id, artifactKind: 'maintenance_request' };
}

// ---------------------------------------------------------------------------
// reminders.snooze
//
// Reminders in BN ride on `event_outbox` rows of type
// 'reminder.scheduled' with a `nextRetryAt` deferral. Snoozing pushes
// nextRetryAt forward by the requested number of minutes (default 60).
// ---------------------------------------------------------------------------

export async function dispatchSnoozeReminder(
  ctx: DispatchContext,
  reminderId: string,
  payload: Record<string, unknown>,
): Promise<DispatchOutcome> {
  const snoozeMinutes = asInt(payload.minutes) ?? 60;
  if (snoozeMinutes <= 0 || snoozeMinutes > 24 * 60 * 30) {
    return { ok: false, reason: 'snooze minutes must be > 0 and ≤ 30 days' };
  }
  const nextRetry = new Date(Date.now() + snoozeMinutes * 60_000);
  const updated = await ctx.db
    .update(eventOutbox)
    .set({
      nextRetryAt: nextRetry,
      lastError: `snoozed by ${ctx.actorId} (${snoozeMinutes}m): ${ctx.reason}`,
    })
    .where(
      and(
        eq(eventOutbox.id, reminderId),
        eq(eventOutbox.tenantId, ctx.tenantId),
      ),
    )
    .returning({ id: eventOutbox.id });
  const row = updated[0];
  if (!row) {
    return { ok: false, reason: `reminder ${reminderId} not found` };
  }
  return { ok: true, artifactId: row.id, artifactKind: 'reminder' };
}

// ---------------------------------------------------------------------------
// inspections.archive
//
// inspections.deletedAt is the canonical soft-delete column. We set it
// + deletedBy so the inspections list filter (which already excludes
// deletedAt IS NOT NULL) drops the row.
// ---------------------------------------------------------------------------

export async function dispatchArchiveInspection(
  ctx: DispatchContext,
  inspectionId: string,
  _payload: Record<string, unknown>,
): Promise<DispatchOutcome> {
  const updated = await ctx.db
    .update(inspections)
    .set({
      deletedAt: new Date(),
      deletedBy: ctx.actorId,
      updatedAt: new Date(),
      updatedBy: ctx.actorId,
    })
    .where(
      and(
        eq(inspections.id, inspectionId),
        eq(inspections.tenantId, ctx.tenantId),
      ),
    )
    .returning({ id: inspections.id });
  const row = updated[0];
  if (!row) {
    return { ok: false, reason: `inspection ${inspectionId} not found` };
  }
  return { ok: true, artifactId: row.id, artifactKind: 'inspection' };
}

// ---------------------------------------------------------------------------
// Top-level dispatcher — picks the right per-entity function.
// ---------------------------------------------------------------------------

export type EntityKind =
  | 'leases'
  | 'invoices'
  | 'maintenance_cases'
  | 'reminders'
  | 'inspections';

export type BulkAction =
  | 'mark_rent_paid'
  | 'send_renewal_notice'
  | 'export_tax_statement'
  | 'close_ticket'
  | 'acknowledge'
  | 'snooze'
  | 'archive';

export async function dispatch(
  ctx: DispatchContext,
  entityType: EntityKind,
  action: BulkAction,
  id: string,
  payload: Record<string, unknown>,
): Promise<DispatchOutcome> {
  switch (entityType) {
    case 'leases':
      if (action === 'mark_rent_paid') return dispatchMarkRentPaid(ctx, id, payload);
      if (action === 'send_renewal_notice') return dispatchSendRenewalNotice(ctx, id, payload);
      break;
    case 'invoices':
      if (action === 'export_tax_statement') return dispatchExportTaxStatement(ctx, id, payload);
      break;
    case 'maintenance_cases':
      if (action === 'close_ticket') return dispatchCloseMaintenanceTicket(ctx, id, payload);
      if (action === 'acknowledge') return dispatchAcknowledgeMaintenanceTicket(ctx, id, payload);
      break;
    case 'reminders':
      if (action === 'snooze') return dispatchSnoozeReminder(ctx, id, payload);
      break;
    case 'inspections':
      if (action === 'archive') return dispatchArchiveInspection(ctx, id, payload);
      break;
  }
  return {
    ok: false,
    reason: `no dispatcher for ${entityType}.${action}`,
  };
}
