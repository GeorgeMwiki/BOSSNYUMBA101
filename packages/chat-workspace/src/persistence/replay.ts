/**
 * Replay — rebuild the timeline + blackboard state from the
 * entity-store.
 *
 * Opening an old conversation lands here: we pull every
 * `conversation_turn` for the conversation, sort by createdAt, then
 * hand the resulting `Turn[]` to `<ChatTimeline>`. Pins come from a
 * separate `listPins` call. Interactions are NOT replayed visually —
 * they live as audit history accessible via `entityStore.search`.
 */

import type { PinnedBlackboardItem, Turn } from '../types';
import type { EntityStorePort } from './entity-store-port';

export interface ReplaySnapshot {
  readonly conversationId: string;
  readonly turns: ReadonlyArray<Turn>;
  readonly pinned: ReadonlyArray<PinnedBlackboardItem>;
}

export async function replayConversation(
  store: EntityStorePort,
  tenantId: string,
  conversationId: string,
): Promise<ReplaySnapshot> {
  const [turnRecords, pinRecords] = await Promise.all([
    store.listTurns(tenantId, conversationId),
    store.listPins(tenantId, conversationId),
  ]);

  const turns = turnRecords.map((r) => r.payload);
  const pinned = pinRecords.map((r) => r.payload);
  return { conversationId, turns, pinned };
}
