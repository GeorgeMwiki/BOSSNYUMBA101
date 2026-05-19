/**
 * TemporalKG — persistent tier 3 (Zep / Cognee).
 *
 * Knowledge graph with time-validity columns on every edge. Supports:
 *   - upsertNode(node)
 *   - addFact(edge)                   — current fact (validTo = null)
 *   - invalidateFact(id, reason)      — closes the time window
 *   - queryAsOf(date, filter)         — historical "what did we know at X"
 *   - currentFacts(filter)            — open edges only
 *
 * Storage: in-memory Map for tests + as a reference impl. The Postgres
 * mirror lives in 0170_temporal_kg.sql with identical column semantics.
 *
 * Maps to R3 #2 — three-tier memory, layer 3 (long-term temporal).
 * Domain neutrality: no currency / jurisdiction baked in.
 */

import { randomUUID } from 'node:crypto';

import {
  KGEdgeSchema,
  KGNodeSchema,
  type KGEdge,
  type KGNode,
} from '../types.js';

export interface EdgeQuery {
  readonly subjectId?: string;
  readonly predicate?: string;
  readonly objectId?: string;
  readonly entityType?: string;
}

export interface TemporalKGState {
  readonly nodes: ReadonlyMap<string, KGNode>;
  readonly edges: ReadonlyMap<string, KGEdge>;
}

export function createTemporalKG(): TemporalKGState {
  return Object.freeze({
    nodes: new Map<string, KGNode>(),
    edges: new Map<string, KGEdge>(),
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

function isWithin(at: string, validFrom: string, validTo: string | null): boolean {
  if (at < validFrom) {
    return false;
  }
  if (validTo === null) {
    return true;
  }
  return at < validTo;
}

export function upsertNode(
  state: TemporalKGState,
  node: Omit<KGNode, 'createdAt'> & { readonly createdAt?: string },
): TemporalKGState {
  const candidate: KGNode = {
    ...node,
    createdAt: node.createdAt ?? state.nodes.get(node.id)?.createdAt ?? nowIso(),
  };
  KGNodeSchema.parse(candidate);
  const next = new Map(state.nodes);
  next.set(candidate.id, Object.freeze(candidate));
  return Object.freeze({ nodes: next, edges: state.edges });
}

export interface AddFactInput {
  readonly subjectId: string;
  readonly predicate: string;
  readonly objectId: string;
  readonly properties?: Readonly<Record<string, unknown>>;
  /** Defaults to now; supply for backfill. */
  readonly validFrom?: string;
}

export function addFact(
  state: TemporalKGState,
  fact: AddFactInput,
): TemporalKGState {
  const now = nowIso();
  const candidate: KGEdge = {
    id: randomUUID(),
    subjectId: fact.subjectId,
    predicate: fact.predicate,
    objectId: fact.objectId,
    properties: fact.properties ?? {},
    validFrom: fact.validFrom ?? now,
    validTo: null,
    invalidatedAt: null,
    invalidationReason: null,
    createdAt: now,
  };
  KGEdgeSchema.parse(candidate);
  const next = new Map(state.edges);
  next.set(candidate.id, Object.freeze(candidate));
  return Object.freeze({ nodes: state.nodes, edges: next });
}

export class UnknownFactError extends Error {
  constructor(public readonly factId: string) {
    super(`Unknown fact id: ${factId}`);
    this.name = 'UnknownFactError';
  }
}

export class FactAlreadyInvalidatedError extends Error {
  constructor(public readonly factId: string) {
    super(`Fact "${factId}" is already invalidated`);
    this.name = 'FactAlreadyInvalidatedError';
  }
}

export function invalidateFact(
  state: TemporalKGState,
  factId: string,
  reason: string,
  at: string = nowIso(),
): TemporalKGState {
  const prior = state.edges.get(factId);
  if (!prior) {
    throw new UnknownFactError(factId);
  }
  if (prior.validTo !== null) {
    throw new FactAlreadyInvalidatedError(factId);
  }
  const updated: KGEdge = {
    ...prior,
    validTo: at,
    invalidatedAt: at,
    invalidationReason: reason,
  };
  KGEdgeSchema.parse(updated);
  const next = new Map(state.edges);
  next.set(factId, Object.freeze(updated));
  return Object.freeze({ nodes: state.nodes, edges: next });
}

function matchesQuery(edge: KGEdge, q: EdgeQuery): boolean {
  if (q.subjectId !== undefined && edge.subjectId !== q.subjectId) {
    return false;
  }
  if (q.predicate !== undefined && edge.predicate !== q.predicate) {
    return false;
  }
  if (q.objectId !== undefined && edge.objectId !== q.objectId) {
    return false;
  }
  return true;
}

/** "As of date X, what facts did we know?" — Zep-style historical query. */
export function queryAsOf(
  state: TemporalKGState,
  asOf: string,
  query: EdgeQuery = {},
): readonly KGEdge[] {
  const hits: KGEdge[] = [];
  for (const edge of state.edges.values()) {
    if (!matchesQuery(edge, query)) {
      continue;
    }
    if (!isWithin(asOf, edge.validFrom, edge.validTo)) {
      continue;
    }
    if (query.entityType !== undefined) {
      const subject = state.nodes.get(edge.subjectId);
      if (!subject || subject.entityType !== query.entityType) {
        continue;
      }
    }
    hits.push(edge);
  }
  hits.sort((a, b) => (a.validFrom < b.validFrom ? -1 : 1));
  return Object.freeze(hits);
}

export function currentFacts(
  state: TemporalKGState,
  query: EdgeQuery = {},
): readonly KGEdge[] {
  const hits: KGEdge[] = [];
  for (const edge of state.edges.values()) {
    if (edge.validTo !== null) {
      continue;
    }
    if (!matchesQuery(edge, query)) {
      continue;
    }
    if (query.entityType !== undefined) {
      const subject = state.nodes.get(edge.subjectId);
      if (!subject || subject.entityType !== query.entityType) {
        continue;
      }
    }
    hits.push(edge);
  }
  return Object.freeze(hits);
}
