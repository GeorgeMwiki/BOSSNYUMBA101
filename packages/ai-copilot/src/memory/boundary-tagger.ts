/**
 * Boundary-tagger — Chinese-wall filter for the PersonLayer.
 *
 * Companion to migration 0296 (`packages/database/src/schemas/personal-
 * memory.schema.ts`) and `./person-layer.ts`. Ported from Borjie's PKB
 * design — same algorithm, BN-named entities (landlord / estate-manager
 * / accountant / renter across tenants).
 *
 * The brain orchestrator UNION-ALLs `personal_memory_cells` rows with
 * the active-tenant cells. Person rows carry a `source_tenant_id`
 * provenance field — when that value differs from the active tenant we
 * are about to cross an organizational boundary. The Chinese-wall
 * separation principle from broker-dealer compliance (FINRA 91-45) says
 * counts and existence-claims may cross the wall; specific numbers and
 * specific decisions may NOT.
 *
 * This module is **pure**: no I/O, no clock reads, no hidden state.
 * `enforceChineseWall` returns a verdict (allowed + blocked buckets).
 * `assertChineseWall` is the FAIL-LOUD variant that throws
 * `PersonalKbBoundaryViolation` if any cross-tenant numeric cell is
 * present — the brain orchestrator calls this BEFORE composing the
 * prompt so a leak cannot reach the LLM.
 *
 * Hard rules from BN CLAUDE.md that bind this module:
 *   - "RLS is FORCE-enabled on every tenant-scoped table" — but
 *     `personal_memory_cells` is FEDERATED (NO RLS by design). The wall
 *     replaces RLS for this single table; everywhere else RLS governs.
 *   - "AI audit chain is hash-chained, append-only" — `BoundaryTags`
 *     output is consumed by the audit-chain emitter so every denial
 *     reason is recorded.
 *   - "Pino logger only — it handles redaction" — `PersonalKbBoundary
 *     Violation.toLogPayload()` returns the redacted shape.
 */

import {
  flattenPersonLayer,
  type PersonalMemoryCell,
  type PersonLayerResult,
} from './person-layer.js';

// ────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────

/**
 * Kinds the wall ALWAYS allows to cross — these are personal facts the
 * person owns under GDPR Art. 4(1) / PDPA TZ §3, never the tenant's IP.
 *
 * `recurring-fact` is intentionally NOT in this list — life events like
 * "my mother passed in August" are allowed to cross, but the schema's
 * `recurring-fact` kind also covers structured biographical claims
 * whose payload may carry a numeric date / location. We treat them as
 * "allowed unless they carry numeric data" via the same predicate as
 * cross-tenant cells.
 */
const ALWAYS_ALLOWED_KINDS: ReadonlySet<string> = new Set([
  'preference',
  'context',
  'calibration',
  'sentiment',
]);

/** k-anonymity floor below which counts may not cross the wall. */
export const K_ANONYMITY_FLOOR = 3;

export interface EnforceChineseWallArgs {
  readonly personLayerData: PersonLayerResult;
  readonly currentTenantId: string;
}

export interface EnforceChineseWallResult {
  /**
   * Cells the brain may surface to the active tenant context. Includes
   * (a) cells with no source_tenant_id (person-level facts), (b) cells
   * sourced from the active tenant itself, (c) cells of kinds in
   * ALWAYS_ALLOWED_KINDS *unless* they carry numeric payload data.
   */
  readonly allowedFacts: ReadonlyArray<PersonalMemoryCell>;
  /**
   * Cells blocked because they cross tenants AND carry numeric values.
   * Surfaced separately so the audit chain can log a denial reason.
   */
  readonly blockedNumeric: ReadonlyArray<PersonalMemoryCell>;
  /**
   * Counts grouped by (other-tenant id, cell-kind). These are returned
   * separately from `allowedFacts` so the brain can decide whether to
   * surface them under the k-anonymity rule (`countsSafeToSurface`).
   */
  readonly crossTenantCounts: ReadonlyArray<CrossTenantCount>;
  /**
   * Aggregate counts whose `count >= K_ANONYMITY_FLOOR`. The brain
   * MAY surface these as "across N other tenants you …" claims.
   */
  readonly countsSafeToSurface: ReadonlyArray<CrossTenantCount>;
  /**
   * Aggregate counts whose `count < K_ANONYMITY_FLOOR`. The brain
   * MUST NOT surface these to the user.
   */
  readonly countsBelowKFloor: ReadonlyArray<CrossTenantCount>;
}

export interface CrossTenantCount {
  readonly sourceTenantId: string;
  readonly cellKind: string;
  readonly count: number;
}

/**
 * Output of `tagBoundary` — used by the reply composer to annotate
 * candidate sentences with cross-tenant flags.
 */
export interface BoundaryTags {
  /** True iff any allowed cell originates from a non-active tenant. */
  readonly crossTenantFlag: boolean;
  /**
   * Set of tenant ids hidden from the response per the wall — every
   * cell in `blockedNumeric` plus every count below the k-floor.
   * Sorted alphabetically for stable test fixtures.
   */
  readonly hiddenFromTenants: ReadonlyArray<string>;
  /** Mirrors `EnforceChineseWallResult` for downstream consumers. */
  readonly allowedFacts: ReadonlyArray<PersonalMemoryCell>;
  readonly blockedNumeric: ReadonlyArray<PersonalMemoryCell>;
  readonly countsSafeToSurface: ReadonlyArray<CrossTenantCount>;
}

// ────────────────────────────────────────────────────────────────────
// PersonalKbBoundaryViolation — fail-loud error for assertChineseWall
// ────────────────────────────────────────────────────────────────────

/**
 * Thrown by `assertChineseWall` when any cross-tenant numeric cell or
 * below-k-floor aggregate count is present in the loaded PersonLayer.
 * The caller (brain orchestrator) MUST surface this as a hard 5xx
 * response — never catch + ignore, never log + continue.
 *
 * The `cause`-like detail bag is intentionally small (counts only — no
 * payload values) so the audit-chain emitter can persist it without
 * leaking the very data the wall was designed to protect.
 */
export class PersonalKbBoundaryViolation extends Error {
  public readonly currentTenantId: string;
  public readonly blockedNumericCount: number;
  public readonly belowKFloorCount: number;
  public readonly hiddenFromTenants: ReadonlyArray<string>;

  public constructor(args: {
    readonly currentTenantId: string;
    readonly blockedNumericCount: number;
    readonly belowKFloorCount: number;
    readonly hiddenFromTenants: ReadonlyArray<string>;
  }) {
    const tenantList = [...args.hiddenFromTenants].sort().join(', ') || '∅';
    super(
      `Chinese-wall violation: ${args.blockedNumericCount} cross-tenant numeric cell(s) and ${args.belowKFloorCount} below-k aggregate count(s) blocked from tenant=${args.currentTenantId} (sources: ${tenantList})`,
    );
    this.name = 'PersonalKbBoundaryViolation';
    this.currentTenantId = args.currentTenantId;
    this.blockedNumericCount = args.blockedNumericCount;
    this.belowKFloorCount = args.belowKFloorCount;
    this.hiddenFromTenants = Object.freeze([...args.hiddenFromTenants]);
  }

  /**
   * Redaction-safe payload for the Pino logger / audit-chain emitter.
   * Includes counts + tenant ids only; payload values stay out.
   */
  public toLogPayload(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      kind: 'personal-kb-boundary-violation',
      currentTenantId: this.currentTenantId,
      blockedNumericCount: this.blockedNumericCount,
      belowKFloorCount: this.belowKFloorCount,
      hiddenFromTenants: this.hiddenFromTenants,
    });
  }
}

// ────────────────────────────────────────────────────────────────────
// Numeric detection — pure
// ────────────────────────────────────────────────────────────────────

/**
 * Conservative "contains numeric data" check. We err on the side of
 * blocking: anything that *could* be a rent amount / contract value /
 * count / arrears figure gets flagged.
 *
 *   - any number node anywhere in the JSON tree
 *   - any string that parses cleanly to a finite number
 *   - any string matching a currency / unit / percentage token
 *   - any nested array/object containing the above
 *
 * Bool true/false are NOT numeric — they encode preferences, not
 * quantities.
 */
export function cellContainsNumeric(cell: PersonalMemoryCell): boolean {
  return valueContainsNumeric(cell.value);
}

// Currency / unit tokens that BN cares about: TZ Shilling, USD, KES,
// NGN, ZAR, GBP, EUR; sqm/sqft (property area); months/years (lease
// terms); percentages; bare $.
const NUMERIC_TOKEN_REGEX =
  /(\d[\d,]*\.?\d*)(\s*)(tzs|tsh|tshs|usd|kes|ugx|ngn|zar|gbp|eur|sqm|sqft|m2|ft2|months?|years?|\$|%)/i;

function valueContainsNumeric(
  value: Readonly<Record<string, unknown>> | ReadonlyArray<unknown>,
): boolean {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (scalarOrNestedContainsNumeric(item)) return true;
    }
    return false;
  }
  // Iterate without `for...in` to avoid prototype pollution surface.
  const obj = value as Readonly<Record<string, unknown>>;
  for (const key of Object.keys(obj)) {
    const inner: unknown = obj[key];
    if (scalarOrNestedContainsNumeric(inner)) return true;
  }
  return false;
}

function scalarOrNestedContainsNumeric(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'bigint') return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return false;
    if (NUMERIC_TOKEN_REGEX.test(trimmed)) return true;
    // Bare number string — "0.8", "1,000", "42".
    if (/^-?\d[\d,]*\.?\d*$/.test(trimmed)) return true;
    return false;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (scalarOrNestedContainsNumeric(item)) return true;
    }
    return false;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (scalarOrNestedContainsNumeric(obj[key])) return true;
    }
    return false;
  }
  return false;
}

// ────────────────────────────────────────────────────────────────────
// Core enforcement
// ────────────────────────────────────────────────────────────────────

/**
 * Walk every cell in the layer and partition into allowed / blocked /
 * counted buckets. Pure — no I/O.
 *
 * Decision matrix (per cell):
 *
 *   source_tenant_id == null          → ALLOWED (person-level fact)
 *   source_tenant_id == currentTenant → ALLOWED (active-tenant cell)
 *   kind in ALWAYS_ALLOWED_KINDS
 *     AND numeric-free                → ALLOWED + count
 *   else                              → BLOCKED + count
 *
 * Counts are then thresholded with k=3 anonymity.
 *
 * This is the "compute the verdict" function — it never throws. To
 * fail loudly on the verdict, use `assertChineseWall()` below.
 */
export function enforceChineseWall(
  args: EnforceChineseWallArgs,
): EnforceChineseWallResult {
  if (!args.currentTenantId || args.currentTenantId.trim() === '') {
    // No active tenant — refuse to make a decision; treat every cell
    // as blocked so we never accidentally leak.
    const allCells = flattenPersonLayer(args.personLayerData);
    const blockedNumeric = allCells.filter(cellContainsNumeric);
    return Object.freeze({
      allowedFacts: Object.freeze([]) as ReadonlyArray<PersonalMemoryCell>,
      blockedNumeric: Object.freeze(blockedNumeric),
      crossTenantCounts: Object.freeze([]) as ReadonlyArray<CrossTenantCount>,
      countsSafeToSurface: Object.freeze([]) as ReadonlyArray<CrossTenantCount>,
      countsBelowKFloor: Object.freeze([]) as ReadonlyArray<CrossTenantCount>,
    });
  }

  const allCells = flattenPersonLayer(args.personLayerData);
  const allowed: PersonalMemoryCell[] = [];
  const blocked: PersonalMemoryCell[] = [];
  // tenantId|kind → count
  const counts = new Map<string, CrossTenantCount>();

  for (const cell of allCells) {
    const sourceTenantId = cell.sourceTenantId;
    const isPersonLevel = sourceTenantId === null;
    const isSameTenant = sourceTenantId === args.currentTenantId;

    if (isPersonLevel || isSameTenant) {
      allowed.push(cell);
      continue;
    }

    // Cross-tenant cell. Record for k-anonymity count.
    const key = `${sourceTenantId}|${cell.cellKind}`;
    const existing = counts.get(key);
    counts.set(key, {
      sourceTenantId,
      cellKind: cell.cellKind,
      count: (existing?.count ?? 0) + 1,
    });

    const kindAllowed = ALWAYS_ALLOWED_KINDS.has(cell.cellKind);
    const hasNumeric = cellContainsNumeric(cell);

    if (kindAllowed && !hasNumeric) {
      allowed.push(cell);
    } else {
      blocked.push(cell);
    }
  }

  // Threshold the counts.
  const crossTenantCounts: CrossTenantCount[] = [];
  const safe: CrossTenantCount[] = [];
  const below: CrossTenantCount[] = [];
  for (const entry of counts.values()) {
    crossTenantCounts.push(entry);
    if (entry.count >= K_ANONYMITY_FLOOR) safe.push(entry);
    else below.push(entry);
  }
  // Stable sort by tenantId then kind for deterministic test output.
  const cmp = (a: CrossTenantCount, b: CrossTenantCount): number => {
    if (a.sourceTenantId === b.sourceTenantId) {
      return a.cellKind.localeCompare(b.cellKind);
    }
    return a.sourceTenantId.localeCompare(b.sourceTenantId);
  };
  crossTenantCounts.sort(cmp);
  safe.sort(cmp);
  below.sort(cmp);

  return Object.freeze({
    allowedFacts: Object.freeze(allowed),
    blockedNumeric: Object.freeze(blocked),
    crossTenantCounts: Object.freeze(crossTenantCounts),
    countsSafeToSurface: Object.freeze(safe),
    countsBelowKFloor: Object.freeze(below),
  });
}

// ────────────────────────────────────────────────────────────────────
// Fail-loud assertion — used by the brain orchestrator
// ────────────────────────────────────────────────────────────────────

/**
 * Compute the verdict and THROW `PersonalKbBoundaryViolation` if any
 * cross-tenant numeric cell or below-k-floor aggregate is present.
 *
 * Use this at the brain orchestrator's prompt-composition seam — the
 * exception bubbles to the audit-chain emitter and produces a hard
 * denial rather than silently filtering. Callers that want a pure
 * partitioning (no throw) should call `enforceChineseWall` instead.
 *
 * Returns the same verdict shape as `enforceChineseWall` when there
 * is nothing to block, so callers can use the allowed/safe buckets
 * directly without redoing the work.
 */
export function assertChineseWall(
  args: EnforceChineseWallArgs,
): EnforceChineseWallResult {
  const verdict = enforceChineseWall(args);
  if (
    verdict.blockedNumeric.length === 0 &&
    verdict.countsBelowKFloor.length === 0
  ) {
    return verdict;
  }
  const hidden = new Set<string>();
  for (const cell of verdict.blockedNumeric) {
    if (cell.sourceTenantId) hidden.add(cell.sourceTenantId);
  }
  for (const entry of verdict.countsBelowKFloor) {
    hidden.add(entry.sourceTenantId);
  }
  throw new PersonalKbBoundaryViolation({
    currentTenantId: args.currentTenantId,
    blockedNumericCount: verdict.blockedNumeric.length,
    belowKFloorCount: verdict.countsBelowKFloor.length,
    hiddenFromTenants: Object.freeze([...hidden].sort()),
  });
}

// ────────────────────────────────────────────────────────────────────
// Tag-only convenience for the reply composer
// ────────────────────────────────────────────────────────────────────

export interface TagBoundaryArgs {
  readonly personLayerData: PersonLayerResult;
  readonly currentTenantId: string;
}

/**
 * Convenience wrapper that returns the boundary tags the reply
 * composer attaches to outbound chat envelopes. Same enforcement
 * verdict as `enforceChineseWall` but reshaped into the boolean +
 * "hidden from" array the audit chain needs.
 */
export function tagBoundary(args: TagBoundaryArgs): BoundaryTags {
  const verdict = enforceChineseWall(args);

  const hidden = new Set<string>();
  for (const cell of verdict.blockedNumeric) {
    if (cell.sourceTenantId) hidden.add(cell.sourceTenantId);
  }
  for (const entry of verdict.countsBelowKFloor) {
    hidden.add(entry.sourceTenantId);
  }

  const crossTenantFlag = verdict.allowedFacts.some(
    (cell) =>
      cell.sourceTenantId !== null &&
      cell.sourceTenantId !== args.currentTenantId,
  );

  return Object.freeze({
    crossTenantFlag,
    hiddenFromTenants: Object.freeze(Array.from(hidden).sort()),
    allowedFacts: verdict.allowedFacts,
    blockedNumeric: verdict.blockedNumeric,
    countsSafeToSurface: verdict.countsSafeToSurface,
  });
}
