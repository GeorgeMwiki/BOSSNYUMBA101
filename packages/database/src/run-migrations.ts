/**
 * BOSSNYUMBA Migration Runner
 * Runs SQL migrations in order from src/migrations/
 *
 * Exposed as `runMigrations()` so it can be invoked from a boot-time hook
 * (e.g. container entrypoint, api-gateway prestart) without forking a
 * child process. Also self-executes when run directly as a CLI via tsx.
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname, resolve, relative } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import postgres from 'postgres';
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(join(__dirname, 'migrations'));

/** Strict allowlist: files must be `<digits-or-letters>.sql` with no path chars. */
const SAFE_MIGRATION_NAME = /^[A-Za-z0-9_.-]+\.sql$/;

/**
 * Resolve a migration filename to an absolute path that is guaranteed to live
 * inside MIGRATIONS_DIR. Rejects traversal, absolute paths, and names that do
 * not match the allowlist. Prevents the `detect-non-literal-fs-filename` risk.
 */
function resolveMigrationPath(name: string): string {
  if (!SAFE_MIGRATION_NAME.test(name)) {
    throw new Error(`Rejected unsafe migration filename: ${name}`);
  }
  const abs = resolve(MIGRATIONS_DIR, name);
  const rel = relative(MIGRATIONS_DIR, abs);
  if (rel.startsWith('..') || rel.includes('..') || abs === MIGRATIONS_DIR) {
    throw new Error(`Migration path escapes migrations dir: ${name}`);
  }
  return abs;
}

/** Per-migration client-side deadline (ms) — far above any legitimate apply. */
const PER_MIGRATION_DEADLINE_MS = 300_000;

/**
 * Statements Postgres forbids inside an explicit transaction block. A migration
 * containing one is applied WITHOUT `sql.begin()` (relying on its own
 * auto-commit), trading atomicity for legality — these ops are inherently
 * non-transactional. Four shipped migrations use `CREATE INDEX CONCURRENTLY`
 * and one uses `REINDEX`/`VACUUM`, so this branch is load-bearing on a fresh DB.
 */
const NON_TRANSACTIONAL = /(?:CREATE|DROP)\s+INDEX\s+CONCURRENTLY|\bREINDEX\b|\bVACUUM\b/i;

/** True when `body` contains an op that cannot run inside a transaction. */
export function requiresOutOfTransaction(body: string): boolean {
  return NON_TRANSACTIONAL.test(body);
}

/**
 * Strip a leading `BEGIN;` and trailing `COMMIT;`/`END;` from a migration body,
 * tolerating leading comments/whitespace. Returns the body unchanged if no
 * wrapping transaction is found. postgres-js's `sql.unsafe()` rejects explicit
 * transaction control, yet 59 shipped migrations carry their own
 * `BEGIN; … COMMIT;` for psql/Supabase-editor compatibility; we strip it and
 * re-establish atomicity via `sql.begin()` at the call site. Exported for tests.
 */
export function stripWrappingTransaction(content: string): string {
  // Migration files are bounded — reject pathologically large inputs early so
  // the alternation-heavy leading-noise regex cannot be exploited (10 MB ceiling).
  if (content.length > 10_000_000) {
    throw new Error('Migration file exceeds 10 MB safety limit');
  }
  const leadingNoise = `(?:/\\*[\\s\\S]*?\\*/|--[^\\n]*\\n|\\s)*`;
  const beginRe = new RegExp(
    `^(${leadingNoise})(?:BEGIN(?:\\s+WORK)?|START\\s+TRANSACTION)\\s*;\\s*`,
    'i',
  );
  const commitRe =
    /\s*(?:COMMIT(?:\s+WORK)?|END)\s*;?\s*(?:--[^\n]*\n?|\/\*[\s\S]*?\*\/|\s)*$/i;
  if (!beginRe.test(content) || !commitRe.test(content)) {
    return content;
  }
  return content.replace(beginRe, '$1').replace(commitRe, '');
}

export interface RunMigrationsOptions {
  databaseUrl?: string;
  logger?: Pick<Console, 'warn' | 'error'>;
}

export interface RunMigrationsResult {
  applied: number;
  skipped: number;
}

/**
 * Resolve the DATABASE_URL, falling back to `process.env.DATABASE_URL`.
 * Throws if neither is set — callers (CLI entry, boot-time hook, tests) are
 * responsible for providing the URL explicitly.
 */
function resolveDatabaseUrl(opts?: RunMigrationsOptions): string {
  const url = opts?.databaseUrl ?? process.env.DATABASE_URL;
  if (!url || url.length === 0) {
    throw new Error('DATABASE_URL not set');
  }
  return url;
}

type Sql = ReturnType<typeof postgres>;

/**
 * Apply one (already transaction-stripped) migration body and record it in the
 * ledger, bounded by a client-side deadline so a driver-level wedge converts
 * into a loud, attributable error instead of hanging boot forever. A
 * CONCURRENTLY/VACUUM/REINDEX body runs outside a transaction (Postgres
 * requires it); everything else is wrapped in `sql.begin()` so the DDL apply
 * and the ledger insert commit atomically.
 */
async function applyOneMigration(
  sql: Sql,
  name: string,
  body: string,
): Promise<void> {
  const apply = requiresOutOfTransaction(body)
    ? (async () => {
        await sql.unsafe(body);
        await sql`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES (${name}, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
        `;
      })()
    : sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES (${name}, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
        `;
      });
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    deadlineTimer = setTimeout(
      () =>
        reject(
          new Error(
            `Migration ${name} did not settle within ${PER_MIGRATION_DEADLINE_MS}ms ` +
              '— aborting (apply via psql if the driver wedged).',
          ),
        ),
      PER_MIGRATION_DEADLINE_MS,
    );
  });
  try {
    await Promise.race([apply, deadline]);
  } finally {
    if (deadlineTimer) clearTimeout(deadlineTimer);
  }
}

export async function runMigrations(
  opts?: RunMigrationsOptions,
): Promise<RunMigrationsResult> {
  const databaseUrl = resolveDatabaseUrl(opts);
  const logger = opts?.logger ?? console;
  // Bound every migration so a pathological statement or a driver-level wedge
  // can never hang the runner indefinitely (a stalled from-scratch apply would
  // otherwise block container boot forever with no diagnostic). The ceilings sit
  // far above any legitimate fresh-DB migration, so they never false-trip — they
  // only convert an unbounded hang into a loud, attributable error. `max: 1`
  // keeps the sequential apply on one connection so these session GUCs bind to
  // the connection doing the work; `prepare: false` avoids the prepared-statement
  // cache wedging a long-lived connection after many one-shot DDL statements.
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connection: {
      statement_timeout: 600_000, // 10 min per-statement ceiling
      idle_in_transaction_session_timeout: 300_000, // 5 min idle-in-txn ceiling
    },
  });

  let applied = 0;
  let skipped = 0;

  try {
    await sql.unsafe('CREATE SCHEMA IF NOT EXISTS drizzle');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
      )
    `);

    const files = await readdir(MIGRATIONS_DIR);
    const migrations = files
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    for (const file of migrations) {
      const name = file.replace('.sql', '');
      const alreadyApplied = await sql`
        SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${name}
      `;
      if (alreadyApplied.length > 0) {
        logger.warn('Skipping ' + file + ' (already applied)');
        skipped += 1;
        continue;
      }

      logger.warn('Running ' + file + '...');
      const safePath = resolveMigrationPath(file);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path validated by resolveMigrationPath()
      const content = await readFile(safePath, 'utf-8');
      // Strip any self-wrapping BEGIN/COMMIT (postgres-js rejects explicit
      // transaction control); applyOneMigration re-wraps in sql.begin() for
      // atomicity, or runs out-of-transaction for CONCURRENTLY/VACUUM/REINDEX.
      const body = stripWrappingTransaction(content);
      await applyOneMigration(sql, name, body);
      logger.warn('Applied ' + file);
      applied += 1;
    }

    logger.warn('All migrations completed');
    return { applied, skipped };
  } catch (err) {
    logger.error('Migration failed:', err);
    throw err;
  } finally {
    // Bound teardown too: a wedged connection must not block process exit.
    await sql.end({ timeout: 5 });
  }
}

// Detect "run as CLI" robustly. Comparing `file://${argv[1]}` directly breaks
// on paths containing spaces (`import.meta.url` percent-encodes them; argv
// does not), so route both through `pathToFileURL`.
const isCliEntry = (() => {
  if (typeof process === 'undefined' || !Array.isArray(process.argv)) {
    return false;
  }
  const entry = process.argv[1];
  if (typeof entry !== 'string' || entry.length === 0) {
    return false;
  }
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
})();

if (isCliEntry) {
  runMigrations()
    .then((r) => {
      logger.warn(`[migrations] applied=${r.applied} skipped=${r.skipped}`);
      process.exit(0);
    })
    .catch((err) => {
      logger.error('[migrations] failed', { error: err });
      process.exit(1);
    });
}
