/**
 * BOSSNYUMBA Migration Runner (importable)
 *
 * Applies pending SQL migrations from `src/migrations/` in lexicographic
 * order (which matches our `NNNN_*.sql` naming convention). Tracks applied
 * migrations in `drizzle.__drizzle_migrations` so it plays nicely with
 * drizzle-kit-generated migrations.
 *
 * Usage as a library:
 *   import { runPendingMigrations } from '@bossnyumba/database';
 *   await runPendingMigrations(process.env.DATABASE_URL!);
 *
 * Usage as a CLI (services during deploy):
 *   pnpm --filter @bossnyumba/database db:migrate:apply
 *
 * This file supersedes the ad-hoc `run-migrations.ts` script for services
 * that want programmatic control (e.g. running at boot). The standalone
 * script is kept for backwards compatibility.
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface RunMigrationsOptions {
  /** Postgres connection string. Falls back to `process.env.DATABASE_URL`. */
  databaseUrl?: string;
  /** Directory containing the `NNNN_*.sql` migration files. Defaults to `./migrations` relative to this file. */
  migrationsDir?: string;
  /** Emit progress logs. Defaults to true. */
  verbose?: boolean;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/**
 * Apply all pending migrations in order. Idempotent: already-applied
 * migrations are skipped based on the `drizzle.__drizzle_migrations`
 * bookkeeping table.
 */
export async function runPendingMigrations(
  options: RunMigrationsOptions = {}
): Promise<MigrationResult> {
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'runPendingMigrations: databaseUrl not provided and DATABASE_URL env var is not set.'
    );
  }

  const migrationsDir = options.migrationsDir ?? join(__dirname, 'migrations');
  const verbose = options.verbose ?? true;

  const sql = postgres(databaseUrl, { max: 1 });
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    // Bookkeeping schema/table (same shape drizzle-kit uses)
    await sql.unsafe('CREATE SCHEMA IF NOT EXISTS drizzle');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
      )
    `);

    const files = await readdir(migrationsDir);
    const migrations = files
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    for (const file of migrations) {
      const name = file.replace(/\.sql$/, '');
      const already = await sql<{ exists: boolean }[]>`
        SELECT 1 AS exists FROM drizzle.__drizzle_migrations WHERE hash = ${name} LIMIT 1
      `;
      if (already.length > 0) {
        skipped.push(file);
        if (verbose) console.log(`[migrate] skip ${file} (already applied)`);
        continue;
      }

      if (verbose) console.log(`[migrate] apply ${file}`);
      const content = await readFile(join(migrationsDir, file), 'utf-8');

      // Each migration runs in its own transaction so partial application
      // cannot leave the bookkeeping table out of sync with the schema.
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES (${name}, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
        `;
      });

      applied.push(file);
      if (verbose) console.log(`[migrate] ok    ${file}`);
    }

    if (verbose) {
      console.log(
        `[migrate] done. applied=${applied.length} skipped=${skipped.length}`
      );
    }

    return { applied, skipped };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  runPendingMigrations()
    .then((result) => {
      if (result.applied.length === 0) {
        console.log('[migrate] no pending migrations.');
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('[migrate] FAILED:', err);
      process.exit(1);
    });
}
