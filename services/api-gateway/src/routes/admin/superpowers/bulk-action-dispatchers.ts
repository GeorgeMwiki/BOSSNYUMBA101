/**
 * Admin superpower per-(entityType, action) dispatchers — closes R2
 * blocker #7.
 *
 * The /api/v1/admin/superpowers/{bulk-action,approve/:journalId} routes
 * used to ONLY flip a status flag on the journal / pending-approval rows;
 * they never DISPATCHED the underlying cross-tenant side-effect. An admin
 * who "suspended tenant Acme" or "force-reset a user's password" got an
 * applied/approved status while nothing actually fired — a born-dark
 * superpower.
 *
 * This module mirrors the owner-side dispatcher
 * (services/api-gateway/src/routes/owner/superpowers/
 * bulk-action-dispatchers.ts): a per-(entityType, action) registry whose
 * functions FIRE the real effect. MEDIUM-tier verbs fire inside
 * POST /bulk-action right after the journal insert; HIGH / sovereign verbs
 * fire inside POST /approve/:journalId right after the four-eye flip.
 *
 * WHY event_outbox (vs direct UPDATE):
 *   Admin verbs act ACROSS tenants. The admin's own request runs under the
 *   admin's tenant GUC, so a direct UPDATE on the TARGET tenant's rows
 *   would be RLS-blocked (or silently zero-match). The transactional
 *   outbox is the platform's canonical seam for cross-tenant, worker-
 *   applied effects (the outbox worker drains under the right context and
 *   publishes to subscribers). The same pattern the owner dispatcher uses
 *   for send_renewal_notice / export_tax_statement. Each row is the
 *   durable record of the side-effect AND the actuation trigger; the
 *   targetTenantId scopes the event so the downstream processor applies it
 *   in the correct tenant context.
 *
 * Hard rules respected:
 *   - Drizzle ORM only.
 *   - No direct ledger writes; no fabricated effects.
 *   - Every row carries the proposing/approving actor + reason for the
 *     hash-chained audit trail.
 *   - Errors per row are caught by the caller; this module returns a
 *     typed DispatchOutcome so the route can build a per-row manifest.
 */

import { randomUUID } from 'node:crypto';

import {
  createDatabaseClient,
  eventOutbox,
  withServiceRoleContext,
} from '@bossnyumba/database';

// Locally-derived alias to avoid TS2709 namespace drift on the
// barrel-exported `DatabaseClient`. Same pattern as the owner dispatcher.
type DatabaseClient = ReturnType<typeof createDatabaseClient>;

/** Result of dispatching a single admin (entity, id, action) tuple. */
export interface AdminDispatchOutcome {
  readonly ok: boolean;
  readonly reason?: string;
  /** Outbox row id the effect was enqueued under. */
  readonly artifactId?: string;
  readonly artifactKind?: string;
}

export interface AdminDispatchContext {
  readonly db: DatabaseClient;
  /** The admin's own tenant scope (where the journal row lives). */
  readonly actorTenantId: string;
  readonly actorId: string;
  readonly actorRole: string;
  /**
   * The TARGET tenant the effect applies to. Scopes the outbox row so the
   * downstream worker applies it in the right tenant context. NULL for
   * cross-tenant broadcasts (e.g. bulk_send_announcement to all operators).
   */
  readonly targetTenantId: string | null;
  readonly reason: string;
  readonly idempotencyKey: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function genId(prefix: string): string {
  const slug = randomUUID().replace(/-/g, '').slice(0, 8);
  return `${prefix}_${Date.now()}_${slug}`;
}

/**
 * The single actuation primitive: enqueue a typed event_outbox row. The
 * outbox worker drains it and publishes to subscribers. This is the same
 * worker-applied seam the owner dispatcher uses.
 */
async function enqueueOutbox(
  ctx: AdminDispatchContext,
  args: {
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    payload: Record<string, unknown>;
    priority?: 'low' | 'normal' | 'high' | 'critical';
  },
): Promise<AdminDispatchOutcome> {
  const outboxId = genId('admin_outbox');
  // CROSS-TENANT WRITE: this row is scoped to the TARGET tenant (or NULL for
  // a platform-wide broadcast), NOT the acting admin's tenant. The admin's
  // request runs under the admin's own `app.current_tenant_id` GUC, so a bare
  // insert hits the FORCE-RLS `event_outbox_tenant_isolation` policy
  // (tenant_id = app.current_tenant_id) and is REJECTED for any cross-tenant
  // target — the journal would say 'applied' while nothing was enqueued
  // (born-dark, #29). We bind `app.is_service_role='true'` via
  // withServiceRoleContext so the 0344 `event_outbox_service_role_bypass`
  // policy passes the WITH CHECK and the actuation row is durably written.
  await withServiceRoleContext(ctx.db, async (tx) =>
    tx.insert(eventOutbox).values({
      id: outboxId,
      // Scope the row to the TARGET tenant so the downstream processor
      // applies the effect in the correct tenant context. NULL = platform-
      // wide broadcast (e.g. operator announcement).
      tenantId: ctx.targetTenantId,
      eventType: args.eventType,
      aggregateType: args.aggregateType,
      aggregateId: args.aggregateId,
      payload: {
        ...args.payload,
        reason: ctx.reason,
      },
      metadata: {
        surface: 'admin-platform-portal',
        actorId: ctx.actorId,
        actorRole: ctx.actorRole,
        actorTenantId: ctx.actorTenantId,
        targetTenantId: ctx.targetTenantId,
        adminAction: true,
        ...(ctx.idempotencyKey ? { idempotencyKey: ctx.idempotencyKey } : {}),
      },
      sequenceNumber: Date.now(),
      priority: args.priority ?? 'high',
      correlationId: ctx.idempotencyKey ?? outboxId,
    }),
  );
  return { ok: true, artifactId: outboxId, artifactKind: 'outbox' };
}

// ---------------------------------------------------------------------------
// HIGH / sovereign verbs (fired AFTER four-eye approval)
// ---------------------------------------------------------------------------

// tenant_org.suspend_tenant_org — freeze a tenant org.
async function dispatchSuspendTenantOrg(
  ctx: AdminDispatchContext,
  targetId: string,
  payload: Record<string, unknown>,
): Promise<AdminDispatchOutcome> {
  return enqueueOutbox(ctx, {
    eventType: 'admin.tenant_org.suspend',
    aggregateType: 'tenant_org',
    aggregateId: targetId,
    payload: { ...payload, targetTenantId: ctx.targetTenantId ?? targetId },
    priority: 'critical',
  });
}

// tenant_org.reactivate_tenant_org — reverse a prior suspension.
async function dispatchReactivateTenantOrg(
  ctx: AdminDispatchContext,
  targetId: string,
  payload: Record<string, unknown>,
): Promise<AdminDispatchOutcome> {
  return enqueueOutbox(ctx, {
    eventType: 'admin.tenant_org.reactivate',
    aggregateType: 'tenant_org',
    aggregateId: targetId,
    payload: { ...payload, targetTenantId: ctx.targetTenantId ?? targetId },
    priority: 'critical',
  });
}

// tenant_org.export_regulator_pack — full regulator dump for a tenant.
async function dispatchExportRegulatorPack(
  ctx: AdminDispatchContext,
  targetId: string,
  payload: Record<string, unknown>,
): Promise<AdminDispatchOutcome> {
  return enqueueOutbox(ctx, {
    eventType: 'admin.tenant_org.export_regulator_pack',
    aggregateType: 'tenant_org',
    aggregateId: targetId,
    payload: { ...payload, targetTenantId: ctx.targetTenantId ?? targetId },
    priority: 'normal',
  });
}

// lease.force_lease_termination — admin override of a lease.
async function dispatchForceLeaseTermination(
  ctx: AdminDispatchContext,
  targetId: string,
  payload: Record<string, unknown>,
): Promise<AdminDispatchOutcome> {
  return enqueueOutbox(ctx, {
    eventType: 'admin.lease.force_termination',
    aggregateType: 'lease',
    aggregateId: targetId,
    payload,
    priority: 'high',
  });
}

// user.force_password_reset — operator-initiated reset.
async function dispatchForcePasswordReset(
  ctx: AdminDispatchContext,
  targetId: string,
  payload: Record<string, unknown>,
): Promise<AdminDispatchOutcome> {
  return enqueueOutbox(ctx, {
    eventType: 'admin.user.force_password_reset',
    aggregateType: 'user',
    aggregateId: targetId,
    payload,
    priority: 'high',
  });
}

// maintenance_case.bulk_archive_maintenance_cases — mass archive (HIGH >50).
async function dispatchBulkArchiveMaintenanceCases(
  ctx: AdminDispatchContext,
  targetId: string,
  payload: Record<string, unknown>,
): Promise<AdminDispatchOutcome> {
  return enqueueOutbox(ctx, {
    eventType: 'admin.maintenance_case.archive',
    aggregateType: 'maintenance_case',
    aggregateId: targetId,
    payload,
    priority: 'normal',
  });
}

// ---------------------------------------------------------------------------
// MEDIUM verbs (fired inside POST /bulk-action — single actor sufficient)
// ---------------------------------------------------------------------------

// announcement_target.bulk_send_announcement — broadcast to operators.
async function dispatchBulkSendAnnouncement(
  ctx: AdminDispatchContext,
  targetId: string,
  payload: Record<string, unknown>,
): Promise<AdminDispatchOutcome> {
  return enqueueOutbox(ctx, {
    eventType: 'admin.announcement.send',
    aggregateType: 'announcement_target',
    aggregateId: targetId,
    payload,
    priority: 'normal',
  });
}

// invoice.bulk_archive_old_invoices — housekeeping.
async function dispatchBulkArchiveOldInvoices(
  ctx: AdminDispatchContext,
  targetId: string,
  payload: Record<string, unknown>,
): Promise<AdminDispatchOutcome> {
  return enqueueOutbox(ctx, {
    eventType: 'admin.invoice.archive',
    aggregateType: 'invoice',
    aggregateId: targetId,
    payload,
    priority: 'low',
  });
}

// unit.bulk_re_tag_units — taxonomy reorg.
async function dispatchBulkReTagUnits(
  ctx: AdminDispatchContext,
  targetId: string,
  payload: Record<string, unknown>,
): Promise<AdminDispatchOutcome> {
  return enqueueOutbox(ctx, {
    eventType: 'admin.unit.re_tag',
    aggregateType: 'unit',
    aggregateId: targetId,
    payload,
    priority: 'low',
  });
}

// ---------------------------------------------------------------------------
// Registry + top-level dispatcher
// ---------------------------------------------------------------------------

type AdminDispatchFn = (
  ctx: AdminDispatchContext,
  targetId: string,
  payload: Record<string, unknown>,
) => Promise<AdminDispatchOutcome>;

/**
 * Per-(entityType, action) registry. Mirrors the owner dispatcher's switch;
 * a flat keyed map keeps admin and owner consistent while staying explicit.
 */
const ADMIN_DISPATCH_REGISTRY: Readonly<Record<string, AdminDispatchFn>> =
  Object.freeze({
    'tenant_org:suspend_tenant_org': dispatchSuspendTenantOrg,
    'tenant_org:reactivate_tenant_org': dispatchReactivateTenantOrg,
    'tenant_org:export_regulator_pack': dispatchExportRegulatorPack,
    'lease:force_lease_termination': dispatchForceLeaseTermination,
    'user:force_password_reset': dispatchForcePasswordReset,
    'maintenance_case:bulk_archive_maintenance_cases':
      dispatchBulkArchiveMaintenanceCases,
    'announcement_target:bulk_send_announcement': dispatchBulkSendAnnouncement,
    'invoice:bulk_archive_old_invoices': dispatchBulkArchiveOldInvoices,
    'unit:bulk_re_tag_units': dispatchBulkReTagUnits,
  });

/**
 * Fire the real side-effect for one admin (entityType, action, id) tuple.
 * Returns a typed outcome; throws are caught by the route's per-row loop.
 */
export async function dispatchAdmin(
  ctx: AdminDispatchContext,
  entityType: string,
  action: string,
  targetId: string,
  payload: Record<string, unknown>,
): Promise<AdminDispatchOutcome> {
  const fn = ADMIN_DISPATCH_REGISTRY[`${entityType}:${action}`];
  if (!fn) {
    return {
      ok: false,
      reason: `no admin dispatcher for ${entityType}.${action}`,
    };
  }
  return fn(ctx, targetId, payload);
}
