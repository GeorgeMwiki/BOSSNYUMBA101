/**
 * PI-A · history · InMemoryHistoryStore — canonical mock + reference
 * implementation. Production wires the Postgres adapter behind the same
 * IHistoryStore interface; tests run against this one.
 *
 * Immutability:
 *  • internal Map is replaced (`new Map(prev)`) on every write
 *  • entries are Object.freeze'd
 *  • returned arrays are frozen copies
 */

import { randomUUID } from 'node:crypto';

import type {
  AttributeHistoryEntry,
  EntitySnapshot,
  HistoryQuery,
  IHistoryStore,
  RecordChangeInput,
} from './types.js';

type TenantEntityKey = string; // `${tenantId}::${entityId}`

function keyOf(tenantId: string, entityId: string): TenantEntityKey {
  return `${tenantId}::${entityId}`;
}

export class InMemoryHistoryStore implements IHistoryStore {
  // Map of (tenant + entity) → frozen array of entries, in insertion order.
  private entries: ReadonlyMap<TenantEntityKey, ReadonlyArray<AttributeHistoryEntry>> = new Map();

  public async recordChange(input: RecordChangeInput): Promise<AttributeHistoryEntry> {
    if (!input.tenantId || !input.entityId || !input.attributeKey) {
      throw new Error('recordChange: tenantId, entityId, attributeKey are required');
    }
    if (Number.isNaN(Date.parse(input.observedAt))) {
      throw new Error('recordChange: observedAt must be ISO-8601 parseable');
    }
    const entry: AttributeHistoryEntry = Object.freeze({
      id: randomUUID(),
      tenantId: input.tenantId,
      entityId: input.entityId,
      entityKind: input.entityKind,
      attributeKey: input.attributeKey,
      fromValue: input.fromValue,
      toValue: input.toValue,
      actor: Object.freeze({ ...input.actor }),
      reason: input.reason,
      source: Object.freeze({ ...input.source }),
      evidence: Object.freeze(input.evidence.map((e) => Object.freeze({ ...e }))),
      observedAt: input.observedAt,
      recordedAt: new Date().toISOString(),
      ...(input.supersedes !== undefined ? { supersedes: input.supersedes } : {}),
    });
    const k = keyOf(input.tenantId, input.entityId);
    const prior = this.entries.get(k) ?? [];
    const next = new Map(this.entries);
    next.set(k, Object.freeze([...prior, entry]));
    this.entries = next;
    return entry;
  }

  public async getHistory(query: HistoryQuery): Promise<ReadonlyArray<AttributeHistoryEntry>> {
    const k = keyOf(query.tenantId, query.entityId);
    const all = this.entries.get(k) ?? [];
    const asOfMs = query.asOf ? Date.parse(query.asOf) : Number.POSITIVE_INFINITY;
    const filtered = all.filter((e) => {
      if (query.attributeKey !== undefined && e.attributeKey !== query.attributeKey) return false;
      if (Date.parse(e.recordedAt) > asOfMs) return false;
      return true;
    });
    return Object.freeze([...filtered]);
  }

  public async replayAsOf(
    tenantId: string,
    entityId: string,
    asOf: string,
  ): Promise<EntitySnapshot> {
    if (Number.isNaN(Date.parse(asOf))) {
      throw new Error('replayAsOf: asOf must be ISO-8601 parseable');
    }
    const k = keyOf(tenantId, entityId);
    const all = this.entries.get(k) ?? [];
    const asOfMs = Date.parse(asOf);
    // Walk chronologically and apply each change in order so the latest
    // toValue per attributeKey wins at the given instant.
    const attributes: Record<string, unknown> = {};
    let entityKind = '';
    for (const e of all) {
      if (Date.parse(e.recordedAt) > asOfMs) break;
      attributes[e.attributeKey] = e.toValue;
      entityKind = e.entityKind;
    }
    return Object.freeze({
      entityId,
      entityKind,
      asOf,
      attributes: Object.freeze({ ...attributes }),
    });
  }
}
