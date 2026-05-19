/**
 * In-memory `RetrievalDriver` for tests + local dev.
 *
 * Strictly enforces per-tenant namespacing — even if test setup leaks
 * tenant ids, `searchTenant` cannot return hits from other tenants.
 * `searchAllTenants` flattens across all namespaces.
 *
 * Production drivers (pgvector, Qdrant, Pinecone) follow the same
 * contract.
 */

import type { Citation, Principal } from '../types.js';
import type {
  RetrievalDriver,
  RetrievalHit,
  RetrievalQuery,
} from './types.js';

export interface InMemoryEntity {
  readonly tenantId: string;
  readonly entityId: string;
  readonly entityKind: string;
  readonly text: string;
  readonly citation: Citation;
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface InMemoryDriver extends RetrievalDriver {
  /** Add one entity to a tenant namespace. Returns a NEW driver state. */
  upsert(entity: InMemoryEntity): void;
  /** For tests. */
  size(): number;
}

export function createInMemoryDriver(
  scoreFn: (q: RetrievalQuery, e: InMemoryEntity) => number = defaultScoreFn,
): InMemoryDriver {
  // Map of tenantId -> entityId -> entity.
  // Internal mutation only; external reads return ReadonlyArrays.
  const store = new Map<string, Map<string, InMemoryEntity>>();

  function upsert(entity: InMemoryEntity): void {
    const ns = store.get(entity.tenantId) ?? new Map<string, InMemoryEntity>();
    ns.set(entity.entityId, entity);
    store.set(entity.tenantId, ns);
  }

  function size(): number {
    let n = 0;
    for (const ns of store.values()) n += ns.size;
    return n;
  }

  async function searchTenant(args: {
    readonly tenantId: string;
    readonly query: RetrievalQuery;
    readonly scopeFilters?: Principal['scopeFilters'];
  }): Promise<ReadonlyArray<RetrievalHit>> {
    const ns = store.get(args.tenantId);
    if (!ns) return [];

    const entityKindFilter = args.query.entityKinds;
    const propIds = args.scopeFilters?.propertyIds;
    const unitIds = args.scopeFilters?.unitIds;

    const all = Array.from(ns.values()).filter((e) => {
      if (entityKindFilter && entityKindFilter.length > 0 && !entityKindFilter.includes(e.entityKind)) {
        return false;
      }
      if (propIds && propIds.length > 0) {
        const propId = e.attributes['propertyId'];
        if (typeof propId !== 'string' || !propIds.includes(propId)) return false;
      }
      if (unitIds && unitIds.length > 0) {
        const unitId = e.attributes['unitId'];
        if (typeof unitId !== 'string' || !unitIds.includes(unitId)) return false;
      }
      return true;
    });

    return rankAndCap(all, args.query, scoreFn);
  }

  async function searchAllTenants(args: {
    readonly query: RetrievalQuery;
  }): Promise<ReadonlyArray<RetrievalHit>> {
    const all: InMemoryEntity[] = [];
    for (const ns of store.values()) {
      for (const e of ns.values()) {
        if (args.query.entityKinds && args.query.entityKinds.length > 0) {
          if (!args.query.entityKinds.includes(e.entityKind)) continue;
        }
        all.push(e);
      }
    }
    return rankAndCap(all, args.query, scoreFn);
  }

  return { upsert, size, searchTenant, searchAllTenants };
}

function rankAndCap(
  entities: ReadonlyArray<InMemoryEntity>,
  query: RetrievalQuery,
  scoreFn: (q: RetrievalQuery, e: InMemoryEntity) => number,
): ReadonlyArray<RetrievalHit> {
  const scored = entities.map((e) => ({ e, score: scoreFn(query, e) }));
  scored.sort((a, b) => b.score - a.score);
  const topK = query.topK ?? 20;
  return scored.slice(0, topK).map(({ e, score }) => ({
    entityId: e.entityId,
    entityKind: e.entityKind,
    tenantId: e.tenantId,
    text: e.text,
    score,
    citation: e.citation,
    attributes: e.attributes,
  }));
}

/**
 * A simple bag-of-words score: count of distinct query tokens present
 * in the entity text + lowercase, divided by token-count of the query.
 * For tests / fixtures only — production drivers use real embeddings.
 */
function defaultScoreFn(q: RetrievalQuery, e: InMemoryEntity): number {
  const text = e.text.toLowerCase();
  const tokens = tokenize(q.text.toLowerCase());
  if (tokens.length === 0) return 0;
  let hits = 0;
  for (const t of tokens) {
    if (text.includes(t)) hits += 1;
  }
  return hits / tokens.length;
}

function tokenize(s: string): ReadonlyArray<string> {
  return s
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}
