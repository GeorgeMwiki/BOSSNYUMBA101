/**
 * Adapter contract shared by all LPMS ingestion implementations.
 *
 * WHY a single interface: the api-gateway migration router should not
 * care whether a legacy export arrived as CSV, JSON, or XML — it should
 * ask any adapter to `parse(input, options)` and receive an
 * `LpmsIngestionResult`. This mirrors the Repository pattern from the
 * project's global coding guidelines: one interface, swappable impls.
 */

import type { LpmsNormalizedExport } from './types.js';

/**
 * Per-call context the host application supplies. `tenantId` is
 * MANDATORY — tenant isolation is a security boundary, never derived
 * from the file itself (the file comes from an untrusted legacy system).
 */
export interface LpmsIngestionContext {
  /** BossNyumba tenant UUID that will own every row produced. */
  tenantId: string;
  /**
   * If true, the adapter skips unparseable rows and surfaces them in
   * `errors`. If false (default, production-safe) the first row error
   * aborts the parse. Matches `WriterOptions.bestEffort` semantics so the
   * pipeline behaves consistently end-to-end.
   */
  bestEffort?: boolean;
}

/**
 * Structured, per-row error. Carrying `entity`, `index`, and `reason`
 * (rather than a single flat string) lets the gateway surface precise
 * feedback to the operator running the migration.
 */
export interface LpmsIngestionError {
  entity: 'property' | 'unit' | 'customer' | 'lease' | 'payment' | 'document';
  index: number;
  reason: string;
  rawKey?: string;
}

export interface LpmsIngestionResult {
  ok: boolean;
  data: LpmsNormalizedExport;
  errors: LpmsIngestionError[];
  /** Counts by entity for quick logging. Never undefined. */
  counts: {
    properties: number;
    units: number;
    customers: number;
    leases: number;
    payments: number;
  };
}

export interface LpmsAdapter<TInput = string, TOptions = unknown> {
  /** Vendor-neutral label, useful for logs and the admin UI. */
  readonly kind: 'csv' | 'json' | 'xml';

  /**
   * Transform raw vendor data into the normalized shape.
   *
   * Contract:
   *  - MUST stamp every returned record with `ctx.tenantId` (tenant
   *    isolation — never trust the inbound file).
   *  - MUST validate output via `LpmsNormalizedExportSchema` before
   *    returning (no half-parsed objects escape the boundary).
   *  - MUST NOT mutate `input` or `options`.
   */
  parse(
    input: TInput,
    ctx: LpmsIngestionContext,
    options?: TOptions
  ): LpmsIngestionResult | Promise<LpmsIngestionResult>;
}

/**
 * Thrown when the entire input is structurally broken (e.g. invalid
 * JSON, malformed XML). Row-level problems are reported via `errors[]`
 * instead — this exception is reserved for "we couldn't even start".
 */
export class LpmsParseError extends Error {
  public readonly kind: 'csv' | 'json' | 'xml';
  public override readonly cause?: unknown;

  constructor(
    kind: 'csv' | 'json' | 'xml',
    message: string,
    cause?: unknown
  ) {
    super(`[lpms:${kind}] ${message}`);
    this.name = 'LpmsParseError';
    this.kind = kind;
    this.cause = cause;
  }
}
