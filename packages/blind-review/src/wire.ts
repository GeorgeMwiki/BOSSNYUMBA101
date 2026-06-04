/**
 * Blind-review engine — composition root (default-OFF feature flag).
 *
 * The engine ships behind a flag that is OFF unless explicitly enabled. This
 * package stays ENV-FREE: it never reads `process.env`. The caller (the
 * api-gateway composition root) reads the flag
 * `BOSSNYUMBA_FEATURE_BLIND_REVIEW` and passes the resolved boolean as
 * `deps.enabled`. When the flag is off, {@link wireBlindReview} returns
 * `null` and the gateway simply never mounts the blind-review route or CI
 * gate.
 *
 * The returned {@link BlindReview} is a thin, dependency-bound facade over
 * {@link runBlindReview}: the host calls `panel.handle(request)` without
 * re-threading ports each time. A malformed request is rejected at the zod
 * boundary by returning `null` — never by throwing into the caller.
 *
 * @module @bossnyumba/blind-review/wire
 */

import {
  runBlindReviewRequestSchema,
  type BlindReviewReport,
  type RunBlindReviewRequest,
} from './types';
import {
  runBlindReview,
  type BlindReviewEngineDeps,
  type BlindReviewRunOptions,
} from './engine';

/** The canonical feature-flag name. READ BY THE CALLER, never by this package. */
export const BLIND_REVIEW_FLAG = 'BOSSNYUMBA_FEATURE_BLIND_REVIEW' as const;

/**
 * Dependencies for {@link wireBlindReview}. Extends the engine deps with a
 * single `enabled` boolean that the caller derives from the feature flag.
 */
export interface WireBlindReviewDeps extends BlindReviewEngineDeps {
  /**
   * Resolved value of `BOSSNYUMBA_FEATURE_BLIND_REVIEW`. The composition
   * root computes `flagValue === 'on'` and passes the boolean here; this
   * package never touches the environment itself.
   */
  readonly enabled: boolean;
}

/** Dependency-bound blind-review facade returned by {@link wireBlindReview}. */
export interface BlindReview {
  /**
   * Run one synthetic indistinguishability panel and return the report. The
   * request is validated at the boundary with zod; a malformed payload
   * yields `null` (rejected) rather than throwing into the caller.
   */
  handle(request: RunBlindReviewRequest): Promise<BlindReviewReport | null>;
}

/**
 * Wire the blind-review engine behind its feature flag.
 *
 * Returns a bound {@link BlindReview} when `deps.enabled` is true, or `null`
 * when the flag is off (default). Returning `null` is the single, explicit
 * signal the caller uses to skip mounting the blind-review surface entirely.
 */
export function wireBlindReview(deps: WireBlindReviewDeps): BlindReview | null {
  if (!deps.enabled) return null;

  const engineDeps: BlindReviewEngineDeps = {
    fetcher: deps.fetcher,
    store: deps.store,
    ...(deps.audit ? { audit: deps.audit } : {}),
    ...(deps.clock ? { clock: deps.clock } : {}),
    ...(deps.defaultReviewerIds
      ? { defaultReviewerIds: deps.defaultReviewerIds }
      : {}),
    ...(deps.defaultHeuristics
      ? { defaultHeuristics: deps.defaultHeuristics }
      : {}),
  };

  return {
    handle: async (
      request: RunBlindReviewRequest,
    ): Promise<BlindReviewReport | null> => {
      const parsed = runBlindReviewRequestSchema.safeParse(request);
      if (!parsed.success) return null;
      // Build the exact-optional options object by spreading each optional
      // only when present. Forwarding `parsed.data` directly would violate
      // exactOptionalPropertyTypes (zod infers `key?: T | undefined`, but the
      // option keys are `key?: T` with the key required-absent when unset).
      const data = parsed.data;
      const options: BlindReviewRunOptions = {
        ...(data.limit !== undefined ? { limit: data.limit } : {}),
        ...(data.seed !== undefined ? { seed: data.seed } : {}),
        ...(data.reviewerIds !== undefined ? { reviewerIds: data.reviewerIds } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.runId !== undefined ? { runId: data.runId } : {}),
        ...(data.issuedAtIso !== undefined ? { issuedAtIso: data.issuedAtIso } : {}),
      };
      return runBlindReview(options, engineDeps);
    },
  };
}
