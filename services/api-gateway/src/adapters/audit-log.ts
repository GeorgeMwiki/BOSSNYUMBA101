// @ts-nocheck
/**
 * Audit Log Adapter
 *
 * Thin adapter over the `audit_events` table in `@bossnyumba/database`.
 * Writes immutable audit entries for authentication, tenant, and data mutations.
 *
 * We avoid modifying the upstream package by performing the insert directly
 * through the `DatabaseClient`.
 */

import { auditEvents } from '@bossnyumba/database';
import type { DatabaseClient } from '@bossnyumba/database';

export type AuditEventType =
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.login'
  | 'user.logout'
  | 'user.password_changed'
  | 'tenant.created'
  | 'tenant.updated'
  | 'tenant.suspended'
  | 'role.assigned'
  | 'role.revoked'
  | 'permission.granted'
  | 'permission.revoked'
  | 'data.accessed'
  | 'data.modified'
  | 'data.exported';

export interface AuditLogInput {
  tenantId: string;
  eventType: AuditEventType;
  action: string;
  description?: string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
  actorType?: 'user' | 'service' | 'system';
  targetType?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Insert an audit event. Errors are swallowed and logged to console so that
 * audit failures never break the main request.
 */
export async function writeAuditEvent(
  db: DatabaseClient | null | undefined,
  input: AuditLogInput
): Promise<void> {
  if (!db) return;

  try {
    await db.insert(auditEvents).values({
      id: newId(),
      tenantId: input.tenantId,
      eventType: input.eventType,
      action: input.action,
      description: input.description ?? null,
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? null,
      actorName: input.actorName ?? null,
      actorType: input.actorType ?? 'user',
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      sessionId: input.sessionId ?? null,
      previousValue: input.previousValue ?? null,
      newValue: input.newValue ?? null,
      metadata: input.metadata ?? {},
      occurredAt: new Date(),
    });
  } catch (err) {
    // Never allow audit failure to propagate. Log and continue.
    // eslint-disable-next-line no-console
    console.error('[audit] failed to write audit event', {
      error: (err as Error)?.message,
      eventType: input.eventType,
      tenantId: input.tenantId,
    });
  }
}
