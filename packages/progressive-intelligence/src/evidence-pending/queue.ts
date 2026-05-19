/**
 * PI-A · evidence-pending · EvidencePendingQueue — the in-memory triage
 * queue. Implements both IEvidencePendingSink (so it can be wired as the
 * low-tier sink of auto-fill) and an admin surface (list/approve/reject/
 * requestMore/addCorroboration).
 *
 * Auto-promote: when corroboratingSourceKinds.size ≥
 * AUTO_PROMOTE_SOURCE_KIND_THRESHOLD, the row's status transitions to
 * `auto_promoted` and onAutoPromote() is invoked. The caller wires
 * onAutoPromote to autoFill (with synthesized high-confidence) so the
 * owner gets a receipt as if it had been a single high-confidence
 * observation all along.
 */

import { randomUUID } from 'node:crypto';

import type { ConfidenceScore } from '../confidence/types.js';
import type { ObservationEvent } from '../observations/types.js';
import type { IEvidencePendingSink } from '../auto-fill/types.js';

import {
  AUTO_PROMOTE_SOURCE_KIND_THRESHOLD,
  type EvidencePendingRow,
} from './types.js';

export type AutoPromoteHandler = (row: EvidencePendingRow) => Promise<void>;

export interface EvidencePendingQueueDeps {
  /** Called when a row crosses the 3-source corroboration threshold. */
  readonly onAutoPromote?: AutoPromoteHandler;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export class EvidencePendingQueue implements IEvidencePendingSink {
  private rows: ReadonlyMap<string, EvidencePendingRow> = new Map();
  private readonly deps: EvidencePendingQueueDeps;

  public constructor(deps: EvidencePendingQueueDeps = {}) {
    this.deps = deps;
  }

  public async enqueue(observation: ObservationEvent, confidence: ConfidenceScore): Promise<string> {
    // Coalesce: if there's an OPEN row for the same tenant + entity +
    // attribute + value, treat this as additional corroboration.
    const existing = this.findOpenMatch(observation);
    if (existing) {
      await this.addCorroboration(existing.id, observation);
      return existing.id;
    }
    const id = randomUUID();
    const row: EvidencePendingRow = Object.freeze({
      id,
      tenantId: observation.tenantId,
      entityId: observation.entityId,
      entityKind: observation.entityKind,
      attributeKey: observation.attributeKey,
      proposedValue: observation.observedValue,
      observation,
      confidence,
      corroboratingSourceKinds: Object.freeze(new Set([observation.source.kind])),
      status: 'open',
      enqueuedAt: new Date().toISOString(),
    });
    const next = new Map(this.rows);
    next.set(id, row);
    this.rows = next;
    return id;
  }

  private findOpenMatch(observation: ObservationEvent): EvidencePendingRow | undefined {
    for (const [, r] of this.rows) {
      if (r.status !== 'open') continue;
      if (r.tenantId !== observation.tenantId) continue;
      if (r.entityId !== observation.entityId) continue;
      if (r.attributeKey !== observation.attributeKey) continue;
      if (!deepEqual(r.proposedValue, observation.observedValue)) continue;
      return r;
    }
    return undefined;
  }

  public list(tenantId: string): ReadonlyArray<EvidencePendingRow> {
    const result: EvidencePendingRow[] = [];
    for (const [, r] of this.rows) if (r.tenantId === tenantId) result.push(r);
    return Object.freeze(result);
  }

  public get(id: string): EvidencePendingRow | undefined {
    return this.rows.get(id);
  }

  public async approve(id: string, reason = 'owner approved'): Promise<EvidencePendingRow> {
    return this.transition(id, 'approved', reason);
  }

  public async reject(id: string, reason = 'owner rejected'): Promise<EvidencePendingRow> {
    return this.transition(id, 'rejected', reason);
  }

  public async requestMore(id: string, reason = 'owner requested more evidence'): Promise<EvidencePendingRow> {
    return this.transition(id, 'awaiting_evidence', reason);
  }

  /**
   * Record that another observation confirms a queued one. If the set of
   * independent source kinds crosses the threshold, the row is
   * auto-promoted and onAutoPromote() is invoked.
   */
  public async addCorroboration(id: string, observation: ObservationEvent): Promise<EvidencePendingRow> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`EvidencePendingQueue: row ${id} not found`);
    if (existing.status !== 'open' && existing.status !== 'awaiting_evidence') {
      return existing;
    }
    const kinds = new Set(existing.corroboratingSourceKinds);
    kinds.add(observation.source.kind);
    const willAutoPromote = kinds.size >= AUTO_PROMOTE_SOURCE_KIND_THRESHOLD;
    const next: EvidencePendingRow = Object.freeze({
      ...existing,
      corroboratingSourceKinds: Object.freeze(kinds),
      status: willAutoPromote ? 'auto_promoted' : existing.status,
      ...(willAutoPromote
        ? { resolvedAt: new Date().toISOString(), resolutionReason: 'auto-promoted: 3+ independent sources' }
        : {}),
    });
    const map = new Map(this.rows);
    map.set(id, next);
    this.rows = map;
    if (willAutoPromote && this.deps.onAutoPromote) {
      await this.deps.onAutoPromote(next);
    }
    return next;
  }

  private async transition(
    id: string,
    status: EvidencePendingRow['status'],
    reason: string,
  ): Promise<EvidencePendingRow> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`EvidencePendingQueue: row ${id} not found`);
    const next: EvidencePendingRow = Object.freeze({
      ...existing,
      status,
      resolvedAt: new Date().toISOString(),
      resolutionReason: reason,
    });
    const map = new Map(this.rows);
    map.set(id, next);
    this.rows = map;
    return next;
  }
}
