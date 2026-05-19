/**
 * PI-A · soft-delete · SoftDeleteStore — interface + InMemoryStore.
 *
 * The interface is intentionally narrow so the Postgres adapter (against
 * migration 0174_soft_delete_columns.sql) and the in-memory mock share the
 * same surface. The store is *only* responsible for the soft-delete column
 * triplet — it does not own the underlying entity row's other attributes
 * (those live in the entity store / history).
 *
 * `softDelete()` is idempotent on already-deleted rows: re-issuing the same
 * delete on a deleted entity returns the existing row unmodified (deletedAt
 * is preserved). This matches the soft-delete column semantics in the SQL
 * migration where `deleted_at IS NULL` is the alive predicate.
 */

import { createHash } from 'node:crypto';

import {
  NotDeletedError,
  resolveRetentionDays,
  RetentionExpiredError,
  type PurgeCertificate,
  type SoftDeleteInput,
  type SoftDeleteRow,
  type UndoDeleteInput,
} from './types.js';

export interface ISoftDeleteStore {
  softDelete(input: SoftDeleteInput): Promise<SoftDeleteRow>;
  undoDelete(input: UndoDeleteInput): Promise<SoftDeleteRow>;
  isDeleted(tenantId: string, entityId: string): Promise<boolean>;
  getRow(tenantId: string, entityId: string): Promise<SoftDeleteRow | null>;
  purgeExpired(now?: Date): Promise<ReadonlyArray<PurgeCertificate>>;
}

type Key = string;

function keyOf(tenantId: string, entityId: string): Key {
  return `${tenantId}::${entityId}`;
}

function certHash(row: SoftDeleteRow, purgedAt: string, retentionDays: number): string {
  return createHash('sha256')
    .update(
      [row.tenantId, row.entityId, row.entityKind, row.deletedAt ?? '', purgedAt, retentionDays].join(
        '::',
      ),
    )
    .digest('hex');
}

export class InMemorySoftDeleteStore implements ISoftDeleteStore {
  private rows: ReadonlyMap<Key, SoftDeleteRow> = new Map();
  /**
   * Retention override per (tenant, entity-kind). Populated by adapter from
   * JurisdictionalRules; in-memory mock exposes set() for tests.
   */
  private retentionOverrides: ReadonlyMap<string, number> = new Map();

  public setRetentionOverride(tenantId: string, entityKind: string, days: number): void {
    const next = new Map(this.retentionOverrides);
    next.set(`${tenantId}::${entityKind}`, days);
    this.retentionOverrides = next;
  }

  private retentionFor(tenantId: string, entityKind: string, explicit?: number): number {
    if (typeof explicit === 'number') return resolveRetentionDays(entityKind, explicit);
    const override = this.retentionOverrides.get(`${tenantId}::${entityKind}`);
    return resolveRetentionDays(entityKind, override);
  }

  public async softDelete(input: SoftDeleteInput): Promise<SoftDeleteRow> {
    const k = keyOf(input.tenantId, input.entityId);
    const existing = this.rows.get(k);
    if (existing?.deletedAt != null) {
      // Idempotent: do not overwrite the original deletedAt.
      return existing;
    }
    const row: SoftDeleteRow = Object.freeze({
      tenantId: input.tenantId,
      entityId: input.entityId,
      entityKind: input.entityKind,
      deletedAt: new Date().toISOString(),
      deletedBy: input.actor.id,
      deleteReason: input.reason,
    });
    const next = new Map(this.rows);
    next.set(k, row);
    this.rows = next;
    return row;
  }

  public async undoDelete(input: UndoDeleteInput): Promise<SoftDeleteRow> {
    const k = keyOf(input.tenantId, input.entityId);
    const existing = this.rows.get(k);
    if (!existing || existing.deletedAt == null) {
      throw new NotDeletedError(input.entityId);
    }
    const retentionDays = this.retentionFor(input.tenantId, existing.entityKind);
    const deletedMs = Date.parse(existing.deletedAt);
    const expiresAt = deletedMs + retentionDays * 86_400_000;
    if (Date.now() > expiresAt) {
      throw new RetentionExpiredError(input.entityId, existing.deletedAt, retentionDays);
    }
    const row: SoftDeleteRow = Object.freeze({
      tenantId: existing.tenantId,
      entityId: existing.entityId,
      entityKind: existing.entityKind,
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
    });
    const next = new Map(this.rows);
    next.set(k, row);
    this.rows = next;
    return row;
  }

  public async isDeleted(tenantId: string, entityId: string): Promise<boolean> {
    return this.rows.get(keyOf(tenantId, entityId))?.deletedAt != null;
  }

  public async getRow(tenantId: string, entityId: string): Promise<SoftDeleteRow | null> {
    return this.rows.get(keyOf(tenantId, entityId)) ?? null;
  }

  public async purgeExpired(now: Date = new Date()): Promise<ReadonlyArray<PurgeCertificate>> {
    const purged: PurgeCertificate[] = [];
    const next = new Map(this.rows);
    for (const [k, row] of this.rows) {
      if (row.deletedAt == null) continue;
      const retentionDays = this.retentionFor(row.tenantId, row.entityKind);
      const expiresAt = Date.parse(row.deletedAt) + retentionDays * 86_400_000;
      if (now.getTime() > expiresAt) {
        const purgedAt = now.toISOString();
        purged.push(
          Object.freeze({
            tenantId: row.tenantId,
            entityId: row.entityId,
            entityKind: row.entityKind,
            deletedAt: row.deletedAt,
            purgedAt,
            retentionDays,
            certificateHash: certHash(row, purgedAt, retentionDays),
          }),
        );
        next.delete(k);
      }
    }
    this.rows = next;
    return Object.freeze(purged);
  }
}
