#!/usr/bin/env node
/**
 * verify-migrations — migration ledger-drift guard (KI-001 / KI-004).
 *
 * THE BUG THIS CATCHES
 * --------------------
 * Drizzle records a migration as applied by inserting its hash into
 * `drizzle.__drizzle_migrations`. If the `CREATE TABLE` statements inside
 * that migration never actually executed against the live DB — a prior DB
 * surgery, a partial rollback, or a from-scratch run that aborted mid-way —
 * the ledger STILL claims the migration succeeded, and drizzle will never
 * re-run it (it short-circuits on the recorded hash). The table is silently
 * missing and the only symptom in prod is a runtime
 * `relation "<name>" does not exist` (see KI-001, KI-004 in
 * Docs/KNOWN_ISSUES.md).
 *
 * WHAT THIS SCRIPT DOES
 * ---------------------
 *   1. Reads every `*.sql` under --migrations-dir and static-parses the union
 *      of tables promised via `CREATE TABLE [IF NOT EXISTS] [public.]<name>`
 *      (the set that SHOULD exist). Comment / string-literal aware so a table
 *      name mentioned only inside a `-- ...` line or a quoted value never
 *      counts. Transient forms (TEMP / UNLOGGED) and the non-base forms
 *      (PARTITION OF, AS SELECT, dynamic EXECUTE) are intentionally skipped.
 *   2. Connects to $DATABASE_URL (postgres-js, the driver the repo already
 *      depends on) and probes each expected table with
 *      `to_regclass('public.<name>')`. A NULL result = the table is missing
 *      = ledger drift.
 *   3. Reads `drizzle.__drizzle_migrations` (when present) and reports the
 *      recorded hashes for visibility — so an operator can immediately see
 *      "ledger says applied, table absent".
 *   4. Emits a markdown report (and writes it to --report). Exit 0 when no
 *      drift; non-zero when ANY expected table is missing. When
 *      NODE_ENV=production and drift is found it exits non-zero with a loud
 *      "REFUSING: schema drift detected" banner so a deploy/boot wrapper can
 *      halt the rollout (fail-closed).
 *   5. When $DATABASE_URL is unset it prints a "needs DATABASE_URL" notice
 *      and exits 0 (skip) — identical to migration-apply-check, so it is safe
 *      to wire into CI stages that have no database.
 *
 * CLI:
 *   node scripts/verify-migrations.mjs \
 *     --migrations-dir=packages/database/src/migrations \
 *     --db-url=$DATABASE_URL \
 *     [--report=.audit/migration-drift.md]
 *
 * Exit codes:
 *   0  no drift (every expected table present), OR skipped (no DATABASE_URL)
 *   1  drift detected (one or more expected tables missing)
 *   2  harness error (migrations dir missing, driver missing, DB unreachable)
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
  statSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

const DEFAULTS = {
  migrationsDir: 'packages/database/src/migrations',
  dbUrl: process.env.DATABASE_URL || '',
  report: '.audit/migration-drift.md',
};

function parseArgs(argv) {
  const args = { ...DEFAULTS };
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const eq = raw.indexOf('=');
    const key = eq === -1 ? raw.slice(2) : raw.slice(2, eq);
    const value = eq === -1 ? 'true' : raw.slice(eq + 1);
    switch (key) {
      case 'migrations-dir':
        args.migrationsDir = value;
        break;
      case 'db-url':
        args.dbUrl = value;
        break;
      case 'report':
        args.report = value;
        break;
      case 'help':
      case 'h':
        printHelp();
        process.exit(0);
        break;
      default:
        // Tolerate unknown flags so the script can be wired into varied CI.
        break;
    }
  }
  return args;
}

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(
    [
      'verify-migrations — migration ledger-drift guard',
      '',
      'Usage:',
      '  node scripts/verify-migrations.mjs [flags]',
      '',
      'Flags:',
      '  --migrations-dir=<path>  default packages/database/src/migrations',
      '  --db-url=<url>           optional, fallback $DATABASE_URL',
      '  --report=<path>          default .audit/migration-drift.md',
      '',
      'Exit codes:',
      '  0  no drift, or skipped (no DATABASE_URL)',
      '  1  drift detected (expected table(s) missing)',
      '  2  harness error',
    ].join('\n'),
  );
}

// ---------------------------------------------------------------------------
// SQL parsing — self-contained (mirrors packages/database/src/migration-drift.ts
// and the comment scanner in validate-migration-safety.mjs; an audit script
// must run under bare `node` with zero build step, so it cannot import the
// package's TypeScript source). The shared-logic-equivalence is locked by
// scripts/__tests__/verify-migrations.test.ts.
// ---------------------------------------------------------------------------

/** Strip `-- line`, `/* block *\/`, and `'string'` bodies from SQL. */
export function stripSqlNoise(sql) {
  let out = '';
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    const nx = sql[i + 1];
    if (c === '-' && nx === '-') {
      while (i < n && sql[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && nx === '*') {
      i += 2;
      while (i < n && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
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

function unquoteIdent(raw) {
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1);
  }
  return raw;
}

/**
 * Parse every base-table `CREATE TABLE [IF NOT EXISTS] [<schema>.]<name>`
 * from one SQL body. Skips TEMP/UNLOGGED tables; the required trailing `(`
 * excludes PARTITION OF / AS SELECT forms. Returns bare lower-cased names.
 */
export function parseTableNames(sql) {
  const cleaned = stripSqlNoise(sql);
  const rx =
    /\bcreate\s+(?:(temp|temporary|unlogged|global)\s+)?table\s+(?:if\s+not\s+exists\s+)?(?:(?:"[^"]+"|\w+)\.)?("[^"]+"|\w+)\s*\(/gi;
  const names = [];
  const seen = new Set();
  let m;
  while ((m = rx.exec(cleaned)) !== null) {
    if (m[1]) continue; // transient table — not a durable base table
    const name = unquoteIdent(m[2]).toLowerCase();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

/**
 * Parse all migration files into the de-duplicated, sorted expected-table
 * list, each tagged with the first migration that declared it.
 */
export function parseExpectedTables(files) {
  const byName = new Map();
  for (const file of files) {
    for (const table of parseTableNames(file.sql)) {
      if (!byName.has(table)) byName.set(table, file.name);
    }
  }
  return [...byName.entries()]
    .map(([name, migration]) => ({ name, migration }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function readMigrationFiles(dir) {
  const abs = resolve(ROOT, dir);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) {
    throw new Error(`Migrations dir not found: ${abs}`);
  }
  return readdirSync(abs)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      sql: readFileSync(join(abs, name), 'utf8'),
    }));
}

// ---------------------------------------------------------------------------
// Live DB probe
// ---------------------------------------------------------------------------

/**
 * For each expected table run `to_regclass('public.<name>')`; a NULL means
 * the relation does not exist (= drift). Also read the migration ledger for
 * visibility. Returns `{ missing, ledgerHashes, ledgerPresent }`.
 *
 * `to_regclass` is parameterised as a single text argument and never string-
 * interpolates the table name, so a hostile filename can't inject SQL (the
 * names come from our own migration tree, but we keep the query injection-safe
 * regardless).
 */
async function probeDb(dbUrl, expected) {
  let pg;
  try {
    pg = await import('postgres');
  } catch {
    throw new Error(
      "the 'postgres' package is not installed — cannot probe the database",
    );
  }
  const sql = pg.default(dbUrl, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
    connect_timeout: 10,
  });

  try {
    const missing = [];
    for (const { name } of expected) {
      // to_regclass returns NULL (not an error) when the relation is absent.
      const rows = await sql`
        select to_regclass(${'public.' + name})::text as reg
      `;
      const reg = rows[0]?.reg ?? null;
      if (reg === null) {
        missing.push(name);
      }
    }

    // Ledger read — best-effort, for visibility only.
    let ledgerPresent = false;
    let ledgerHashes = [];
    const ledgerExists = await sql`select to_regclass('drizzle.__drizzle_migrations')::text as reg`;
    if ((ledgerExists[0]?.reg ?? null) !== null) {
      ledgerPresent = true;
      const hashRows = await sql`
        select hash from drizzle.__drizzle_migrations order by id asc
      `;
      ledgerHashes = hashRows.map((r) => r.hash);
    }

    return { missing, ledgerPresent, ledgerHashes };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------

function renderMarkdown({ expected, missing, ledgerPresent, ledgerHashes, skipped, isProd }) {
  const lines = ['# Migration Drift Report', ''];
  if (skipped) {
    lines.push('**Status:** SKIPPED (no DATABASE_URL)');
    lines.push('');
    lines.push(
      'No `$DATABASE_URL` was provided, so the live `to_regclass` drift probe ' +
        'was not run. This is a no-op pass — safe in CI stages without a DB.',
    );
    lines.push('');
    lines.push(`**Expected tables parsed from migrations:** ${expected.length}`);
    lines.push('');
    return lines.join('\n');
  }

  const status = missing.length === 0 ? 'PASS — no drift' : 'FAIL — drift detected';
  lines.push(`**Status:** ${status}`);
  lines.push(`**Environment:** ${isProd ? 'production' : 'non-production'}`);
  lines.push(`**Expected tables (from migrations):** ${expected.length}`);
  lines.push(`**Missing (expected but absent in DB):** ${missing.length}`);
  lines.push(
    `**Migration ledger:** ${
      ledgerPresent
        ? `${ledgerHashes.length} hash(es) recorded in drizzle.__drizzle_migrations`
        : 'drizzle.__drizzle_migrations not found'
    }`,
  );
  lines.push('');

  if (missing.length === 0) {
    lines.push(
      'Every table promised by the migration tree exists in `public`. No ledger drift.',
    );
    lines.push('');
    return lines.join('\n');
  }

  lines.push('## Missing tables (LEDGER DRIFT)');
  lines.push('');
  lines.push(
    'Each table below is created by a migration in the tree but is absent ' +
      'from the live database. If its migration hash also appears as applied ' +
      'in the ledger, drizzle will NOT re-run it — re-apply the owning ' +
      '`.sql` file by hand (they are `IF NOT EXISTS`-guarded, so re-running is ' +
      'safe), then re-run this check.',
  );
  lines.push('');
  for (const { name, migration } of missing) {
    const recorded =
      ledgerPresent && ledgerHashes.includes(migration.replace(/\.sql$/, ''))
        ? ' — **ledger records this migration as APPLIED (silent drift)**'
        : '';
    lines.push(`- \`${name}\` (from \`${migration}\`)${recorded}`);
  }
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const isProd = process.env.NODE_ENV === 'production';

  let files;
  try {
    files = readMigrationFiles(args.migrationsDir);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Harness error: ${err.message}`);
    process.exit(2);
  }

  const expected = parseExpectedTables(files);

  // No DB → skip (safe no-op for DB-less CI), identical to migration-apply-check.
  if (!args.dbUrl) {
    const md = renderMarkdown({ expected, missing: [], skipped: true, isProd });
    writeReport(args.report, md);
    // eslint-disable-next-line no-console
    console.log(
      `verify-migrations: needs DATABASE_URL to probe the DB — skipping ` +
        `(parsed ${expected.length} expected tables, no drift check run).`,
    );
    process.exit(0);
  }

  let result;
  try {
    result = await probeDb(args.dbUrl, expected);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Harness error: ${err.message}`);
    process.exit(2);
  }

  // Re-attach the owning migration to each missing table for the report.
  const expectedByName = new Map(expected.map((e) => [e.name, e.migration]));
  const missing = result.missing.map((name) => ({
    name,
    migration: expectedByName.get(name) ?? '(unknown)',
  }));

  const md = renderMarkdown({
    expected,
    missing,
    ledgerPresent: result.ledgerPresent,
    ledgerHashes: result.ledgerHashes,
    skipped: false,
    isProd,
  });
  writeReport(args.report, md);
  // eslint-disable-next-line no-console
  console.log('\n' + md);

  if (missing.length === 0) {
    // eslint-disable-next-line no-console
    console.log(
      `verify-migrations: OK — all ${expected.length} expected tables present.`,
    );
    process.exit(0);
  }

  if (isProd) {
    // Loud, greppable banner so a deploy/boot wrapper can halt the rollout.
    // eslint-disable-next-line no-console
    console.error(
      `\nREFUSING: schema drift detected — ${missing.length} expected table(s) ` +
        `missing from the database while NODE_ENV=production. ` +
        `Halting before serving traffic. Missing: ${missing
          .map((m) => m.name)
          .join(', ')}`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.error(
      `verify-migrations: DRIFT — ${missing.length} expected table(s) missing: ` +
        `${missing.map((m) => m.name).join(', ')}`,
    );
  }
  process.exit(1);
}

function writeReport(reportPath, md) {
  if (!reportPath) return;
  const abs = resolve(ROOT, reportPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, md, 'utf8');
}

// ESM main-guard — only run main() when invoked as a CLI, never on import
// (the tests import the pure parser helpers without the CLI side-effects).
const isCli =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isCli) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`fatal: ${err.stack || err.message || err}`);
    process.exit(2);
  });
}
