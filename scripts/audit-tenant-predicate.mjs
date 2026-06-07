#!/usr/bin/env node
/**
 * Audit: tenant-predicate coverage (RLS safe-default defense #16, opt b).
 *
 * THREAT MODEL
 * ────────────
 * The production api-gateway connects to Postgres as a role that carries
 * `BYPASSRLS` (Supabase `service_role` convention — migration
 * 0155_supabase_rls_policies.sql §2). Under BYPASSRLS the Row-Level-
 * Security policies are INERT for that connection, so tenant isolation
 * rests SOLELY on app-level `WHERE tenant_id = ?` predicates in the
 * Drizzle repository layer. One SELECT/UPDATE/DELETE on a tenant-scoped
 * table that forgets its tenant predicate is a cross-tenant breach.
 *
 * This scanner is the backstop. It:
 *
 *   1. Parses `packages/database/src/migrations/*.sql` for every
 *      `CREATE TABLE … (… tenant_id …)` → the set of tenant-scoped SQL
 *      table names (reusing the `CREATE TABLE` parse shape from
 *      scripts/verify-migrations.mjs).
 *   2. Parses `packages/database/src/schemas/**` for
 *      `export const <var> = pgTable('<sql_name>', …)` to map each
 *      tenant-scoped SQL name → its Drizzle variable (the symbol the
 *      query code actually references in `.from(<var>)`).
 *   3. Scans Drizzle query code (packages/database/src/repositories,
 *      services per-service src/repositories, plus any
 *      db.execute(sql tagged template) / db.select().from(...) under the
 *      service src trees) for SELECT/UPDATE/DELETE against those tenant-
 *      scoped tables and flags any statement whose SAME chain has NO
 *      tenant predicate (eq(<t>.tenantId, ...) / "tenant_id =" /
 *      tenantId in a where / current_setting('app.current_tenant_id')).
 *   4. Allow-lists the documented cross-tenant exemptions from
 *      `scripts/__allowlists__/tenant-predicate-allowlist.mjs`.
 *   5. Exits non-zero on un-allowlisted violations and writes a markdown
 *      report to `.audit/tenant-predicate.md`.
 *
 * The heuristic is intentionally CONSERVATIVE — it favors false-
 * negatives (a missed real violation) over false-positives (noise that
 * trains operators to ignore the gate). When it cannot confidently
 * decide, it does not flag.
 *
 * Usage:
 *   node scripts/audit-tenant-predicate.mjs            # gate (exit 1 on violations)
 *   node scripts/audit-tenant-predicate.mjs --json     # machine-readable to stdout
 *   pnpm audit:tenant-predicate
 *
 * Exit codes:
 *   0  no un-allowlisted violations (and no stale allowlist entries)
 *   1  un-allowlisted violations found (or stale allowlist entries)
 *   2  fatal failure (filesystem / parse error)
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TENANT_PREDICATE_ALLOWLIST,
  TENANT_PREDICATE_PATH_ALLOWLIST,
  INLINE_ALLOW_MARKER,
} from './__allowlists__/tenant-predicate-allowlist.mjs';
import {
  enclosingFunctionBody,
  extractParenBody,
} from './lib/js-structure.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const MIGRATIONS_DIR = join(ROOT, 'packages', 'database', 'src', 'migrations');
const SCHEMAS_DIR = join(ROOT, 'packages', 'database', 'src', 'schemas');
const REPORT_PATH = join(ROOT, '.audit', 'tenant-predicate.md');

// Directories that hold query code we scan.
const SCAN_ROOTS = [
  join(ROOT, 'packages', 'database', 'src', 'repositories'),
  join(ROOT, 'services'),
];

// Never descend into these (vendored / generated / tests / fixtures).
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.git',
  'generated',
  '__tests__',
  '__fixtures__',
  '__mocks__',
  'fixtures',
  'test',
  'tests',
]);

const SKIP_FILE_RX = /\.(test|spec|d)\.[cm]?tsx?$/;

// ───────────────────────────────────────────────────────────────────
// Generic recursive walk.
// ───────────────────────────────────────────────────────────────────

function walkDir(dir, predicate, out) {
  if (!existsSync(dir)) return;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      walkDir(full, predicate, out);
    } else if (predicate(full, name)) {
      out.push(full);
    }
  }
}

// ───────────────────────────────────────────────────────────────────
// (1) Tenant-scoped SQL table names from migrations.
//
// Strip line/block comments, then for each `CREATE TABLE … ( … )` body
// check whether the column list declares a `tenant_id` column. Reuses
// the CREATE-TABLE shape from scripts/verify-migrations.mjs.
// ───────────────────────────────────────────────────────────────────

function stripSqlComments(sql) {
  return sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function findTenantScopedTables() {
  const files = [];
  walkDir(MIGRATIONS_DIR, (_full, name) => name.endsWith('.sql'), files);
  const tenantTables = new Set();
  // CREATE [TEMP|…] TABLE [IF NOT EXISTS] [schema.]<name> (
  const createRx =
    /\bcreate\s+(?:(temp|temporary|unlogged|global)\s+)?table\s+(?:if\s+not\s+exists\s+)?(?:(?:"[^"]+"|\w+)\.)?("[^"]+"|\w+)\s*\(/gi;
  const tenantColRx = /(^|,)\s*"?tenant_id"?\s+/i;
  for (const file of files.sort()) {
    const cleaned = stripSqlComments(readFileSync(file, 'utf8'));
    createRx.lastIndex = 0;
    let m;
    while ((m = createRx.exec(cleaned)) !== null) {
      if (m[1]) continue; // transient table — not a durable base table
      const name = m[2].replace(/"/g, '').toLowerCase();
      if (!name) continue;
      const openParen = createRx.lastIndex - 1;
      const body = extractParenBody(cleaned, openParen);
      if (!body) continue;
      if (tenantColRx.test(body)) tenantTables.add(name);
    }
  }
  return tenantTables;
}

// ───────────────────────────────────────────────────────────────────
// (2) Map tenant-scoped SQL name → Drizzle variable symbol.
//
// `export const <var> = pgTable('<sql_name>', …)`. We only keep the
// mapping for tables we already know are tenant-scoped.
// ───────────────────────────────────────────────────────────────────

function mapDrizzleVars(tenantTables) {
  const files = [];
  walkDir(SCHEMAS_DIR, (_full, name) => name.endsWith('.ts'), files);
  // sqlName -> Set<varName>; varName -> sqlName
  const sqlToVars = new Map();
  const varToSql = new Map();
  const pgTableRx =
    /\b(?:export\s+)?const\s+([a-zA-Z_$][\w$]*)\s*=\s*pgTable\s*\(\s*['"`]([a-zA-Z_][\w]*)['"`]/g;
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    pgTableRx.lastIndex = 0;
    let m;
    while ((m = pgTableRx.exec(src)) !== null) {
      const varName = m[1];
      const sqlName = m[2].toLowerCase();
      if (!tenantTables.has(sqlName)) continue;
      if (!sqlToVars.has(sqlName)) sqlToVars.set(sqlName, new Set());
      sqlToVars.get(sqlName).add(varName);
      varToSql.set(varName, sqlName);
    }
  }
  return { sqlToVars, varToSql };
}

// ───────────────────────────────────────────────────────────────────
// (3) Scan query code.
// ───────────────────────────────────────────────────────────────────

function collectQueryFiles() {
  const files = [];
  // database repositories
  walkDir(
    SCAN_ROOTS[0],
    (_full, name) => /\.[cm]?tsx?$/.test(name) && !SKIP_FILE_RX.test(name),
    files,
  );
  // services: only src trees; restrict to repositories + composition +
  // files that actually issue queries. We walk all of services/*/src and
  // filter by content later (cheap), but skip dist/test dirs via SKIP_DIRS.
  const serviceSrcRoots = [];
  if (existsSync(SCAN_ROOTS[1])) {
    for (const svc of readdirSync(SCAN_ROOTS[1])) {
      const srcDir = join(SCAN_ROOTS[1], svc, 'src');
      if (existsSync(srcDir)) serviceSrcRoots.push(srcDir);
    }
  }
  for (const srcDir of serviceSrcRoots) {
    walkDir(
      srcDir,
      (_full, name) => /\.[cm]?tsx?$/.test(name) && !SKIP_FILE_RX.test(name),
      files,
    );
  }
  return files;
}

function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) {
    if (src[i] === '\n') line++;
  }
  return line;
}

// Tenant-predicate signals. If ANY appears within the inspected window we
// treat the statement as tenant-scoped and do NOT flag. Accepts both raw
// SQL (`tenant_id =`, GUC read) and Drizzle (`x.tenantId`, tenant-key
// aliases) forms.
function hasTenantPredicate(windowSrc) {
  // Raw-SQL tenant filter: `tenant_id = …` / `tenant_id=$1` / quoted.
  if (/\btenant_id\b\s*=/i.test(windowSrc)) return true;
  // Raw-SQL GUC read (RLS-style predicate inside the statement).
  if (/current_setting\(\s*['"]app\.(current_)?tenant_id['"]/i.test(windowSrc))
    return true;
  // Drizzle: any `.tenantId` reference (eq(x.tenantId,…), inArray(x.tenantId,…),
  // x.tenantId in a where expression). Tenant-key aliases included.
  if (
    /\.(tenantId|platformTenantId|installedByTenantId|authorTenantId|tenantIdentityId|ownerTenantId)\b/.test(
      windowSrc,
    )
  )
    return true;
  // Drizzle object-shorthand / named where on a tenant column.
  if (/\btenantId\s*[:,]/.test(windowSrc)) return true;
  // A where() that references a hoisted predicate variable whose name
  // strongly implies tenant scoping. Conservative: only obvious names.
  if (
    /\.where\(\s*(tenantScoped|tenantFilter|tenantWhere|withTenant)\b/.test(
      windowSrc,
    )
  )
    return true;
  return false;
}

/**
 * Given the full source and the index just after a `.from(` / `.update(` /
 * `.delete(` token that targets a tenant table, return the inspection
 * window: from a small look-back (to catch a hoisted `whereClause`
 * variable defined just above) to the end of the statement.
 *
 * Statement end heuristic: the first top-level `;` at or after the match,
 * OR a blank line followed by a non-chain line, whichever comes first.
 * We also include a forward window cap so a malformed chain can't swallow
 * the whole file.
 */
function statementWindow(src, fromIdx) {
  const LOOKBACK = 800; // chars — enough to capture a hoisted whereClause
  const FORWARD_CAP = 2500; // chars — generous single-statement bound
  const start = Math.max(0, fromIdx - LOOKBACK);
  // Forward: stop at the first ';' after fromIdx (Drizzle awaited chains end
  // in ';'), capped.
  let end = src.length;
  const semi = src.indexOf(';', fromIdx);
  if (semi !== -1) end = semi + 1;
  if (end - fromIdx > FORWARD_CAP) end = fromIdx + FORWARD_CAP;
  return src.slice(start, end);
}

// Structural source navigation (string/comment-masked brace matching) lives
// in scripts/lib/js-structure.mjs — `enclosingFunctionBody` is imported.

/**
 * Decide whether a tenant predicate that scopes THIS table exists in the
 * enclosing method. We require the predicate to bind the SAME table
 * variable (e.g. `customers.tenantId` for a `.from(customers)` query) — or
 * a raw `tenant_id =` / GUC read — so a method that scopes table A but
 * forgets table B still flags B.
 *
 * The common hoisted forms this catches:
 *   const conditions = [eq(customers.tenantId, tenantId), …];
 *   const whereClause = and(...conditions);
 *   …select().from(customers).where(whereClause);
 */
function enclosingScopesTable(src, fromIdx, varName) {
  const body = enclosingFunctionBody(src, fromIdx);
  // Same-table Drizzle predicate: `<var>.tenantId` (or alias).
  const escaped = varName.replace(/[$]/g, '\\$');
  const sameTableRx = new RegExp(
    `\\b${escaped}\\.(tenantId|platformTenantId|installedByTenantId|authorTenantId|tenantIdentityId|ownerTenantId)\\b`,
  );
  if (sameTableRx.test(body)) return true;
  // Raw tenant filter / GUC inside the method.
  if (/\btenant_id\b\s*=/i.test(body)) return true;
  if (/current_setting\(\s*['"]app\.(current_)?tenant_id['"]/i.test(body))
    return true;
  return false;
}

/**
 * True when an inline `tenant-predicate-allow` marker appears on the query
 * line or on one of the (up to) three lines immediately above it.
 */
function hasInlineAllow(src, idx) {
  const lineStart = src.lastIndexOf('\n', idx) + 1;
  let lineEnd = src.indexOf('\n', idx);
  if (lineEnd === -1) lineEnd = src.length;
  // Capture the query line plus three preceding lines.
  let scanStart = lineStart;
  for (let n = 0; n < 3; n++) {
    if (scanStart <= 0) break;
    scanStart = src.lastIndexOf('\n', scanStart - 2) + 1;
  }
  const block = src.slice(scanStart, lineEnd);
  return block.includes(INLINE_ALLOW_MARKER);
}

/** Relative-path match against the path allowlist (exact or '/'-prefix). */
function isPathAllowlisted(relPath) {
  for (const entry of TENANT_PREDICATE_PATH_ALLOWLIST) {
    if (relPath === entry.path) return entry;
    if (entry.path.endsWith('/') && relPath.startsWith(entry.path)) return entry;
  }
  return null;
}

function scanForViolations(queryFiles, sqlToVars, varToSql) {
  const violations = [];
  // Build a single alternation of all tenant-table variable names.
  const allVars = [...varToSql.keys()];
  if (allVars.length === 0) return violations;
  const varAlt = allVars
    .sort((a, b) => b.length - a.length) // longest first to avoid prefix capture
    .map((v) => v.replace(/[$]/g, '\\$'))
    .join('|');

  // Match Drizzle table targets in SELECT/UPDATE/DELETE position:
  //   .from(<var>) | .update(<var>) | .delete(<var>)
  // (delete() takes the table as arg in Drizzle's `db.delete(table)`.)
  const drizzleRx = new RegExp(
    `\\.(from|update|delete)\\(\\s*(${varAlt})\\b`,
    'g',
  );

  for (const file of queryFiles) {
    const src = readFileSync(file, 'utf8');
    if (
      !src.includes('.from(') &&
      !src.includes('.update(') &&
      !src.includes('.delete(') &&
      !src.includes('db.execute(') &&
      !src.includes('.execute(sql')
    ) {
      continue;
    }
    const rel = relative(ROOT, file);
    const pathAllow = isPathAllowlisted(rel);

    // ── Drizzle builder queries ────────────────────────────────────
    drizzleRx.lastIndex = 0;
    let m;
    while ((m = drizzleRx.exec(src)) !== null) {
      const op = m[1];
      const varName = m[2];
      const sqlName = varToSql.get(varName);
      if (!sqlName) continue;
      const fromIdx = m.index;
      const win = statementWindow(src, fromIdx);
      // A delete()/update() chain's where can come AFTER .from in joins;
      // include the table's own var as an accepted predicate target.
      if (hasTenantPredicate(win)) continue;
      // Hoisted predicate built earlier in the SAME method (conditions[]
      // array / whereClause var) — the dominant pattern in this codebase.
      if (enclosingScopesTable(src, fromIdx, varName)) continue;
      recordViolation(violations, {
        file: rel,
        line: lineOf(src, fromIdx),
        table: sqlName,
        op: op === 'from' ? 'select' : op,
        kind: 'drizzle',
        snippet: snippetAt(src, fromIdx),
        inlineAllow: hasInlineAllow(src, fromIdx),
        pathAllow,
      });
    }

    // ── Raw SQL via db.execute(sql`…`) ─────────────────────────────
    scanRawSql(src, rel, sqlToVars, violations, pathAllow);
  }
  return violations;
}

/**
 * Push a violation, tagging WHY it might be suppressed (inline marker or
 * path allowlist) so the partitioner can route it without re-deriving the
 * context. Table-level allowlist is applied later (it needs no callsite
 * context).
 */
function recordViolation(violations, v) {
  violations.push(v);
}

function snippetAt(src, idx) {
  const lineStart = src.lastIndexOf('\n', idx) + 1;
  let lineEnd = src.indexOf('\n', idx);
  if (lineEnd === -1) lineEnd = src.length;
  return src.slice(lineStart, lineEnd).trim().slice(0, 160);
}

/**
 * Scan `sql`…`` template literals (typically passed to db.execute) for
 * FROM/UPDATE/DELETE/JOIN against a tenant-scoped SQL table name without a
 * tenant predicate in the SAME template.
 */
function scanRawSql(src, rel, sqlToVars, violations, pathAllow) {
  const tenantSqlNames = new Set(sqlToVars.keys());
  if (tenantSqlNames.size === 0) return;
  // Find each sql`…` template literal (non-nested; good enough — Drizzle
  // sql`` rarely nests backticks). Track start index for line numbers.
  const tmplRx = /\bsql`([\s\S]*?)`/g;
  let m;
  while ((m = tmplRx.exec(src)) !== null) {
    const body = m[1];
    const tmplStart = m.index;
    const lower = body.toLowerCase();
    // Only consider DML templates.
    if (
      !/\b(from|update|delete\s+from|join)\b/.test(lower) ||
      !/\b(select|update|delete|insert|with)\b/.test(lower)
    ) {
      continue;
    }
    // Scoped if the template itself carries a tenant predicate, OR the
    // enclosing method scopes by tenant_id elsewhere (a predicate built in
    // a CTE / separate clause / preceding statement in the same method).
    const scoped =
      hasRawTenantPredicate(body) ||
      hasRawTenantPredicate(enclosingFunctionBody(src, tmplStart));
    // Collect tenant tables referenced in FROM/JOIN/UPDATE/DELETE position.
    const refRx =
      /\b(?:from|join|update|delete\s+from)\s+(?:public\.|"public"\.)?"?([a-z_][a-z0-9_]*)"?/gi;
    let r;
    const flaggedHere = new Set();
    while ((r = refRx.exec(body)) !== null) {
      const name = r[1].toLowerCase();
      if (!tenantSqlNames.has(name)) continue;
      if (scoped) continue;
      if (flaggedHere.has(name)) continue;
      flaggedHere.add(name);
      const offsetInTmpl = r.index;
      const absIdx = tmplStart + 4 /* len('sql`') */ + offsetInTmpl;
      recordViolation(violations, {
        file: rel,
        line: lineOf(src, absIdx),
        table: name,
        op: 'raw-sql',
        kind: 'raw',
        snippet: refSnippet(body, offsetInTmpl),
        inlineAllow: hasInlineAllow(src, absIdx),
        pathAllow,
      });
    }
  }
}

function refSnippet(body, idx) {
  const start = Math.max(0, body.lastIndexOf('\n', idx) + 1);
  let end = body.indexOf('\n', idx);
  if (end === -1) end = body.length;
  return body.slice(start, end).trim().slice(0, 160);
}

function hasRawTenantPredicate(body) {
  if (/\btenant_id\b\s*=/i.test(body)) return true;
  if (/\.\s*tenant_id\b\s*=/i.test(body)) return true; // l.tenant_id = …
  if (/current_setting\(\s*['"]app\.(current_)?tenant_id['"]/i.test(body))
    return true;
  // `WHERE … tenant_id IN (` (multi-tenant fan-in but still scoped) — accept.
  if (/\btenant_id\b\s+in\s*\(/i.test(body)) return true;
  return false;
}

// ───────────────────────────────────────────────────────────────────
// Allowlist filtering + stale detection.
// ───────────────────────────────────────────────────────────────────

function partitionByAllowlist(violations) {
  const blocking = [];
  const allowed = [];
  for (const v of violations) {
    let suppressedBy = null;
    if (v.inlineAllow) suppressedBy = 'inline-comment';
    else if (v.pathAllow) suppressedBy = 'path-allowlist';
    else if (TENANT_PREDICATE_ALLOWLIST.has(v.table)) suppressedBy = 'table-allowlist';
    if (suppressedBy) allowed.push({ ...v, suppressedBy });
    else blocking.push(v);
  }
  return { blocking, allowed };
}

function allowReasonFor(v) {
  if (v.suppressedBy === 'inline-comment') return 'inline tenant-predicate-allow marker';
  if (v.suppressedBy === 'path-allowlist') return v.pathAllow?.reason ?? 'path-allowlisted';
  if (v.suppressedBy === 'table-allowlist')
    return TENANT_PREDICATE_ALLOWLIST.get(v.table)?.reason ?? 'table-allowlisted';
  return '';
}

function findStaleAllowlist(tenantTables) {
  // An allowlist entry is "stale" only when it claims to be tenant-scoped
  // (notTenantScoped !== true) yet the table is not in the tenant-scoped
  // set. Entries flagged notTenantScoped are documentation and never stale.
  const stale = [];
  for (const [name, meta] of TENANT_PREDICATE_ALLOWLIST) {
    if (meta && meta.notTenantScoped === true) continue;
    if (!tenantTables.has(name)) stale.push(name);
  }
  return stale;
}

// ───────────────────────────────────────────────────────────────────
// Reporting.
// ───────────────────────────────────────────────────────────────────

function ensureDir(p) {
  const d = dirname(p);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

function renderMarkdown(report) {
  const t = report.totals;
  const L = [];
  L.push('# Tenant-predicate audit');
  L.push('');
  L.push(
    'RLS safe-default defense #16(b). The production gateway connects as a ' +
      '`BYPASSRLS` role, so tenant isolation depends entirely on app-level ' +
      '`WHERE tenant_id = ?` predicates. This report lists tenant-scoped ' +
      'table queries that appear to be missing one.',
  );
  L.push('');
  L.push(`Scanned: ${report.scannedAt}`);
  L.push('');
  L.push('| metric | value |');
  L.push('|---|---|');
  L.push(`| tenant-scoped tables (migrations) | ${t.tenantTables} |`);
  L.push(`| tenant tables mapped to Drizzle vars | ${t.mappedVars} |`);
  L.push(`| query files scanned | ${t.filesScanned} |`);
  L.push(`| suspected violations (blocking) | ${t.blocking} |`);
  L.push(`| suppressed (allowlisted) | ${t.allowed} |`);
  L.push(`| stale allowlist entries | ${t.stale} |`);
  L.push('');

  L.push('## Suspected violations (un-allowlisted)');
  L.push('');
  if (report.blocking.length > 0) {
    L.push(
      'Each row is a SELECT/UPDATE/DELETE on a tenant-scoped table whose ' +
        'statement carries no detectable tenant predicate. Fix each: add the ' +
        'missing `eq(<table>.tenantId, tenantId)` / `WHERE tenant_id = …`; or, ' +
        'for a legitimate cross-tenant read, add an inline ' +
        '`tenant-predicate-allow: <why>` comment at the call-site (or a table/' +
        'path entry in `scripts/__allowlists__/tenant-predicate-allowlist.mjs`).',
    );
    L.push('');
    L.push('| table | op | file:line | statement |');
    L.push('|---|---|---|---|');
    for (const v of report.blocking) {
      const snip = v.snippet.replace(/\|/g, '\\|').replace(/`/g, '​`');
      L.push(`| \`${v.table}\` | ${v.op} | \`${v.file}:${v.line}\` | \`${snip}\` |`);
    }
    L.push('');
  } else {
    L.push('None. Every tenant-scoped query carries a tenant predicate.');
    L.push('');
  }

  if (report.allowed.length > 0) {
    L.push('## Suppressed (documented cross-tenant exemptions)');
    L.push('');
    L.push('| table | op | file:line | via | reason |');
    L.push('|---|---|---|---|---|');
    for (const v of report.allowed) {
      const reason = allowReasonFor(v).replace(/\|/g, '\\|');
      L.push(
        `| \`${v.table}\` | ${v.op} | \`${v.file}:${v.line}\` | ${v.suppressedBy} | ${reason} |`,
      );
    }
    L.push('');
  }

  if (report.stale.length > 0) {
    L.push('## Stale allowlist entries');
    L.push('');
    L.push(
      'These allowlist tables are no longer tenant-scoped in the migrations ' +
        '(or never were). Remove them so the gate stays honest.',
    );
    L.push('');
    for (const name of report.stale) L.push(`- \`${name}\``);
    L.push('');
  }

  return L.join('\n');
}

// ───────────────────────────────────────────────────────────────────
// CLI.
// ───────────────────────────────────────────────────────────────────

function main() {
  const json = process.argv.includes('--json');

  const tenantTables = findTenantScopedTables();
  const { sqlToVars, varToSql } = mapDrizzleVars(tenantTables);
  const queryFiles = collectQueryFiles();

  const allViolations = scanForViolations(queryFiles, sqlToVars, varToSql);
  const { blocking, allowed } = partitionByAllowlist(allViolations);
  const stale = findStaleAllowlist(tenantTables);

  // Deterministic ordering for stable reports / diffs.
  const byLoc = (a, b) =>
    a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file);
  blocking.sort(byLoc);
  allowed.sort(byLoc);
  stale.sort();

  const report = {
    scanner: 'tenant-predicate',
    scannedAt: new Date().toISOString(),
    totals: {
      tenantTables: tenantTables.size,
      mappedVars: varToSql.size,
      filesScanned: queryFiles.length,
      blocking: blocking.length,
      allowed: allowed.length,
      stale: stale.length,
    },
    blocking,
    allowed,
    stale,
  };

  ensureDir(REPORT_PATH);
  writeFileSync(REPORT_PATH, renderMarkdown(report));

  const passed = blocking.length === 0 && stale.length === 0;

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.error(
      `audit-tenant-predicate: ${tenantTables.size} tenant tables, ` +
        `${varToSql.size} mapped, ${queryFiles.length} files scanned — ` +
        `${blocking.length} suspected violation(s), ${allowed.length} allowlisted ` +
        `— ${passed ? 'PASS' : 'FAIL'}`,
    );
    for (const v of blocking.slice(0, 40)) {
      console.error(`  [${v.table}] ${v.op}  ${v.file}:${v.line}  ${v.snippet}`);
    }
    if (blocking.length > 40) {
      console.error(`  … and ${blocking.length - 40} more (see ${relative(ROOT, REPORT_PATH)})`);
    }
    for (const s of stale) {
      console.error(`  [STALE ALLOWLIST] ${s} — not a tenant-scoped table`);
    }
    console.error(`  report: ${relative(ROOT, REPORT_PATH)}`);
  }

  process.exit(passed ? 0 : 1);
}

try {
  main();
} catch (err) {
  console.error('audit-tenant-predicate: fatal error');
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(2);
}
