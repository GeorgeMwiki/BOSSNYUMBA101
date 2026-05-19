/**
 * In-memory `ReceiptStorePort` — used for tests + dev. Production
 * wraps the J1 entity-store and writes `research_session` entities
 * (re-uses K-B's receipt-store-as-J1 pattern).
 *
 * Searchable surface: full-text over `question` + `tags`, plus date
 * range bounds. Matches K-B's search ergonomics so the UI affordance
 * "show me research I did about vendor X last week" can pass the same
 * params through to either store.
 */

import type {
  ReceiptStorePort,
  ResearchSessionEntity,
  ResearchSessionSearch,
} from '../ports/index.js';

export function createInMemoryReceiptStore(): ReceiptStorePort {
  const entries = new Map<string, ResearchSessionEntity>();

  return {
    recordResearchSession: async (input: ResearchSessionEntity) => {
      entries.set(input.id, input);
      return { id: input.id };
    },
    findResearchSession: async (id: string) => {
      return entries.get(id) ?? null;
    },
    searchResearchSessions: async (input: ResearchSessionSearch) => {
      const limit = input.limit ?? 20;
      const textQuery = (input.textQuery ?? '').toLowerCase().trim();
      const sinceTs = input.since !== undefined ? Date.parse(input.since) : -Infinity;
      const untilTs = input.until !== undefined ? Date.parse(input.until) : Infinity;

      const all = Array.from(entries.values());
      const filtered = all
        .filter((e) => e.tenantId === input.tenantId)
        .filter((e) => {
          const ts = Date.parse(e.startedAt);
          return ts >= sinceTs && ts <= untilTs;
        })
        .filter((e) => {
          if (textQuery.length === 0) {
            return true;
          }
          if (e.question.toLowerCase().includes(textQuery)) {
            return true;
          }
          if (e.tags.some((t) => t.toLowerCase().includes(textQuery))) {
            return true;
          }
          return false;
        });

      // Most-recent first.
      filtered.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
      return Object.freeze(filtered.slice(0, limit));
    },
  };
}
