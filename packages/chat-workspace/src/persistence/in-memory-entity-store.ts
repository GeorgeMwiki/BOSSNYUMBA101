/**
 * In-memory adapter for the {@link EntityStorePort} contract.
 *
 * Used by tests, Storybook, and the offline-replay path. All writes
 * are immutable — returning a new state map rather than mutating in
 * place. This keeps it cheap to snapshot for time-travel debugging.
 *
 * Search is delegated to `./search.ts` to keep this file under the
 * 250-line guardrail.
 */

import type {
  Block,
  BlackboardInteractionEvent,
  PinnedBlackboardItem,
  Provenance,
  Turn,
} from '../types';
import type {
  EntityRecord,
  EntityStorePort,
  EntityType,
  SearchQuery,
} from './entity-store-port';
import { searchSnapshot, type TenantSnapshot } from './search';

const EMPTY_TENANT: TenantSnapshot = {
  turns: new Map(),
  blocks: new Map(),
  interactions: new Map(),
  pins: new Map(),
};

function clone<T>(map: ReadonlyMap<string, T>, id: string, value: T): Map<string, T> {
  const next = new Map(map);
  next.set(id, value);
  return next;
}

function dropKey<T>(map: ReadonlyMap<string, T>, id: string): Map<string, T> {
  const next = new Map(map);
  next.delete(id);
  return next;
}

function timestamp(): string {
  return new Date().toISOString();
}

function compareCreatedAt(
  a: { readonly createdAt: string },
  b: { readonly createdAt: string },
): number {
  if (a.createdAt < b.createdAt) return -1;
  if (a.createdAt > b.createdAt) return 1;
  return 0;
}

export function createInMemoryEntityStore(): EntityStorePort & {
  readonly snapshot: () => ReadonlyMap<string, TenantSnapshot>;
  readonly reset: () => void;
} {
  let tenants: ReadonlyMap<string, TenantSnapshot> = new Map();

  const getTenant = (tenantId: string): TenantSnapshot =>
    tenants.get(tenantId) ?? EMPTY_TENANT;

  const writeTenant = (tenantId: string, next: TenantSnapshot): void => {
    const updated = new Map(tenants);
    updated.set(tenantId, next);
    tenants = updated;
  };

  const buildRecord = <T>(
    entityType: EntityType,
    id: string,
    tenantId: string,
    conversationId: string,
    payload: T,
    provenance: Provenance,
  ): EntityRecord<T> => ({
    entityType,
    id,
    tenantId,
    conversationId,
    payload,
    provenance,
    createdAt: timestamp(),
  });

  return {
    async putTurn(tenantId, conversationId, turn) {
      const state = getTenant(tenantId);
      const provenance: Provenance = {
        conversationId,
        turnId: turn.id,
        blockId: '',
        llmInferred: turn.role === 'md',
        ownerCorrected: false,
        timestamp: turn.timestamp,
      };
      const record = buildRecord<Turn>(
        'conversation_turn',
        turn.id,
        tenantId,
        conversationId,
        turn,
        provenance,
      );
      writeTenant(tenantId, { ...state, turns: clone(state.turns, turn.id, record) });
    },

    async putBlock(tenantId, conversationId, turnId, block: Block, provenance) {
      const state = getTenant(tenantId);
      const record = buildRecord<Block>(
        'conversation_block',
        block.id,
        tenantId,
        conversationId,
        block,
        { ...provenance, turnId, blockId: block.id },
      );
      writeTenant(tenantId, {
        ...state,
        blocks: clone(state.blocks, block.id, record),
      });
    },

    async putInteraction(tenantId, event: BlackboardInteractionEvent) {
      const state = getTenant(tenantId);
      const provenance: Provenance = {
        conversationId: event.context.conversationId,
        turnId: event.context.turnId,
        blockId: event.context.blockId,
        originatingPartKind: event.context.originatingPartKind,
        llmInferred: false,
        ownerCorrected: true,
        timestamp: event.occurredAt,
      };
      const record = buildRecord<BlackboardInteractionEvent>(
        'conversation_interaction',
        event.id,
        tenantId,
        event.context.conversationId,
        event,
        provenance,
      );
      writeTenant(tenantId, {
        ...state,
        interactions: clone(state.interactions, event.id, record),
      });
    },

    async putPin(tenantId, pin: PinnedBlackboardItem) {
      const state = getTenant(tenantId);
      const provenance: Provenance = {
        conversationId: pin.conversationId,
        turnId: pin.sourceTurnId,
        blockId: pin.sourceBlockId,
        originatingPartKind: pin.part.kind,
        llmInferred: false,
        ownerCorrected: false,
        timestamp: pin.pinnedAt,
      };
      const record = buildRecord<PinnedBlackboardItem>(
        'pinned_blackboard_item',
        pin.id,
        tenantId,
        pin.conversationId,
        pin,
        provenance,
      );
      writeTenant(tenantId, { ...state, pins: clone(state.pins, pin.id, record) });
    },

    async removePin(tenantId, pinId) {
      const state = getTenant(tenantId);
      writeTenant(tenantId, { ...state, pins: dropKey(state.pins, pinId) });
    },

    async listPins(tenantId, conversationId) {
      const state = getTenant(tenantId);
      const out: EntityRecord<PinnedBlackboardItem>[] = [];
      for (const record of state.pins.values()) {
        if (record.conversationId === conversationId) {
          out.push(record);
        }
      }
      out.sort(compareCreatedAt);
      return out;
    },

    async listTurns(tenantId, conversationId) {
      const state = getTenant(tenantId);
      const out: EntityRecord<Turn>[] = [];
      for (const record of state.turns.values()) {
        if (record.conversationId === conversationId) {
          out.push(record);
        }
      }
      out.sort(compareCreatedAt);
      return out;
    },

    async search(tenantId, query: SearchQuery) {
      return searchSnapshot(getTenant(tenantId), query);
    },

    snapshot() {
      return tenants;
    },

    reset() {
      tenants = new Map();
    },
  };
}
