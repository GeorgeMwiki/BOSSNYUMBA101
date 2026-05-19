/**
 * Persistence + provenance + replay — entity-store port.
 *
 * J9 records every Turn / Block / Interaction / Pin as an entity in
 * J1's entity-store. This port defines the contract; an in-memory
 * adapter sits in `./in-memory-entity-store.ts` for tests and
 * Storybook. The portal will wire a real adapter that hits J1's
 * entity-store HTTP service.
 *
 * Entity types written:
 *   - `conversation_turn`
 *   - `conversation_block`
 *   - `conversation_interaction`
 *   - `pinned_blackboard_item`
 */

import type {
  Block,
  BlackboardInteractionEvent,
  PinnedBlackboardItem,
  Provenance,
  Turn,
} from '../types';

export type EntityType =
  | 'conversation_turn'
  | 'conversation_block'
  | 'conversation_interaction'
  | 'pinned_blackboard_item';

export interface EntityRecord<T = unknown> {
  readonly entityType: EntityType;
  readonly id: string;
  readonly tenantId: string;
  readonly conversationId: string;
  readonly payload: T;
  readonly provenance: Provenance;
  readonly createdAt: string;
}

export interface SearchQuery {
  readonly text?: string;
  readonly conversationId?: string;
  readonly entityType?: EntityType;
  readonly limit?: number;
}

export interface SearchHit<T = unknown> {
  readonly record: EntityRecord<T>;
  /** 0-1, monotonic in match quality. */
  readonly score: number;
  /** Optional highlighted snippet (HTML-safe). */
  readonly snippet?: string;
}

export interface EntityStorePort {
  readonly putTurn: (
    tenantId: string,
    conversationId: string,
    turn: Turn,
  ) => Promise<void>;
  readonly putBlock: (
    tenantId: string,
    conversationId: string,
    turnId: string,
    block: Block,
    provenance: Provenance,
  ) => Promise<void>;
  readonly putInteraction: (
    tenantId: string,
    event: BlackboardInteractionEvent,
  ) => Promise<void>;
  readonly putPin: (
    tenantId: string,
    pin: PinnedBlackboardItem,
  ) => Promise<void>;
  readonly removePin: (tenantId: string, pinId: string) => Promise<void>;
  readonly listPins: (
    tenantId: string,
    conversationId: string,
  ) => Promise<ReadonlyArray<EntityRecord<PinnedBlackboardItem>>>;
  readonly listTurns: (
    tenantId: string,
    conversationId: string,
  ) => Promise<ReadonlyArray<EntityRecord<Turn>>>;
  readonly search: (
    tenantId: string,
    query: SearchQuery,
  ) => Promise<ReadonlyArray<SearchHit>>;
}
