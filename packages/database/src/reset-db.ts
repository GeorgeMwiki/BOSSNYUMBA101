/**
 * BOSSNYUMBA Database Reset
 * Drops all tables and re-runs migrations + seed.
 * WARNING: Destructive - use only in development!
 */

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PKG_ROOT = __dirname.replace(/\/src$/, '');
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/bossnyumba';

async function reset() {
  const sql = postgres(DATABASE_URL);

  try {
    console.log('Dropping all tables...');
    await sql.unsafe(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO public;
      DROP SCHEMA IF EXISTS drizzle CASCADE;
    `);
    console.log('Database reset. Running migrations...');
  } catch (err) {
    console.error('Reset failed:', err);
    throw err;
  } finally {
    await sql.end();
  }

  const { spawn } = await import('child_process');
  const migrate = spawn('tsx', ['src/run-migrations.ts'], {
    cwd: DB_PKG_ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  migrate.on('close', (code) => {
    if (code !== 0) process.exit(code ?? 1);
    const seed = spawn('tsx', ['src/seed.ts'], {
      cwd: DB_PKG_ROOT,
      stdio: 'inherit',
      env: process.env,
    });
    seed.on('close', (c) => process.exit(c ?? 0));
  });
}

reset();
