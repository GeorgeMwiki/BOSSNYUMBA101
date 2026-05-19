/**
 * Hebbia-style Matrix types (R2 #5).
 *
 * Rows are units/tenants/properties (selected via `EntitySelector`);
 * columns are questions. Each cell is the LLM's answer for that entity
 * to that question, carrying citations back to source attributes.
 *
 * Cells fill in parallel — bounded by `MatrixConfig.maxParallel` and
 * dispatched in batches so the integration can swap a serial fallback
 * driver for the Anthropic Messages Batches API in production.
 */

import type { Citation, CostLine, Principal, Result } from '../types.js';

/**
 * EntitySelector — ranges over J1's entity store filter (e.g. "all
 * properties in tenant T"). We model the selector explicitly so tests
 * can construct fixtures and so the production J1-store implementation
 * can compile the same shape into its query DSL.
 */
export interface EntitySelector {
  readonly entityKind: string;
  readonly tenantId: string;
  /** Optional id list — if present, restrict to these. */
  readonly entityIds?: ReadonlyArray<string>;
  /** Optional attribute filters — equality only at this level. */
  readonly attributesEq?: Readonly<Record<string, string | number | boolean>>;
  /** Hard cap on rows returned. Default 1000. */
  readonly limit?: number;
}

export interface Question {
  readonly id: string;
  /** Human-readable question prompt. */
  readonly text: string;
  /**
   * Optional answer format hint. The MD passes this to the LLM so
   * cell values come back consistently rendered (currency, percent,
   * date, count, free-text).
   */
  readonly answerFormat?: 'currency' | 'percent' | 'date' | 'count' | 'text';
  /** Optional desired confidence floor — cells below this are flagged. */
  readonly minConfidence?: 'low' | 'medium' | 'high';
}

export interface MatrixQuery {
  readonly rows: EntitySelector;
  readonly columns: ReadonlyArray<Question>;
}

export interface MatrixCell {
  readonly rowId: string;
  readonly columnId: string;
  readonly value: string | number | boolean | null;
  readonly displayValue: string;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly citations: ReadonlyArray<Citation>;
  /** Did this cell fail to compute? Carries error reason if so. */
  readonly errorReason?: string;
  /** Cell-level cost line — sum to total in `MatrixResult.cost`. */
  readonly cost?: CostLine;
}

export interface MatrixRow {
  readonly rowId: string;
  /** Human label, e.g. "Property: Westlands Apartments, Unit 4B". */
  readonly label: string;
  readonly cells: ReadonlyArray<MatrixCell>;
}

export interface MatrixResult {
  readonly query: MatrixQuery;
  readonly rows: ReadonlyArray<MatrixRow>;
  readonly columns: ReadonlyArray<Question>;
  /** Filled cell count / total cell count. */
  readonly filledCells: number;
  readonly totalCells: number;
  /** Total cost & time. */
  readonly cost: ReadonlyArray<CostLine>;
  readonly totalCostUsd: number;
  readonly elapsedMs: number;
}

export type MatrixError =
  | { readonly kind: 'forbidden'; readonly reason: string }
  | { readonly kind: 'invalid-query'; readonly reason: string }
  | { readonly kind: 'partial-failure'; readonly reason: string; readonly result: MatrixResult };

export type RunMatrixResult = Result<MatrixResult, MatrixError>;

// ──────────────────────────────────────────────────────────────────────
// Injectable drivers
// ──────────────────────────────────────────────────────────────────────

/**
 * The J1 entity-store driver — resolves an `EntitySelector` into a
 * concrete list of (entityId, label, attributes) tuples. We isolate
 * this so the in-memory test driver can provide fixtures and the
 * production driver hits J1's API.
 */
export interface EntityStoreDriver {
  resolveEntities(
    selector: EntitySelector,
  ): Promise<
    ReadonlyArray<{
      readonly entityId: string;
      readonly label: string;
      readonly tenantId: string;
      readonly attributes: Readonly<Record<string, unknown>>;
    }>
  >;
}

/**
 * The cell driver — answers one cell. Returns the value + citations +
 * cost. In production this is an Anthropic call routed through the
 * central-intelligence MD; tests substitute a deterministic mock.
 */
export interface CellDriver {
  answerCell(args: {
    readonly entity: {
      readonly entityId: string;
      readonly label: string;
      readonly tenantId: string;
      readonly attributes: Readonly<Record<string, unknown>>;
    };
    readonly question: Question;
    readonly principal: Principal;
  }): Promise<{
    readonly value: string | number | boolean | null;
    readonly displayValue: string;
    readonly confidence: 'low' | 'medium' | 'high';
    readonly citations: ReadonlyArray<Citation>;
    readonly cost?: CostLine;
  }>;
}
