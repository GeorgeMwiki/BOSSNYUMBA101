/**
 * `@bossnyumba/timezone-detection` — public barrel.
 *
 * Full surface is wired up in subsequent commits. This first commit
 * ships scaffolding + types + the detection pipeline.
 */

export * from './types.js';
export * from './detect/index.js';
export {
  ALL_JURISDICTION_DEFAULTS,
  AFRICA_DEFAULTS,
  REST_OF_WORLD_DEFAULTS,
  JURISDICTION_DEFAULTS_COUNT,
  getJurisdictionDefault,
} from './jurisdiction-defaults/index.js';
