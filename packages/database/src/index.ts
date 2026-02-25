/**
 * BOSSNYUMBA Database Package
 * Database client, schemas, repositories, and Supabase integration
 */

export { createDatabaseClient, type DatabaseClient } from './client.js';
export * from './schemas/index.js';
export * from './repositories/index.js';

// Supabase client (BOSSNYUMBA's own project - never shared)
export {
  createServerSupabaseClient,
  createBrowserSupabaseClient,
  createAnonSupabaseClient,
  isSupabaseAvailable,
} from './supabase-client.js';
