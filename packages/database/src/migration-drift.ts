/**
 * Migration ledger-drift detection (KI-001 / KI-004).
 *
 * Drizzle records a migration as applied in `drizzle.__drizzle_migrations`
 * the moment its hash is inserted. If the `CREATE TABLE` statements inside
 * that migration never actually executed against the live DB — a prior DB
 * surgery, a partial rollback, or a from-scratch ordering abort that died
 * mid-run — the ledger still claims success and drizzle will NEVER re-run
 * the file (it short-circuits on the recorded hash). Tables silently go
 * missing in production and the only symptom is a runtime
 * `relation "<name>" does not exist`.
 *
 * This module is the pure, side-effect-free core of the guard:
 *
 *   1. `parseExpectedTables(sql)` — static-parses the union of every table a
 *      migration tree promises to create via
 *      `CREATE TABLE [IF NOT EXISTS] [public.]<name>`.
 *   2. `detectDrift(expected, present)` — set-difference of expected tables
 *      against the tables actually present in `public`.
 *
 * The live-DB I/O (connecting, `to_regclass`, reading the ledger) lives in
 * the callers — `scripts/verify-migrations.mjs` (CLI/CI) and
 * `run-migrations.ts` (boot-time fail-closed hook) — so this file stays
 * trivially unit-testable with no Postgres dependency. Everything here is
 * immutable: inputs are never mutated and new collections are returned.
 */

/**
 * One table a migration tree expects to exist after a clean apply.
 */
export interface ExpectedTable {
  /** Bare table name, lower-cased, schema prefix stripped. */
  readonly name: string;
  /** Migration filename that declared the `CREATE TABLE`. */
  readonly migration: string;
}

/**
 * Result of comparing the expected table set against the live DB.
 */
export interface DriftReport {
  /** Distinct table names expected from the migration tree. */
  readonly expected: readonly string[];
  /** Tables that exist in the DB (lower-cased), as observed by the caller. */
  readonly present: readonly string[];
  /** Expected-but-absent tables — the drift. Sorted, de-duplicated. */
  readonly missing: readonly string[];
  /** Convenience flag: `missing.length > 0`. */
  readonly hasDrift: boolean;
}

/**
 * Strip SQL comments and string-literal bodies so the `CREATE TABLE` regex
 * never matches a table name that only appears inside a `-- ...` line, a
 * `/* ... *\/` block, or a quoted value (e.g. a NOTICE message or a seed
 * string that happens to contain the words "create table"). Mirrors the
 * scanner in `scripts/validate-migration-safety.mjs` so both guards parse
 * SQL identically.
 */
export function stripSqlNoise(sql: string): string {
  let out = '';
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    const nx = sql[i + 1];
    // Line comment `-- ...`
    if (c === '-' && nx === '-') {
      while (i < n && sql[i] !== '\n') i++;
      continue;
    }
    // Block comment `/* ... */`
    if (c === '/' && nx === '*') {
      i += 2;
      while (i < n && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // Single-quoted string literal — drop the contents (keep a space so we
    // never accidentally fuse two identifiers across the gap), honouring the
    // `''` escape for an embedded quote.
    if (c === "'") {
      i++;
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          i++;
          break;
        }
        i++;
      }
      out += ' ';
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Unwrap a `"quoted"` identifier; pass bare identifiers through unchanged. */
function unquoteIdent(raw: string): string {
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1);
  }
  return raw;
}

/**
 * Parse every `CREATE TABLE [IF NOT EXISTS] [<schema>.]<name>` in one SQL
 * body and return the bare, lower-cased table names. Handles:
 *
 *   - the optional `IF NOT EXISTS` guard (every shipped migration uses it),
 *   - an optional schema qualifier — the `public.` prefix is stripped so it
 *     lines up with `to_regclass('public.<name>')` in the caller,
 *   - both bare `snake_case` and `"quoted"` identifiers.
 *
 * Deliberately NOT matched (these are not standalone base tables we can
 * verify with a flat `to_regclass('public.<name>')`, and none appear in the
 * current tree — confirmed by audit):
 *
 *   - `CREATE TEMP/TEMPORARY/UNLOGGED TABLE` (session-scoped / transient),
 *   - `CREATE TABLE ... PARTITION OF` (child partitions),
 *   - `CREATE TABLE ... AS SELECT` (CTAS),
 *   - `CREATE TABLE` emitted dynamically inside a `DO $$ ... EXECUTE ...$$`.
 *
 * The match requires an opening `(` after the name, which is what a real
 * column-list `CREATE TABLE` always has — this naturally excludes
 * `PARTITION OF` and `AS SELECT` forms (they have no immediate paren).
 */
export function parseTableNames(sql: string): string[] {
  const cleaned = stripSqlNoise(sql);
  // `create table`, optional `if not exists`, optional `<schema>.`, then the
  // captured name, then `(`. The `create ... table` alternation lets us see a
  // `temp`/`temporary`/`unlogged`/`global` qualifier in the same match so we
  // can reject transient tables (a portable negative-lookbehind is awkward).
  const rx =
    /\bcreate\s+(?:(temp|temporary|unlogged|global)\s+)?table\s+(?:if\s+not\s+exists\s+)?(?:(?:"[^"]+"|\w+)\.)?("[^"]+"|\w+)\s*\(/gi;
  const names: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = rx.exec(cleaned)) !== null) {
    // m[1] is the transient qualifier (temp/unlogged/…) when present — those
    // tables are session-scoped or non-durable and cannot be verified with a
    // flat `to_regclass('public.<name>')`, so skip them.
    if (m[1]) continue;
    const name = unquoteIdent(m[2]).toLowerCase();
    if (!name) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

/**
 * Parse a set of `(filename, sql)` migration entries into the de-duplicated,
 * sorted list of expected base tables, each tagged with the FIRST migration
 * that declared it. Later re-declarations (the repo's idempotent
 * `IF NOT EXISTS` healers) are ignored for attribution — first-wins keeps the
 * report pointing at the migration that originally owns the table.
 */
export function parseExpectedTables(
  files: ReadonlyArray<{ readonly name: string; readonly sql: string }>,
): ExpectedTable[] {
  const byName = new Map<string, string>();
  for (const file of files) {
    for (const table of parseTableNames(file.sql)) {
      if (!byName.has(table)) {
        byName.set(table, file.name);
      }
    }
  }
  return [...byName.entries()]
    .map(([name, migration]) => ({ name, migration }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Compute the drift: which expected tables are NOT present in the DB.
 *
 * `present` is the set of table names the caller observed in `public`
 * (e.g. via `to_regclass`). Comparison is case-insensitive on the
 * lower-cased bare name. Returns an immutable report; never mutates inputs.
 */
export function detectDrift(
  expected: ReadonlyArray<ExpectedTable | string>,
  present: ReadonlyArray<string>,
): DriftReport {
  const expectedNames = expected.map((e) =>
    (typeof e === 'string' ? e : e.name).toLowerCase(),
  );
  const presentSet = new Set(present.map((p) => p.toLowerCase()));
  const uniqueExpected = [...new Set(expectedNames)].sort((a, b) =>
    a.localeCompare(b),
  );
  const missing = uniqueExpected.filter((name) => !presentSet.has(name));
  return {
    expected: uniqueExpected,
    present: [...presentSet].sort((a, b) => a.localeCompare(b)),
    missing,
    hasDrift: missing.length > 0,
  };
}
