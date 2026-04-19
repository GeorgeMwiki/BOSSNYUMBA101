/**
 * Public entry point for @bossnyumba/lpms-connector.
 *
 * Consumers (notably `services/api-gateway/src/routes/migration.router.ts`)
 * import everything from this module — internal files are considered
 * implementation details.
 */

export * from './types.js';
export * from './adapter.js';
export * from './csv-adapter.js';
export * from './json-adapter.js';
export * from './xml-adapter.js';
