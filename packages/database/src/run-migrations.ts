/**
 * BOSSNYUMBA Migration Runner
 * Runs SQL migrations in order from src/migrations/
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATABASE_URL =
  process.env.DATABASE_URL ??
  (process.env.NODE_ENV === 'production'
    ? (() => {
        throw new Error('DATABASE_URL is required in production. Set it in .env');
      })()
    : 'postgresql://localhost:5432/bossnyumba');
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

async function runMigrations() {
  const sql = postgres(DATABASE_URL);

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
      const applied = await sql`
        SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${name}
      `;
      if (applied.length > 0) {
        console.warn('Skipping ' + file + ' (already applied)');
        continue;
      }

      console.warn('Running ' + file + '...');
      const safePath = resolveMigrationPath(file);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- path validated by resolveMigrationPath()
      const content = await readFile(safePath, 'utf-8');
      await sql.unsafe(content);
      await sql`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${name}, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
      `;
      console.warn('Applied ' + file);
    }

    console.warn('All migrations completed');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    await sql.end();
    process.exit(0);
  }
}

runMigrations();
