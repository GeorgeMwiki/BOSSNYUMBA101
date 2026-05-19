/**
 * Retrieval types.
 *
 * Permission enforcement happens at retrieval time, not after — the
 * principal's tenantId and scopeFilters are materialised into the
 * underlying SQL/vector predicate so the index physically cannot return
 * out-of-scope rows. We do not "filter the result list" after the fact.
 *
 * Each tenant has an isolated embedding namespace:
 *   `tenants/<tenantId>/embeddings`
 *
 * Cross-tenant access is opt-in for `internal-admin` principals only,
 * via the `crossTenant` flag — and every cross-tenant retrieval emits
 * an audit event (see `audit-log.ts`).
 */

import type { Citation, Principal, Result } from '../types.js';

/**
 * A query input. `text` is the LLM-visible string; `entityKinds` limits
 * the search to specific J1 entity kinds (e.g. only `lease` or only
 * `tenant`).
 */
export interface RetrievalQuery {
  readonly text: string;
  readonly entityKinds?: ReadonlyArray<string>;
  /** Top-K. Default 20, max 200. */
  readonly topK?: number;
}

/**
 * Options modify retrieval behaviour without changing the query itself.
 *
 *   - `crossTenant`  Only honoured for `internal-admin` principals;
 *                     audited unconditionally when present.
 *   - `requireCitations`  Reject the query at validation time if any
 *                          returned hit lacks a citation. Useful for
 *                          legal/notice-drafting flows.
 */
export interface RetrievalOptions {
  readonly crossTenant?: boolean;
  readonly requireCitations?: boolean;
  /** Optional reason string carried into audit log. */
  readonly reason?: string;
}

/**
 * A single retrieved hit. `text` is the snippet; `score` is the vector
 * similarity in [0, 1]; `citation` is the provenance.
 */
export interface RetrievalHit {
  readonly entityId: string;
  readonly entityKind: string;
  /** The tenant the hit belongs to. Always equals principal.tenantId
   *  unless the principal opted in to crossTenant search. */
  readonly tenantId: string;
  readonly text: string;
  readonly score: number;
  readonly citation: Citation;
  /** Echoed-back attributes from the J1 store, lightly typed. */
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface RetrievalResult {
  readonly hits: ReadonlyArray<RetrievalHit>;
  /**
   * Whether this query crossed tenant boundaries. Always present, even
   * when `false` — the caller should never have to guess.
   */
  readonly crossTenant: boolean;
  /** Audit event id for this retrieval. */
  readonly auditId: string;
}

export type RetrievalError =
  | { readonly kind: 'forbidden'; readonly reason: string }
  | { readonly kind: 'invalid-query'; readonly reason: string }
  | { readonly kind: 'no-citations-available'; readonly reason: string }
  | { readonly kind: 'index-unavailable'; readonly reason: string };

export type RetrieveResult = Result<RetrievalResult, RetrievalError>;

/**
 * The underlying physical retrieval driver. We inject it so tests can
 * substitute an in-memory fixture index, and so the prod implementation
 * (pgvector / Qdrant / Pinecone) can swap without touching the
 * permission-enforcement layer.
 */
export interface RetrievalDriver {
  /**
   * Search inside a single tenant namespace. The driver MUST physically
   * isolate by namespace — never trust the caller to filter.
   */
  searchTenant(args: {
    readonly tenantId: string;
    readonly query: RetrievalQuery;
    readonly scopeFilters?: Principal['scopeFilters'];
  }): Promise<ReadonlyArray<RetrievalHit>>;

  /**
   * Search across all tenants. Only invoked when an `internal-admin`
   * principal supplies `crossTenant: true`. Driver MUST embed the
   * source tenant in each hit so audit can trace it.
   */
  searchAllTenants(args: {
    readonly query: RetrievalQuery;
  }): Promise<ReadonlyArray<RetrievalHit>>;
}
