/**
 * Prompt caching — 1h opt-in wrapper.
 *
 * Default cache TTL dropped from 1h to 5min in 2026; this module is
 * the explicit 1h opt-in. Closes M-A task #19 follow-up.
 *
 * Closes L2 #9.
 */

export {
  wrapStablePrefix,
  wrapStablePrefixes,
  betasForCacheTtl,
  summariseCacheUtilization,
  ONE_HOUR_OPT_IN_SNIPPET,
  DEFAULT_TTL_SECONDS,
  type CacheControlWrapperOptions,
  type CacheUsageReport,
} from './cache-control.js';
