/**
 * BOSSNYUMBA Migration Runner
 * Runs SQL migrations in order from src/migrations/
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/bossnyumba';
const MIGRATIONS_DIR = join(__dirname, 'migrations');

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
        console.log('Skipping ' + file + ' (already applied)');
        continue;
      }

      console.log('Running ' + file + '...');
      const content = await readFile(join(MIGRATIONS_DIR, file), 'utf-8');
      await sql.unsafe(content);
      await sql`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${name}, (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)
      `;
      console.log('Applied ' + file);
    }

    console.log('All migrations completed');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    await sql.end();
    process.exit(0);
  }
}

runMigrations();
