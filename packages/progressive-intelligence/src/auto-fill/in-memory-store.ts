/**
 * PI-A · auto-fill · InMemoryEntityStore + InMemoryEvidencePendingSink
 *
 * Test doubles for IAutoFillEntityStore and IEvidencePendingSink. Production
 * wires a J1 adapter for the entity store and a Postgres adapter for the
 * evidence-pending queue.
 */

import { randomUUID } from 'node:crypto';

import type { ObservationEvent } from '../observations/types.js';
import type { ConfidenceScore } from '../confidence/types.js';

import type { IAutoFillEntityStore, IEvidencePendingSink } from './types.js';

export class InMemoryAutoFillEntityStore implements IAutoFillEntityStore {
  // (tenantId, entityId, attributeKey) → value
  private state: ReadonlyMap<string, unknown> = new Map();

  private k(tenantId: string, entityId: string, attributeKey: string): string {
    return `${tenantId}::${entityId}::${attributeKey}`;
  }

  public async getAttribute(
    tenantId: string,
    entityId: string,
    attributeKey: string,
  ): Promise<unknown | undefined> {
    return this.state.get(this.k(tenantId, entityId, attributeKey));
  }

  public async setAttribute(
    tenantId: string,
    entityId: string,
    attributeKey: string,
    value: unknown,
  ): Promise<void> {
    const next = new Map(this.state);
    next.set(this.k(tenantId, entityId, attributeKey), value);
    this.state = next;
  }

  /** Test-only convenience. */
  public async _seed(tenantId: string, entityId: string, attributeKey: string, value: unknown): Promise<void> {
    return this.setAttribute(tenantId, entityId, attributeKey, value);
  }
}

export interface PendingEntry {
  readonly id: string;
  readonly observation: ObservationEvent;
  readonly confidence: ConfidenceScore;
  readonly enqueuedAt: string;
}

export class InMemoryEvidencePendingSink implements IEvidencePendingSink {
  private entries: ReadonlyArray<PendingEntry> = [];

  public async enqueue(observation: ObservationEvent, confidence: ConfidenceScore): Promise<string> {
    const id = randomUUID();
    const entry: PendingEntry = Object.freeze({
      id,
      observation,
      confidence,
      enqueuedAt: new Date().toISOString(),
    });
    this.entries = Object.freeze([...this.entries, entry]);
    return id;
  }

  public list(): ReadonlyArray<PendingEntry> {
    return this.entries;
  }
}
