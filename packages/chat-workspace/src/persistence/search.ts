/**
 * Naive text-search over an in-memory tenant snapshot. Used by the
 * in-memory entity-store adapter (`./in-memory-entity-store.ts`) to
 * back the {@link EntityStorePort.search} contract.
 *
 * The real adapter (which hits J1's entity-store HTTP service) uses
 * postgres pg_trgm + tsvector. This file keeps the in-memory adapter
 * lean and lets tests + Storybook run without a backing service.
 */

import type {
  Block,
  BlackboardInteractionEvent,
  PinnedBlackboardItem,
  Turn,
} from '../types';
import type {
  EntityRecord,
  SearchHit,
  SearchQuery,
} from './entity-store-port';

export interface TenantSnapshot {
  readonly turns: ReadonlyMap<string, EntityRecord<Turn>>;
  readonly blocks: ReadonlyMap<string, EntityRecord<Block>>;
  readonly interactions: ReadonlyMap<
    string,
    EntityRecord<BlackboardInteractionEvent>
  >;
  readonly pins: ReadonlyMap<string, EntityRecord<PinnedBlackboardItem>>;
}

export function blockText(block: Block): string {
  switch (block.kind) {
    case 'text':
      return block.markdown;
    case 'genui':
      return block.part.title ?? block.part.kind;
    case 'reference':
      return block.label;
    case 'voice':
      return block.transcript ?? '';
    case 'thinking':
      return block.summary;
    default: {
      const exhaustive: never = block;
      void exhaustive;
      return '';
    }
  }
}

export function searchSnapshot(
  state: TenantSnapshot,
  query: SearchQuery,
): ReadonlyArray<SearchHit> {
  const limit = query.limit ?? 20;
  const lowerText = query.text?.toLowerCase() ?? '';
  const matches: SearchHit[] = [];

  const accept = (record: EntityRecord, haystack: string): void => {
    if (query.conversationId && record.conversationId !== query.conversationId) {
      return;
    }
    if (query.entityType && record.entityType !== query.entityType) {
      return;
    }
    if (!lowerText) {
      matches.push({ record, score: 0.5 });
      return;
    }
    const idx = haystack.toLowerCase().indexOf(lowerText);
    if (idx === -1) {
      return;
    }
    // Boost: earlier match → higher score; bias on entity-type.
    const positional = 1 - idx / Math.max(haystack.length, 1);
    const typeBoost = record.entityType === 'conversation_block' ? 0.15 : 0;
    const score = Math.min(1, 0.5 * positional + 0.4 + typeBoost);
    const snippetStart = Math.max(0, idx - 24);
    const snippetEnd = Math.min(haystack.length, idx + lowerText.length + 24);
    matches.push({
      record,
      score,
      snippet: haystack.slice(snippetStart, snippetEnd),
    });
  };

  for (const record of state.blocks.values()) {
    accept(record, blockText(record.payload));
  }
  for (const record of state.turns.values()) {
    const text = record.payload.blocks.map(blockText).join(' ');
    accept(record, text);
  }
  for (const record of state.interactions.values()) {
    accept(record, record.payload.payload.kind);
  }
  for (const record of state.pins.values()) {
    accept(record, record.payload.note ?? record.payload.part.kind);
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}
