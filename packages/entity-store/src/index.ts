/**
 * @bossnyumba/entity-store — public surface.
 *
 * Phase J1 universal entity-store substrate. Backed by migrations 0167
 * (core tables + RLS) and 0168 (registry seed) once they run.
 *
 * Subpath imports:
 *   import { ... } from '@bossnyumba/entity-store/types'
 *   import { ... } from '@bossnyumba/entity-store/repository'
 *   import { ... } from '@bossnyumba/entity-store/service'
 *   import { ... } from '@bossnyumba/entity-store/registry'
 *
 * Or import everything from the package root.
 */

export * from './types/index.js';
export * from './registry/index.js';
export * from './repository/index.js';
export * from './service/index.js';
