/**
 * Prompt caching 1h opt-in.
 *
 * **Background**: in 2026 Anthropic dropped the default cache TTL from
 * 1h to 5min. For BOSSNYUMBA's long-lived stable prefixes (system
 * prompts, lease templates, tenant playbooks, KRA SOP) the 5min default
 * would cause cache evictions between user turns — defeating the entire
 * point of caching.
 *
 * **Fix**: wrap every stable-prefix segment with
 *
 *   cache_control: { type: 'ephemeral', ttl_seconds: 3600 }
 *
 * This is the "extended-cache-ttl-2025-04-11" opt-in. Closes the M-A
 * task-#19 follow-up.
 *
 * **Telemetry**: cache-TTL utilization is logged for every wrapped
 * prefix so we can catch the case where a 5min eviction *would* have
 * hurt — that's the signal we need 1h after all.
 *
 * Closes L2 #9.
 */

import type {
  CacheControlBlock,
  CacheUtilizationTelemetry,
  CachedPrefixSegment,
  ClaudeModelId,
} from '../types.js';

const ONE_HOUR_SECONDS = 3600 as const;
const FIVE_MIN_SECONDS = 300 as const;
const EXTENDED_TTL_BETA = 'extended-cache-ttl-2025-04-11' as const;

/** Default for stable prefixes. Always 1h unless explicitly overridden. */
export const DEFAULT_TTL_SECONDS: 3600 = ONE_HOUR_SECONDS;

export interface CacheControlWrapperOptions {
  /** Defaults to 3600 (1h opt-in). Per-prefix override allowed. */
  readonly ttlSeconds?: 300 | 3600;
}

/**
 * Wrap a stable prefix segment with `cache_control`.
 *
 * Always sets `type: 'ephemeral'`. TTL defaults to 1h — the 2026 nerf
 * workaround — but can be overridden to 5min for cheap-to-recompute
 * segments.
 */
export function wrapStablePrefix(
  content: string,
  options: CacheControlWrapperOptions = {},
): CachedPrefixSegment {
  const ttl = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const block: CacheControlBlock = { type: 'ephemeral', ttl_seconds: ttl };
  return { content, cache_control: block };
}

/**
 * Wrap multiple stable segments at once. Anthropic supports up to 4
 * `cache_control` breakpoints per request — we enforce that here.
 */
export function wrapStablePrefixes(
  contents: ReadonlyArray<string>,
  options: CacheControlWrapperOptions = {},
): ReadonlyArray<CachedPrefixSegment> {
  if (contents.length > 4) {
    throw new Error(
      `Anthropic supports up to 4 cache_control breakpoints; received ${contents.length}`,
    );
  }
  return contents.map((c) => wrapStablePrefix(c, options));
}

/**
 * Return the beta header required when ttl_seconds=3600 is supplied.
 *
 * (The 5min default needs no beta header.)
 */
export function betasForCacheTtl(ttlSeconds: 300 | 3600): ReadonlyArray<string> {
  return ttlSeconds === ONE_HOUR_SECONDS ? [EXTENDED_TTL_BETA] : [];
}

export interface CacheUsageReport {
  readonly cacheCreationTokens: number;
  readonly cacheReadTokens: number;
  readonly ttlSeconds: 300 | 3600;
  readonly model: ClaudeModelId;
  readonly correlationId: string;
  /** ms since the cache segment was first written. */
  readonly elapsedMs: number;
}

/**
 * Telemetry: compute cache-utilization summary. Critically logs whether a
 * 5min TTL would have evicted (caller's stable prefix lived longer than
 * 300s but we're on 5min — we should have been on 1h).
 */
export function summariseCacheUtilization(
  report: CacheUsageReport,
): CacheUtilizationTelemetry {
  const totalTokens = report.cacheCreationTokens + report.cacheReadTokens;
  const hitRate =
    totalTokens > 0 ? report.cacheReadTokens / totalTokens : 0;
  const would5MinHaveEvicted =
    report.ttlSeconds === FIVE_MIN_SECONDS && report.elapsedMs > 5 * 60_000;

  return {
    correlationId: report.correlationId,
    ttlSeconds: report.ttlSeconds,
    cacheCreationTokens: report.cacheCreationTokens,
    cacheReadTokens: report.cacheReadTokens,
    hitRate,
    would5MinHaveEvicted,
    model: report.model,
  };
}

/**
 * The 1h opt-in code snippet — exported as a string so other modules
 * can include it in audit / docs / runbooks.
 */
export const ONE_HOUR_OPT_IN_SNIPPET: string = [
  '// 1h prompt-cache opt-in (closes 2026 TTL nerf workaround)',
  "import { wrapStablePrefix, betasForCacheTtl } from '@bossnyumba/max-tool-use/cache-control';",
  '',
  'const systemPromptSeg = wrapStablePrefix(SYSTEM_PROMPT);',
  '// systemPromptSeg.cache_control = { type: "ephemeral", ttl_seconds: 3600 }',
  '',
  'const betas = betasForCacheTtl(systemPromptSeg.cache_control.ttl_seconds);',
  '// betas = ["extended-cache-ttl-2025-04-11"]',
  '',
  'await client.beta.messages.create({',
  '  model: "claude-opus-4-7",',
  '  betas,',
  '  system: [{ type: "text", text: systemPromptSeg.content,',
  '             cache_control: systemPromptSeg.cache_control }],',
  '  messages: [...],',
  '});',
].join('\n');
