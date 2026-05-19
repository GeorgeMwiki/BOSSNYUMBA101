/**
 * PI-A · history — append-only per-(entity, attribute) change log.
 *
 * Every applied change writes a frozen AttributeHistoryEntry. The store is
 * append-only — entries are never modified after creation; corrections are
 * recorded as a new entry that supersedes the prior. The diff is computed
 * client-side at write time so the history alone is sufficient to render
 * change-tracking blocks in chat without re-reading the entity.
 *
 * Companion features (in this module):
 *   getHistory      — chronological + filterable + as-of timestamp
 *   replayAsOf      — Zep-style temporal reconstruction at any past instant;
 *                     pairs with K-D's TemporalKG edge tables for joins
 *   diffSummary     — short human-readable line for chat rendering
 *
 * Persistence: bound to migration 0173_attribute_history.sql which carries
 * tenant-isolation RLS + FORCE + an append-only constraint at the DB layer.
 * This module's interface is storage-agnostic — IHistoryStore — so the in-
 * memory mock and the Postgres adapter share the same surface.
 */

import type { EvidenceRef, ObservationSourceKind } from '../observations/types.js';

export interface ChangeActor {
  readonly kind: 'owner' | 'employee' | 'agent' | 'system' | 'connector';
  /** Stable identifier (user_id, agent_run_id, connector_run_id). */
  readonly id: string;
  /** Human-readable label for chat. */
  readonly label?: string;
}

export interface ChangeSource {
  readonly kind: ObservationSourceKind;
  readonly ref: string;
}

export interface AttributeHistoryEntry {
  /** Stable per-entry id (uuid-style; client-generated). */
  readonly id: string;
  readonly tenantId: string;
  readonly entityId: string;
  readonly entityKind: string;
  readonly attributeKey: string;
  readonly fromValue: unknown;
  readonly toValue: unknown;
  readonly actor: ChangeActor;
  readonly reason: string;
  readonly source: ChangeSource;
  readonly evidence: ReadonlyArray<EvidenceRef>;
  /** ISO-8601. The instant the change was observed. */
  readonly observedAt: string;
  /** ISO-8601. The instant the change was recorded to history. */
  readonly recordedAt: string;
  /**
   * Optional pointer to the entry this one supersedes (for corrections).
   * The superseded entry is NOT mutated.
   */
  readonly supersedes?: string;
}

export interface RecordChangeInput {
  readonly tenantId: string;
  readonly entityId: string;
  readonly entityKind: string;
  readonly attributeKey: string;
  readonly fromValue: unknown;
  readonly toValue: unknown;
  readonly actor: ChangeActor;
  readonly reason: string;
  readonly source: ChangeSource;
  readonly evidence: ReadonlyArray<EvidenceRef>;
  readonly observedAt: string;
  readonly supersedes?: string;
}

export interface HistoryQuery {
  readonly tenantId: string;
  readonly entityId: string;
  readonly attributeKey?: string;
  /** ISO-8601 instant — return only entries with recordedAt ≤ asOf. */
  readonly asOf?: string;
}

/** Read-only entity state at a past point in time (output of replayAsOf). */
export interface EntitySnapshot {
  readonly entityId: string;
  readonly entityKind: string;
  readonly asOf: string;
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface IHistoryStore {
  recordChange(input: RecordChangeInput): Promise<AttributeHistoryEntry>;
  getHistory(query: HistoryQuery): Promise<ReadonlyArray<AttributeHistoryEntry>>;
  replayAsOf(tenantId: string, entityId: string, asOf: string): Promise<EntitySnapshot>;
}
