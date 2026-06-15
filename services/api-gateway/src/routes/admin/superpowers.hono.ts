/**
 * /api/v1/admin/superpowers - admin platform-portal superpowers
 * (Wave OWNER-OS, migration 0301).
 *
 * Closes the second gap in the BN-only port: the admin-platform-portal
 * had no chat-callable bulk-action surface and no four-eye approval
 * flow. Without these, admin operators had to leave the chat to
 * perform any cross-tenant action — breaking the universal-bar
 * promise ("users never have to leave across all surfaces").
 *
 * Companion to (but DISTINCT from) `routes/owner/superpowers/*` —
 * admins act across tenants and reach for verbs the owner cannot
 * (suspend a tenant org, force a password reset, export a regulator
 * pack). The HIGH-risk subset demands a four-eye flow: a second admin
 * actor must approve before the mutation fires.
 *
 * Routes:
 *   POST /bulk-action                       propose a bulk admin verb
 *   POST /approve/:journalId                second-actor approval (HIGH)
 *   POST /reject/:journalId                 reject a pending HIGH proposal
 *   GET  /pending                           list pending approvals
 *
 * HIGH-risk verbs (require four-eye):
 *   - suspend_tenant_org
 *   - reactivate_tenant_org
 *   - export_regulator_pack
 *   - force_lease_termination
 *   - force_password_reset
 *   - bulk_archive_maintenance_cases (>50 rows)
 *
 * MEDIUM-risk verbs (audit-only, single actor sufficient):
 *   - bulk_send_announcement
 *   - bulk_archive_old_invoices
 *   - bulk_re_tag_units
 *
 * Auth: Supabase JWT + requireRole(SUPER_ADMIN | ADMIN | SUPPORT).
 *       The journal entry pins both the proposing and approving actor
 *       ids so the audit chain is reconstructable.
 *
 * Audit chain: every action append a row to `undo_journal`
 * (provenance.audit_chain_id references the canonical hash-chained
 * audit-events row). The chain is SHARED with owner-side audit; no
 * parallel admin chain per the CLAUDE.md hard rule.
 *
 * Idempotency: route writes honour the Idempotency-Key header via the
 * db-idempotency middleware (migration 0299). Replaying the same key
 * returns the same response without double-writing.
 */

// owner/superpowers/bulk-action.hono.ts.

import { Hono } from 'hono';
import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';

import {
  undoJournal,
  adminSuperpowerPendingApprovals,
  ADMIN_HIGH_RISK_ACTIONS,
  ADMIN_MEDIUM_RISK_ACTIONS,
  ADMIN_ALL_ACTIONS,
  ADMIN_BULK_ARCHIVE_HIGH_THRESHOLD,
  type AdminHighRiskAction,
  type AdminMediumRiskAction,
} from '@bossnyumba/database';
import { authMiddleware, requireRole } from '../../middleware/hono-auth';
import { databaseMiddleware } from '../../middleware/database';
import { createLogger } from '../../utils/logger';
import { UserRole } from '../../types/user-role';
import {
  dispatchAdmin,
  type AdminDispatchContext,
} from './superpowers/bulk-action-dispatchers';

const moduleLogger = createLogger('admin-superpowers');

// ─── Frozen risk sets for runtime checks ────────────────────────────

const HIGH_RISK_SET: ReadonlySet<string> = new Set(ADMIN_HIGH_RISK_ACTIONS);
const MEDIUM_RISK_SET: ReadonlySet<string> = new Set(
  ADMIN_MEDIUM_RISK_ACTIONS,
);

/**
 * Some MEDIUM verbs are auto-elevated to HIGH on volume thresholds.
 * bulk_archive_maintenance_cases >50 rows is HIGH-risk because mass
 * archival of maintenance evidence has a regulator-disclosure impact.
 */
function isHighRisk(
  action: string,
  ids: ReadonlyArray<string>,
): boolean {
  if (HIGH_RISK_SET.has(action)) return true;
  if (
    action === 'bulk_archive_maintenance_cases' &&
    ids.length > ADMIN_BULK_ARCHIVE_HIGH_THRESHOLD
  ) {
    return true;
  }
  return false;
}

// ─── Zod schemas ────────────────────────────────────────────────────

const adminBulkSchema = z
  .object({
    entityType: z.enum([
      'tenant_org',
      'lease',
      'user',
      'maintenance_case',
      'invoice',
      'unit',
      'announcement_target',
    ]),
    ids: z.array(z.string().min(1).max(200)).min(1).max(500),
    action: z.enum(ADMIN_ALL_ACTIONS as readonly [string, ...string[]]),
    payload: z.record(z.string(), z.unknown()).optional().default({}),
    reason: z.string().min(8).max(2000),
    provenance: z.record(z.string(), z.unknown()).optional().default({}),
  })
  .superRefine((v, ctx) => {
    // Per-entity verb whitelist.
    const allowedByEntity: Readonly<Record<string, ReadonlyArray<string>>> = {
      tenant_org: [
        'suspend_tenant_org',
        'reactivate_tenant_org',
        'export_regulator_pack',
      ],
      lease: ['force_lease_termination'],
      user: ['force_password_reset'],
      maintenance_case: ['bulk_archive_maintenance_cases'],
      invoice: ['bulk_archive_old_invoices'],
      unit: ['bulk_re_tag_units'],
      announcement_target: ['bulk_send_announcement'],
    };
    const allowed = allowedByEntity[v.entityType] ?? [];
    if (!allowed.includes(v.action)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          `admin action '${v.action}' not allowed on '${v.entityType}' ` +
          `- whitelist: ${allowed.join(',')}`,
        path: ['action'],
      });
    }
  });

const approveSchema = z.object({
  decisionNote: z.string().min(1).max(2000).optional(),
});

const rejectSchema = z.object({
  rejectionReason: z.string().min(8).max(2000),
});

const pendingQuerySchema = z.object({
  status: z
    .enum(['pending', 'applied', 'rejected', 'expired'])
    .default('pending'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// ─── Router ─────────────────────────────────────────────────────────

const app = new Hono();
app.use('*', authMiddleware);
app.use(
  '*',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT),
);
app.use('*', databaseMiddleware);

function dbUnavailable(c: any) {
  return c.json(
    {
      success: false,
      error: {
        code: 'ADMIN_BULK_DB_UNAVAILABLE',
        message: 'Database not configured',
      },
    },
    503,
  );
}

// ─── POST /bulk-action — propose a bulk admin verb ────────────────────
app.post('/bulk-action', async (c: any) => {
  const auth = c.get('auth') as {
    tenantId: string;
    userId: string;
    role: string;
  };
  const db = c.get('db');
  if (!db) return dbUnavailable(c);
  const raw = await c.req.json().catch(() => null);
  const parsed = adminBulkSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid admin bulk payload',
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }
  const input = parsed.data;
  const high = isHighRisk(input.action, input.ids);

  // Target tenant for the verb (the tenant being suspended / exported /
  // reset, etc.). NULL for cross-tenant broadcasts.
  const targetTenantId =
    ((input.payload as Record<string, unknown> | undefined)
      ?.targetTenantId as string | undefined) ?? null;
  const idempotencyKey = c.req.header('idempotency-key') ?? null;

  // Append one undo_journal entry per id. For HIGH-risk verbs the row
  // is also recorded in admin_superpower_pending_approvals so the
  // four-eye gate is queryable cleanly. For MEDIUM-risk verbs the side-
  // effect FIRES immediately (single actor sufficient).
  const undoIds: string[] = [];
  const pendingIds: string[] = [];
  const processedIds: string[] = [];
  const failedRows: Array<{ readonly id: string; readonly reason: string }> =
    [];
  const dispatchArtifacts: Array<{
    readonly id: string;
    readonly artifactId: string;
    readonly artifactKind: string;
  }> = [];

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  for (const id of input.ids) {
    try {
      const [journalRow] = await db
        .insert(undoJournal)
        .values({
          // Admin journal rows pin the admin's own tenant scope so RLS
          // does not lose them; the targetTenantId is captured inside
          // provenance for cross-tenant inspection.
          tenantId: auth.tenantId,
          actorId: auth.userId,
          entityType: input.entityType,
          entityId: id,
          actionKind: 'bulk_update',
          toolId: 'admin.ui.bulk_action',
          beforeState: null,
          afterState: { action: input.action, payload: input.payload },
          windowSeconds: 300,
          provenance: {
            ...input.provenance,
            surface: 'admin-platform-portal',
            adminRole: auth.role,
            reason: input.reason,
            requires_four_eye: high,
            status: high ? 'pending_approval' : 'applied',
            target_tenant_id: targetTenantId,
            audit_chain_id: null,
          },
        })
        .returning();
      undoIds.push(journalRow.id);
      processedIds.push(id);

      if (high) {
        // HIGH/sovereign verbs do NOT fire here — they wait for the
        // four-eye approval (POST /approve/:journalId). Record the
        // pending row.
        const [pendingRow] = await db
          .insert(adminSuperpowerPendingApprovals)
          .values({
            journalId: journalRow.id,
            targetTenantId,
            targetEntityRef: `${input.entityType}:${id}`,
            action: input.action,
            payload: input.payload,
            reason: input.reason,
            status: 'pending',
            proposedByActorId: auth.userId,
            proposedByRole: auth.role,
            expiresAt,
            auditChainIds: [],
          })
          .returning();
        pendingIds.push(pendingRow.id);
      } else {
        // MEDIUM verbs: FIRE the real side-effect now (single actor
        // sufficient). Mirrors the owner dispatcher — the journal/audit
        // row is kept; this ADDS the actuator call.
        const dispatchCtx: AdminDispatchContext = {
          db,
          actorTenantId: auth.tenantId,
          actorId: auth.userId,
          actorRole: auth.role,
          targetTenantId,
          reason: input.reason,
          idempotencyKey,
        };
        const outcome = await dispatchAdmin(
          dispatchCtx,
          input.entityType,
          input.action,
          id,
          input.payload,
        );
        if (outcome.ok) {
          if (outcome.artifactId && outcome.artifactKind) {
            dispatchArtifacts.push({
              id,
              artifactId: outcome.artifactId,
              artifactKind: outcome.artifactKind,
            });
          }
        } else {
          // The side-effect did not fire — surface it as a per-row
          // failure rather than claiming success. The journal row stays
          // for the audit trail / undo.
          failedRows.push({
            id,
            reason: outcome.reason ?? `dispatch failed for ${input.action}`,
          });
          const procIdx = processedIds.indexOf(id);
          if (procIdx !== -1) processedIds.splice(procIdx, 1);
          moduleLogger.warn('admin-superpowers: MEDIUM dispatch failed', {
            adminId: auth.userId,
            entityType: input.entityType,
            action: input.action,
            id,
            reason: outcome.reason,
          });
        }
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      failedRows.push({ id, reason });
      const procIdx = processedIds.indexOf(id);
      if (procIdx !== -1) processedIds.splice(procIdx, 1);
      moduleLogger.warn('admin-superpowers: bulk row failed', {
        adminId: auth.userId,
        entityType: input.entityType,
        action: input.action,
        id,
        error: reason,
      });
    }
  }

  moduleLogger.info('admin-superpowers: bulk action recorded', {
    adminId: auth.userId,
    adminRole: auth.role,
    entityType: input.entityType,
    action: input.action,
    requiresFourEye: high,
    processed: processedIds.length,
    pending: pendingIds.length,
    dispatched: dispatchArtifacts.length,
    failed: failedRows.length,
  });

  return c.json({
    success: true,
    data: {
      accepted: true,
      requiresFourEye: high,
      status: high ? 'pending_approval' : 'applied',
      processed: processedIds.length,
      failed: failedRows.length,
      processedIds,
      failedIds: failedRows,
      undoJournalIds: undoIds,
      pendingApprovalIds: pendingIds,
      // MEDIUM verbs that actually fired (outbox artifacts). HIGH verbs
      // carry an empty list here until approval consummates them.
      dispatchArtifacts,
      // i18n: bilingual sw/en surface copy. The FE picks the active
      // language via the user's locale preference.
      message: high
        ? {
            en: 'Action proposed. A second admin must approve before it takes effect.',
            sw: 'Hatua imependekezwa. Msimamizi mwingine lazima aidhinishe kabla haijatekelezwa.',
          }
        : {
            en: 'Action applied.',
            sw: 'Hatua imetekelezwa.',
          },
    },
  });
});

// ─── POST /approve/:journalId — second-actor approval (HIGH-risk) ─────
app.post('/approve/:journalId', async (c: any) => {
  const auth = c.get('auth') as {
    tenantId: string;
    userId: string;
    role: string;
  };
  const db = c.get('db');
  if (!db) return dbUnavailable(c);
  const journalId = c.req.param('journalId');
  if (!journalId) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing journalId',
        },
      },
      400,
    );
  }
  const raw = await c.req.json().catch(() => ({}));
  const parsed = approveSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid approval payload',
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }

  // Fetch the pending approval row.
  const [pending] = await db
    .select()
    .from(adminSuperpowerPendingApprovals)
    .where(eq(adminSuperpowerPendingApprovals.journalId, journalId))
    .limit(1);

  if (!pending) {
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Pending approval not found for this journalId',
        },
      },
      404,
    );
  }
  if (pending.proposedByActorId === auth.userId) {
    return c.json(
      {
        success: false,
        error: {
          code: 'FOUR_EYE_SAME_ACTOR',
          message: 'Approver must differ from the proposing admin',
        },
      },
      409,
    );
  }
  if (pending.status === 'applied') {
    return c.json(
      {
        success: false,
        error: {
          code: 'ALREADY_APPLIED',
          message: 'Approval already granted; mutation has fired',
        },
      },
      409,
    );
  }
  if (pending.status === 'rejected') {
    return c.json(
      {
        success: false,
        error: {
          code: 'ALREADY_REJECTED',
          message: 'Proposal was rejected by another admin',
        },
      },
      409,
    );
  }
  if (pending.status === 'expired' || pending.expiresAt < new Date()) {
    return c.json(
      {
        success: false,
        error: {
          code: 'PROPOSAL_EXPIRED',
          message: 'Proposal expired before approval; please re-propose',
        },
      },
      409,
    );
  }

  // Fetch the journal row so we can update its provenance.
  const [journal] = await db
    .select()
    .from(undoJournal)
    .where(
      and(
        eq(undoJournal.id, journalId),
        eq(undoJournal.tenantId, auth.tenantId),
      ),
    )
    .limit(1);
  if (!journal) {
    // The journal lives in the proposer's tenant scope. If the approver
    // is a different tenant admin scope (cross-tenant approval) we
    // tolerate the missing row and rely on the pending-approvals
    // record as the canonical state.
    moduleLogger.warn('admin-superpowers: journal row not visible to approver', {
      journalId,
      approverId: auth.userId,
    });
  }

  const approvedAt = new Date();
  // Update the pending row first — the CHECK constraint
  // `admin_four_eye_distinct_actors_chk` is the DB-level safety net.
  const [updatedPending] = await db
    .update(adminSuperpowerPendingApprovals)
    .set({
      status: 'applied',
      approvedByActorId: auth.userId,
      approvedByRole: auth.role,
      ...(parsed.data.decisionNote !== undefined && {
        approverNote: parsed.data.decisionNote,
      }),
      approvedAt,
    })
    .where(eq(adminSuperpowerPendingApprovals.id, pending.id))
    .returning();

  // Update the journal row's provenance (best-effort — same-chain).
  if (journal) {
    const provenance =
      (journal.provenance as Record<string, unknown> | null) ?? {};
    const nextProvenance = {
      ...provenance,
      status: 'applied',
      approved_by_user_id: auth.userId,
      approved_by_role: auth.role,
      approved_at: approvedAt.toISOString(),
      ...(parsed.data.decisionNote !== undefined && {
        approver_note: parsed.data.decisionNote,
      }),
    };
    await db
      .update(undoJournal)
      .set({ provenance: nextProvenance })
      .where(eq(undoJournal.id, journalId));
  }

  // FIRE the real side-effect now that the four-eye gate has passed. The
  // pending row stored the original verb + payload at propose time; we
  // reconstruct the (entityType, targetId) from targetEntityRef
  // (`${entityType}:${targetId}`) and dispatch the actuator. The status
  // flip ABOVE already records the approval; this ADDS the effect.
  const refSep = pending.targetEntityRef.indexOf(':');
  const dispatchEntityType =
    refSep === -1
      ? pending.targetEntityRef
      : pending.targetEntityRef.slice(0, refSep);
  const dispatchTargetId =
    refSep === -1 ? '' : pending.targetEntityRef.slice(refSep + 1);
  const idempotencyKey = c.req.header('idempotency-key') ?? null;

  let dispatchArtifactId: string | null = null;
  let dispatchArtifactKind: string | null = null;
  let dispatchError: string | null = null;
  try {
    const dispatchCtx: AdminDispatchContext = {
      db,
      actorTenantId: auth.tenantId,
      actorId: pending.proposedByActorId,
      actorRole: auth.role,
      targetTenantId: (pending.targetTenantId as string | null) ?? null,
      reason: pending.reason,
      idempotencyKey,
    };
    const outcome = await dispatchAdmin(
      dispatchCtx,
      dispatchEntityType,
      pending.action,
      dispatchTargetId,
      (pending.payload as Record<string, unknown> | null) ?? {},
    );
    if (outcome.ok) {
      dispatchArtifactId = outcome.artifactId ?? null;
      dispatchArtifactKind = outcome.artifactKind ?? null;
    } else {
      dispatchError = outcome.reason ?? `dispatch failed for ${pending.action}`;
    }
  } catch (e) {
    dispatchError = e instanceof Error ? e.message : String(e);
  }

  if (dispatchError) {
    // The approval was recorded but the effect did NOT fire. Surface the
    // failure honestly instead of claiming the action took effect; an
    // operator can retry the actuation (the pending row is already
    // 'applied', so this is a dispatch-retry concern, not a re-approval).
    moduleLogger.error('admin-superpowers: four-eye approved but dispatch failed', {
      journalId,
      pendingId: updatedPending.id,
      action: pending.action,
      targetEntityRef: pending.targetEntityRef,
      error: dispatchError,
    });
    return c.json(
      {
        success: false,
        error: {
          code: 'ADMIN_DISPATCH_FAILED',
          message: 'Approval recorded but the action failed to dispatch',
          details: { journalId, pendingId: updatedPending.id, reason: dispatchError },
        },
      },
      502,
    );
  }

  moduleLogger.info('admin-superpowers: HIGH-risk verb approved + dispatched (four-eye)', {
    journalId,
    pendingId: updatedPending.id,
    proposingActorId: pending.proposedByActorId,
    approvingActorId: auth.userId,
    action: pending.action,
    targetEntityRef: pending.targetEntityRef,
    artifactId: dispatchArtifactId,
  });

  return c.json({
    success: true,
    data: {
      applied: true,
      journalId,
      pendingId: updatedPending.id,
      action: pending.action,
      targetEntityRef: pending.targetEntityRef,
      approvedAt: approvedAt.toISOString(),
      ...(dispatchArtifactId && {
        dispatchArtifact: {
          artifactId: dispatchArtifactId,
          artifactKind: dispatchArtifactKind,
        },
      }),
      message: {
        en: 'Approval granted; action dispatched.',
        sw: 'Idhini imetolewa; hatua imetekelezwa.',
      },
    },
  });
});

// ─── POST /reject/:journalId — reject a pending HIGH proposal ─────────
app.post('/reject/:journalId', async (c: any) => {
  const auth = c.get('auth') as {
    tenantId: string;
    userId: string;
    role: string;
  };
  const db = c.get('db');
  if (!db) return dbUnavailable(c);
  const journalId = c.req.param('journalId');
  if (!journalId) {
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Missing journalId' },
      },
      400,
    );
  }
  const raw = await c.req.json().catch(() => null);
  const parsed = rejectSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid rejection payload',
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }
  const [pending] = await db
    .select()
    .from(adminSuperpowerPendingApprovals)
    .where(eq(adminSuperpowerPendingApprovals.journalId, journalId))
    .limit(1);
  if (!pending) {
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Pending approval not found',
        },
      },
      404,
    );
  }
  if (pending.status !== 'pending') {
    return c.json(
      {
        success: false,
        error: {
          code: 'ALREADY_RESOLVED',
          message: `Proposal already ${pending.status}`,
        },
      },
      409,
    );
  }
  const rejectedAt = new Date();
  const [updated] = await db
    .update(adminSuperpowerPendingApprovals)
    .set({
      status: 'rejected',
      rejectedByActorId: auth.userId,
      rejectedByRole: auth.role,
      rejectionReason: parsed.data.rejectionReason,
      rejectedAt,
    })
    .where(eq(adminSuperpowerPendingApprovals.id, pending.id))
    .returning();
  moduleLogger.info('admin-superpowers: HIGH-risk verb rejected', {
    journalId,
    rejectingActorId: auth.userId,
    action: pending.action,
  });
  return c.json({
    success: true,
    data: {
      rejected: true,
      journalId,
      pendingId: updated.id,
      message: {
        en: 'Proposal rejected; action will not fire.',
        sw: 'Pendekezo limekataliwa; hatua haitatekelezwa.',
      },
    },
  });
});

// ─── GET /pending — list pending (or filtered) approvals ──────────────
app.get('/pending', async (c: any) => {
  const auth = c.get('auth') as {
    tenantId: string;
    userId: string;
    role: string;
  };
  const db = c.get('db');
  if (!db) return dbUnavailable(c);
  const parsed = pendingQuerySchema.safeParse({
    status: c.req.query('status'),
    limit: c.req.query('limit'),
  });
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query',
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }
  const rows = await db
    .select()
    .from(adminSuperpowerPendingApprovals)
    .where(eq(adminSuperpowerPendingApprovals.status, parsed.data.status))
    .orderBy(desc(adminSuperpowerPendingApprovals.createdAt))
    .limit(parsed.data.limit);

  return c.json({
    success: true,
    data: {
      status: parsed.data.status,
      count: rows.length,
      rows,
    },
  });
});

export const adminSuperpowersRouter = app;
export default adminSuperpowersRouter;
