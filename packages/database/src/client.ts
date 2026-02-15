import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schemas/index.js';

export function createDatabaseClient(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
