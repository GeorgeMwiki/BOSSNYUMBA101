/**
 * In-memory adapters for the Receipt store + sovereign-ledger ports.
 * Reference for tests; production wires the same ports to J1 + the
 * persistent sovereign-action ledger.
 */

import type {
  NewReceiptInput,
  ReceiptEntity,
  ReceiptStorePort,
  RollbackLedgerEvent,
  RollbackPayload,
  SovereignLedgerPort,
} from './types.js';

export interface InMemoryReceiptStoreOptions {
  readonly now?: () => Date;
  readonly newId?: () => string;
}

let _counter = 0;
function defaultId(): string {
  _counter += 1;
  return `rcpt_${Date.now()}_${_counter.toString(36)}`;
}

export class InMemoryReceiptStore implements ReceiptStorePort {
  private readonly byId = new Map<string, ReceiptEntity>();
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(opts: InMemoryReceiptStoreOptions = {}) {
    this.now = opts.now ?? (() => new Date());
    this.newId = opts.newId ?? defaultId;
  }

  async putReceipt(input: NewReceiptInput): Promise<ReceiptEntity> {
    const id = this.newId();
    const entity: ReceiptEntity = Object.freeze({
      id,
      type: 'receipt',
      actionId: input.actionId,
      toolName: input.toolName,
      tier: input.tier,
      tenantId: input.tenantId,
      executedBy: input.executedBy,
      executedAt: this.now().toISOString(),
      status: 'applied',
      argsSummary: input.argsSummary,
      affectedEntities: input.affectedEntities,
      references: input.references,
      rollbackToken: input.rollbackToken,
      rollbackWindowMinutes: input.rollbackWindowMinutes,
    });
    this.byId.set(id, entity);
    return entity;
  }

  async getReceipt(id: string): Promise<ReceiptEntity | null> {
    return this.byId.get(id) ?? null;
  }

  async markRolledBack(
    id: string,
    rolledBackBy: string,
    rolledBackAt: string,
  ): Promise<ReceiptEntity> {
    const current = this.byId.get(id);
    if (!current) {
      throw new Error(`InMemoryReceiptStore: receipt not found: ${id}`);
    }
    const updated: ReceiptEntity = Object.freeze({
      ...current,
      status: 'rolled-back',
      rolledBackAt,
      rolledBackBy,
    });
    this.byId.set(id, updated);
    return updated;
  }
}

export class InMemorySovereignLedger implements SovereignLedgerPort {
  private readonly rollbacks = new Map<string, RollbackPayload>();
  readonly events: RollbackLedgerEvent[] = [];

  setRollbackPayload(payload: RollbackPayload): void {
    this.rollbacks.set(payload.actionId, payload);
  }

  async fetchRollbackPayload(actionId: string): Promise<RollbackPayload | null> {
    return this.rollbacks.get(actionId) ?? null;
  }

  async appendRollbackEvent(event: RollbackLedgerEvent): Promise<void> {
    this.events.push(event);
  }
}
