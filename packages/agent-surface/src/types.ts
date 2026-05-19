/**
 * Shared types for the agent-surface package.
 *
 * Phase K-F closes 4 R2-audit patterns:
 *   - R2 #5  Hebbia-style Matrix       (matrix/)
 *   - R2 #6  Permission-aware retrieval (retrieval/)
 *   - R2 #9  Budget + Time Boxes        (budget/)
 *   - R2 #10 Multi-surface agent        (surface/)
 *
 * NOTE: Immutability is enforced — every exported value type uses `Readonly`,
 * and every list type uses `ReadonlyArray`. State containers return new
 * objects/arrays on mutation; we never mutate in place.
 */

// ──────────────────────────────────────────────────────────────────────
// Principal — the actor making a request
// ──────────────────────────────────────────────────────────────────────

/**
 * The two top-level role classes in BOSSNYUMBA.
 *
 *   - `internal-admin`  Internal BOSSNYUMBA staff. Can opt-in to
 *                       cross-tenant search via an explicit, audited flag.
 *   - `owner-customer`  External owner/manager/tenant on a specific
 *                       tenant. STRICTLY isolated to their tenant.
 */
export type PrincipalKind = 'internal-admin' | 'owner-customer';

export interface Principal {
  readonly principalId: string;
  readonly kind: PrincipalKind;
  /**
   * Tenant the principal belongs to. For `internal-admin` this is the
   * default scope; the principal can override via `crossTenant` retrieval
   * options, which the retrieval pipeline audits.
   */
  readonly tenantId: string;
  /**
   * Optional scope sub-filters. The retrieval layer treats these as
   * mandatory pre-filters — they are applied at the SQL/vector-search
   * layer, never post-hoc.
   */
  readonly scopeFilters?: Readonly<{
    propertyIds?: ReadonlyArray<string>;
    unitIds?: ReadonlyArray<string>;
  }>;
}

// ──────────────────────────────────────────────────────────────────────
// Citation — provenance attached to retrieval results & matrix cells
// ──────────────────────────────────────────────────────────────────────

export interface Citation {
  readonly id: string;
  /** Human-readable label, e.g. "Lease #L-204 page 3" */
  readonly label: string;
  /** Stable URI to the source — file, doc, db row. */
  readonly sourceUri?: string;
  /** Optional pointer inside the source (page, paragraph, row id, etc.) */
  readonly sourceLocator?: string;
  /** From the J1 entity store — the entity id this citation came from. */
  readonly entityId?: string;
  /**
   * Confidence band — `high` means exact match, `medium` means inferred,
   * `low` means LLM-synthesised without direct attribute match.
   */
  readonly confidence?: 'high' | 'medium' | 'low';
}

// ──────────────────────────────────────────────────────────────────────
// Cost units — used by budget/* and matrix/*
// ──────────────────────────────────────────────────────────────────────

/**
 * A single cost line item. `costUsd` is captured in 1/1_000_000 of a
 * dollar (microdollars) at the integer-arithmetic boundary; we surface
 * dollars for display.
 */
export interface CostLine {
  readonly label: string;
  readonly costUsd: number;
  /** Optional token count split for transparency. */
  readonly tokens?: Readonly<{ input: number; output: number; cached: number }>;
  /** Surface-cost integration with K-D prefix cache. */
  readonly cacheHit?: boolean;
}

// ──────────────────────────────────────────────────────────────────────
// Result envelope — every public API returns a Result<T, E>
// ──────────────────────────────────────────────────────────────────────

export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
