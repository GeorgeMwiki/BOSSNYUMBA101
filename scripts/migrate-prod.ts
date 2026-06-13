#!/usr/bin/env node
/**
 * migrate-prod.ts — THIN WRAPPER around the single canonical migration runner.
 *
 * There is exactly ONE migration ledger in this repo:
 *   `packages/database/src/run-migrations.ts` → `drizzle.__drizzle_migrations`
 *
 * This file used to maintain a SECOND, divergent ledger (`_migrations`, keyed
 * by version + sha256 + operator_env). Two ledgers meant a prod box that had
 * already been migrated via `db:migrate` would see an empty `_migrations`
 * table and RE-APPLY the entire chain. That dual-ledger hazard is now removed:
 * apply is delegated to the canonical `runMigrations()`, which is idempotent
 * against `drizzle.__drizzle_migrations` (used by CI, container boot, and the
 * Helm migration job). This wrapper exists only so the documented operator
 * entry point (`scripts/migrate-prod.sh`) keeps a stable CLI surface.
 *
 * Usage:
 *   tsx scripts/migrate-prod.ts [--dry-run] [--json]
 *
 * Environment:
 *   DATABASE_URL   required in production (no implicit fallback there)
 *
 * Exit codes (unchanged): 0 applied, 1 error, 2 already-up-to-date.
 *
 * NOTE: `loadMigrations` / `planMigrations` are pure helpers (filename parsing,
 * sha256 hashing, pending-set diffing) retained for unit tests and the
 * `--dry-run` plan. They do NOT write any ledger; only `runMigrations()` does,
 * and it writes the single canonical `drizzle.__drizzle_migrations` table.
 */

import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import postgres from 'postgres';
import { runMigrations } from '../packages/database/src/run-migrations.js';

const SAFE_MIGRATION_NAME = /^\d{4}[A-Za-z0-9_.-]*\.sql$/;

export interface MigrationEntry {
  readonly filename: string;
  readonly version: string;
  readonly sha256: string;
  readonly sql: string;
}

export interface MigrationPlan {
  readonly all: readonly MigrationEntry[];
  readonly applied: readonly string[];
  readonly pending: readonly MigrationEntry[];
}

interface RunnerOpts {
  readonly dryRun: boolean;
  readonly json: boolean;
  readonly migrationsDir: string;
}

function parseOpts(argv: readonly string[]): RunnerOpts {
  const dryRun = argv.includes('--dry-run');
  const json = argv.includes('--json');
  const migrationsDir = resolve(
    process.cwd(),
    'packages/database/src/migrations',
  );
  return { dryRun, json, migrationsDir };
}

/**
 * Pure: list + validate + hash every `*.sql` migration in `dir`, sorted by
 * filename. No DB access. Retained for unit tests and the dry-run plan.
 */
export async function loadMigrations(dir: string): Promise<MigrationEntry[]> {
  const entries = await readdir(dir);
  const valid = entries
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
  const out: MigrationEntry[] = [];
  for (const name of valid) {
    if (!SAFE_MIGRATION_NAME.test(name)) {
      throw new Error(`Rejected unsafe migration filename: ${name}`);
    }
    const abs = resolve(dir, name);
    const rel = relative(dir, abs);
    if (rel.startsWith('..') || rel.includes('..')) {
      throw new Error(`Migration path escapes dir: ${name}`);
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- validated above
    const sql = await readFile(abs, 'utf8');
    const version = name.replace(/\.sql$/, '');
    const sha256 = createHash('sha256').update(sql).digest('hex');
    out.push({ filename: name, version, sha256, sql });
  }
  return out;
}

/**
 * Pure: diff the on-disk migration set against the list of already-applied
 * versions to compute the pending set. No DB access.
 */
export function planMigrations(
  all: readonly MigrationEntry[],
  applied: readonly string[],
): MigrationPlan {
  const appliedSet = new Set(applied);
  const pending = all.filter((m) => !appliedSet.has(m.version));
  return { all, applied, pending };
}

/**
 * Read the CANONICAL ledger (`drizzle.__drizzle_migrations`, hash-keyed by
 * filename-without-extension) to learn which versions are already applied.
 * Used only by the dry-run plan; the real apply path is `runMigrations()`.
 */
async function listAppliedCanonical(connectionString: string): Promise<string[]> {
  const sql = postgres(connectionString, { max: 2, onnotice: () => {} });
  try {
    const exists = await sql<{ ok: boolean }[]>`
      SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS ok
    `;
    if (!exists[0]?.ok) {
      return [];
    }
    const rows = await sql<{ hash: string }[]>`
      SELECT hash FROM drizzle.__drizzle_migrations ORDER BY hash ASC
    `;
    return rows.map((r) => r.hash);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main(): Promise<void> {
  const opts = parseOpts(process.argv.slice(2));
  const dsn = process.env.DATABASE_URL;
  if (!dsn && process.env.NODE_ENV === 'production') {
    process.stderr.write('DATABASE_URL is required in production\n');
    process.exit(1);
  }
  const connectionString = dsn ?? 'postgresql://localhost:5432/bossnyumba';

  try {
    if (opts.dryRun) {
      const all = await loadMigrations(opts.migrationsDir);
      const applied = await listAppliedCanonical(connectionString);
      const plan = planMigrations(all, applied);
      if (opts.json) {
        process.stdout.write(
          `${JSON.stringify({
            ledger: 'drizzle.__drizzle_migrations',
            total: plan.all.length,
            applied: plan.applied.length,
            pending: plan.pending.map((m) => m.filename),
          })}\n`,
        );
      } else {
        process.stdout.write(
          `migrations (dry-run): total=${plan.all.length} ` +
            `already-applied=${plan.applied.length} ` +
            `pending=${plan.pending.length}\n`,
        );
        for (const m of plan.pending) {
          process.stdout.write(`  would-apply: ${m.filename}\n`);
        }
      }
      process.exit(plan.pending.length === 0 ? 2 : 0);
    }

    // Real apply → delegate to the single canonical runner (idempotent,
    // hash-keyed against drizzle.__drizzle_migrations). No second ledger.
    const result = await runMigrations({ databaseUrl: connectionString });
    if (opts.json) {
      process.stdout.write(
        `${JSON.stringify({
          ledger: 'drizzle.__drizzle_migrations',
          applied: result.applied,
          skipped: result.skipped,
        })}\n`,
      );
    } else {
      process.stdout.write(
        `migrations: applied=${result.applied} skipped=${result.skipped}\n`,
      );
    }
    process.exit(result.applied === 0 ? 2 : 0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`migrate-prod failed: ${msg}\n`);
    process.exit(1);
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  void main();
}
