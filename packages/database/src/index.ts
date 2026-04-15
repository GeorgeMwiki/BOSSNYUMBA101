/**
 * BOSSNYUMBA Database Package
 * Database client, schemas, and repositories
 */

export { createDatabaseClient, type DatabaseClient } from './client.js';
export * from './schemas/index.js';
export * from './repositories/index.js';
export {
  runPendingMigrations,
  type RunMigrationsOptions,
  type MigrationResult,
} from './migrate.js';
