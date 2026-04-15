/**
 * Database access helpers for retention adapters.
 *
 * Uses the drizzle client exported by @bossnyumba/database. We run retention
 * sweeps as raw SQL because:
 *   - We need a tolerant "table exists?" check (adapters must no-op on
 *     missing tables, not crash).
 *   - The expressive part is the cutoff filter + legal_hold exemption; no
 *     ORM leverage is needed.
 *   - We want a single place to apply batch limits and retry RETURNING id
 *     for audit logging.
 */

import { createDatabaseClient, type DatabaseClient } from '@bossnyumba/database';
import { sql } from 'drizzle-orm';

export type Db = DatabaseClient;

let client: Db | null = null;

export function getDb(databaseUrl?: string): Db {
  if (client) return client;
  const url = databaseUrl ?? process.env['DATABASE_URL'];
  if (!url) {
    throw new Error(
      'DATABASE_URL is required for the retention worker to connect to Postgres'
    );
  }
  client = createDatabaseClient(url);
  return client;
}

export async function tableExists(db: Db, tableName: string): Promise<boolean> {
  const res = (await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${tableName}
    ) AS exists
  `)) as unknown as Array<{ exists: boolean }>;
  return Boolean(res?.[0]?.exists);
}

export async function columnExists(
  db: Db,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const res = (await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
        AND column_name = ${columnName}
    ) AS exists
  `)) as unknown as Array<{ exists: boolean }>;
  return Boolean(res?.[0]?.exists);
}

/**
 * Run a COUNT query with a WHERE clause fragment, returning the row count.
 * Used by adapters in dry-run mode.
 */
export async function countWhere(
  db: Db,
  tableName: string,
  whereFragment: ReturnType<typeof sql>
): Promise<number> {
  const query = sql`SELECT COUNT(*)::int AS c FROM ${sql.identifier(tableName)} WHERE ${whereFragment}`;
  const res = (await db.execute(query)) as unknown as Array<{ c: number }>;
  return res?.[0]?.c ?? 0;
}
