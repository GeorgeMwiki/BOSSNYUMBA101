/**
 * Tenant-scoped Cypher helper — closes Gap D from
 * `.planning/parity-litfin/09-tools-connectors-kg.md`.
 *
 * The base `Neo4jClient.readQuery` / `writeQuery` accept an open
 * `Record<string, unknown>` for params. Nothing in the type system
 * requires a `tenantId`. A future tool that forgets a single
 * `WHERE n._tenantId = $tenantId` will silently leak cross-tenant
 * data — impossible to catch in CI without a Cypher linter.
 *
 * This wrapper provides a TYPE-LEVEL guarantee:
 *   - `TenantScopedParams<T>` widens any caller-supplied param object
 *     with a mandatory `tenantId: string`. Forgetting it is a
 *     TypeScript compile error.
 *   - At runtime the wrapper also asserts the Cypher actually
 *     references `$tenantId` and rejects queries that don't.
 *
 * The wrapper is purely additive — it composes ON TOP of any
 * `Neo4jReadClient` / `Neo4jWriteClient` duck-type. The graph-sync
 * `Neo4jClient` already satisfies the duck-typed interfaces, so the
 * wrapper drops in without changing the underlying client.
 *
 * The runtime check is conservative — it allows `$tenantId`,
 * `{tenantId: $tenantId}`, and embedded `_tenantId: $tenantId` forms.
 * It rejects queries with no `$tenantId` reference at all.
 */

// ---------- Public types ----------

/**
 * Param object every tenant-scoped query must supply. The intersection
 * with `T` ensures callers can ADD extra params but never DROP
 * `tenantId`.
 */
export type TenantScopedParams<T extends Record<string, unknown> = Record<string, unknown>> =
  T & { readonly tenantId: string };

/**
 * Minimal duck-typed surface needed for tenant-scoped reads. Matches
 * `Neo4jClient.readQuery` exactly so the production client drops in.
 */
export interface Neo4jReadClient {
  readQuery<T = Record<string, unknown>>(
    cypher: string,
    params?: Record<string, unknown>,
    database?: string,
  ): Promise<T[]>;
}

/** Same shape for write-side queries. */
export interface Neo4jWriteClient {
  writeQuery<T = Record<string, unknown>>(
    cypher: string,
    params?: Record<string, unknown>,
    database?: string,
  ): Promise<T[]>;
}

export interface TenantScopedCypherClient {
  readScoped<R = Record<string, unknown>, P extends Record<string, unknown> = Record<string, unknown>>(
    cypher: string,
    params: TenantScopedParams<P>,
    database?: string,
  ): Promise<R[]>;

  writeScoped<R = Record<string, unknown>, P extends Record<string, unknown> = Record<string, unknown>>(
    cypher: string,
    params: TenantScopedParams<P>,
    database?: string,
  ): Promise<R[]>;
}

export interface TenantScopedCypherDeps {
  readonly reader: Neo4jReadClient;
  readonly writer?: Neo4jWriteClient;
  /**
   * When true (default), reject Cypher queries that don't reference
   * `$tenantId`. Tests may relax this for negative-path coverage.
   */
  readonly strict?: boolean;
}

export class TenantScopeViolation extends Error {
  public readonly code = 'TENANT_SCOPE_VIOLATION' as const;
  constructor(message: string) {
    super(message);
    this.name = 'TenantScopeViolation';
  }
}

// ---------- Helpers ----------

const TENANT_ID_PATTERN = /\$tenantId\b/;

// H16 closure: substring `$tenantId` is not enough — the value must
// appear in a WHERE / property-bag filter or a MERGE/MATCH pattern that
// constrains a node. Examples the OLD check accepted but the new one
// rejects:
//   - `RETURN $tenantId AS x` (no filter)
//   - `MATCH (a) WHERE 1=1 OR a._tenantId = $tenantId RETURN a`
//     (the LHS short-circuit lets every row through)
//
// The new check looks for one of these BIND patterns:
//   - `_tenantId: $tenantId` in a property bag
//   - `<expr> = $tenantId` in a WHERE clause that is NOT preceded by
//     `1=1 OR` / `true OR` on the same WHERE clause
const TENANT_BIND_BAG = /_tenantId\s*:\s*\$tenantId\b/;
const TENANT_BIND_WHERE = /\.\s*_tenantId\s*=\s*\$tenantId\b/;
// Heuristic for the disjunction-bypass pattern. Matches a WHERE that
// contains `1=1 OR ` or `true OR ` followed eventually by the tenant
// constraint — the LHS lets every row through.
const DISJUNCTION_BYPASS = /\bWHERE\b[\s\S]{0,200}?\b(?:1\s*=\s*1|true)\s+OR\b/i;

export function assertCypherReferencesTenantId(cypher: string): void {
  if (!TENANT_ID_PATTERN.test(cypher)) {
    throw new TenantScopeViolation(
      'TenantScopedCypher: query MUST reference $tenantId; refusing to run a tenant-unscoped Cypher query',
    );
  }
  const hasBindBag = TENANT_BIND_BAG.test(cypher);
  const hasBindWhere = TENANT_BIND_WHERE.test(cypher);
  if (!hasBindBag && !hasBindWhere) {
    throw new TenantScopeViolation(
      'TenantScopedCypher: query references $tenantId but never BINDS it ' +
        '(expected `_tenantId: $tenantId` in a property bag or `<x>._tenantId = $tenantId` in WHERE)',
    );
  }
  if (DISJUNCTION_BYPASS.test(cypher)) {
    throw new TenantScopeViolation(
      'TenantScopedCypher: query contains a `1=1 OR …` / `true OR …` disjunction ' +
        'in its WHERE clause — the LHS bypasses the tenant filter',
    );
  }
}

function assertTenantIdParam(params: Record<string, unknown>): void {
  const tenantId = params.tenantId;
  if (typeof tenantId !== 'string' || tenantId.trim().length === 0) {
    throw new TenantScopeViolation(
      'TenantScopedCypher: params.tenantId is required and must be a non-empty string',
    );
  }
}

// ---------- Factory ----------

export function createTenantScopedCypher(
  deps: TenantScopedCypherDeps,
): TenantScopedCypherClient {
  const strict = deps.strict ?? true;

  async function readScoped<R = Record<string, unknown>, P extends Record<string, unknown> = Record<string, unknown>>(
    cypher: string,
    params: TenantScopedParams<P>,
    database?: string,
  ): Promise<R[]> {
    if (strict) assertCypherReferencesTenantId(cypher);
    assertTenantIdParam(params);
    return deps.reader.readQuery<R>(cypher, params, database);
  }

  async function writeScoped<R = Record<string, unknown>, P extends Record<string, unknown> = Record<string, unknown>>(
    cypher: string,
    params: TenantScopedParams<P>,
    database?: string,
  ): Promise<R[]> {
    if (!deps.writer) {
      throw new TenantScopeViolation(
        'TenantScopedCypher: writer client not configured; refuse to write',
      );
    }
    if (strict) assertCypherReferencesTenantId(cypher);
    assertTenantIdParam(params);
    return deps.writer.writeQuery<R>(cypher, params, database);
  }

  return { readScoped, writeScoped };
}

// ─────────────────────────────────────────────────────────────────────
// Cypher mini-builder — utility for assembling tenant-scoped queries
// without forgetting the gate. Optional; callers can hand-roll Cypher
// and the runtime guard will still catch missing `$tenantId`.
// ─────────────────────────────────────────────────────────────────────

/**
 * Inject a `{_tenantId: $tenantId}` clause into a node pattern. Useful
 * for templating multi-tenant queries where authors keep forgetting the
 * gate. Returns the rewritten pattern string.
 *
 * Example:
 *   scopeNodePattern('(p:Property)')  →  '(p:Property {_tenantId: $tenantId})'
 *   scopeNodePattern('(p:Property {status: "active"})')
 *     →  '(p:Property {_tenantId: $tenantId, status: "active"})'
 */
export function scopeNodePattern(pattern: string): string {
  const trimmed = pattern.trim();
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) {
    return pattern; // not a node pattern; leave alone
  }
  if (TENANT_ID_PATTERN.test(trimmed)) {
    return pattern; // already scoped
  }
  // Strip outer parens, then re-emit with the tenant gate inserted.
  const inner = trimmed.slice(1, -1);
  // Detect existing property bag — naive match for the FIRST '{'.
  const braceIdx = inner.indexOf('{');
  if (braceIdx === -1) {
    return `(${inner} {_tenantId: $tenantId})`;
  }
  const before = inner.slice(0, braceIdx).trimEnd();
  const after = inner.slice(braceIdx + 1).replace(/^\s*/, '');
  // `after` now starts with the bag contents (and ends with `}`).
  // Prefix it with `_tenantId: $tenantId, ` and re-close the outer paren.
  return `(${before} {_tenantId: $tenantId, ${after})`;
}

/**
 * Walk every node pattern in a Cypher fragment and apply
 * `scopeNodePattern` to each. The single-pattern helper above is
 * misleadingly named: real Cypher fragments are usually a chain like
 * `(a)-[r]->(b)`, and the caller has to remember to scope EACH side
 * separately. This walker does it once.
 *
 * M5 closure (round-3 audit, 2026-05-19).
 *
 * The walker uses a balanced-paren scanner so nested parens inside a
 * property bag (e.g. `{name: "(a)"}`) are not mistaken for node
 * boundaries. Relationship patterns `-[...]-` and arrows `->` are
 * preserved unchanged. Node patterns that already reference
 * `$tenantId` are left alone (the single-pattern helper short-circuits
 * on already-scoped input).
 *
 * Note: relationship-property bags `[r {since: 2020}]` are NOT scoped —
 * tenant binding lives on nodes, not edges. The graph-sync engine
 * always reaches a node from a relationship via MATCH, so the
 * end-nodes' scope is what enforces isolation.
 *
 * @example
 *   scopeAllNodePatterns('MATCH (a:Property)-[r:OWNS]->(b:Owner) RETURN a, b')
 *   // → 'MATCH (a:Property {_tenantId: $tenantId})-[r:OWNS]->(b:Owner {_tenantId: $tenantId}) RETURN a, b'
 */
export function scopeAllNodePatterns(cypher: string): string {
  const out: string[] = [];
  let i = 0;
  const n = cypher.length;
  // Top-level string-state tracker so a `(` inside a string literal
  // (e.g. `WHERE a.name = "(foo)"`) is not mistaken for a node pattern.
  let outerSingle = false;
  let outerDouble = false;
  let outerBacktick = false;
  while (i < n) {
    const ch = cypher[i];
    if (outerSingle) {
      out.push(ch);
      if (ch === "'" && cypher[i - 1] !== '\\') outerSingle = false;
      i++;
      continue;
    }
    if (outerDouble) {
      out.push(ch);
      if (ch === '"' && cypher[i - 1] !== '\\') outerDouble = false;
      i++;
      continue;
    }
    if (outerBacktick) {
      out.push(ch);
      if (ch === '`') outerBacktick = false;
      i++;
      continue;
    }
    if (ch === "'") { outerSingle = true; out.push(ch); i++; continue; }
    if (ch === '"') { outerDouble = true; out.push(ch); i++; continue; }
    if (ch === '`') { outerBacktick = true; out.push(ch); i++; continue; }
    if (ch !== '(') {
      out.push(ch);
      i++;
      continue;
    }
    // Found an opening paren — see if this is a NODE pattern or
    // something else (function call, parenthesised expr in a WHERE).
    // We treat it as a node pattern when:
    //   - the paren is followed by either:
    //       a) the alias identifier (e.g. `a`, `n1`)
    //       b) `:Label` (anonymous node)
    //       c) `{` (anonymous node with property bag)
    //       d) `)` (anonymous bare node)
    //   - and is NOT preceded by an identifier char (which would mark
    //     it as a function call like `count(`).
    const prev = i > 0 ? cypher[i - 1] : '';
    const isFnCall = /[A-Za-z0-9_]/.test(prev);
    const next = cypher[i + 1] ?? '';
    const isNodeLike =
      !isFnCall &&
      (next === ')' || next === ':' || next === '{' || /[A-Za-z_]/.test(next));
    if (!isNodeLike) {
      out.push(ch);
      i++;
      continue;
    }
    // Scan forward for the matching close paren, respecting nested
    // braces inside the property bag and balanced single/double quotes.
    let depth = 1;
    let j = i + 1;
    let inSingle = false;
    let inDouble = false;
    let inBacktick = false;
    while (j < n && depth > 0) {
      const c = cypher[j];
      if (!inSingle && !inDouble && !inBacktick) {
        if (c === '(') depth++;
        else if (c === ')') depth--;
        else if (c === "'") inSingle = true;
        else if (c === '"') inDouble = true;
        else if (c === '`') inBacktick = true;
      } else if (inSingle && c === "'" && cypher[j - 1] !== '\\') {
        inSingle = false;
      } else if (inDouble && c === '"' && cypher[j - 1] !== '\\') {
        inDouble = false;
      } else if (inBacktick && c === '`') {
        inBacktick = false;
      }
      if (depth === 0) break;
      j++;
    }
    if (depth !== 0) {
      // Unmatched paren — bail out, emit the rest verbatim. Caller
      // gets a no-op rather than corrupting their query.
      out.push(cypher.slice(i));
      return out.join('');
    }
    const pattern = cypher.slice(i, j + 1);
    out.push(scopeNodePattern(pattern));
    i = j + 1;
  }
  return out.join('');
}
