/**
 * Belief engine — composition root (default-OFF feature flag).
 *
 * The engine ships behind a flag that is OFF unless explicitly enabled. This
 * package stays ENV-FREE: it never reads `process.env`. The caller (the
 * api-gateway / kernel composition root) reads the flag
 * `BOSSNYUMBA_FEATURE_BELIEF_ENGINE` and passes the resolved boolean as
 * `deps.enabled`. When the flag is off, {@link wireBeliefEngine} returns
 * `null` and the host simply never mounts the learning hook.
 *
 * The returned {@link BeliefEngine} is a thin, dependency-bound facade over
 * {@link reviseBelief}: the host calls `engine.handle(claim)` from the
 * chat/learning hook without re-threading ports each time. The claim is
 * validated at the boundary with zod; a malformed payload yields a structured
 * `{ ok: false }` result rather than throwing into the hook.
 *
 * @module @bossnyumba/belief-engine/wire
 */

import { reviseBelief, type ReviseBeliefDeps } from './revise-belief';
import { emitAudit, systemClock, type Clock } from './ports';
import type { BeliefStorePort, WebSearchPort, BeliefAuditSink } from './ports';
import {
  extractedClaimSchema,
  type ConvinceResult,
  type ExtractedClaim,
} from './types';

/** The canonical feature-flag name. READ BY THE CALLER, never by this package. */
export const BELIEF_ENGINE_FLAG = 'BOSSNYUMBA_FEATURE_BELIEF_ENGINE' as const;

/**
 * Runtime dependencies (injected ports) for the bound belief engine. The
 * belief store is required; web-search, audit, clock, and the id factory are
 * optional and degrade safely.
 */
export interface BeliefEngineDeps {
  readonly store: BeliefStorePort;
  readonly webSearch?: WebSearchPort;
  readonly audit?: BeliefAuditSink;
  readonly clock?: Clock;
  /** Mints belief ids when creating a brand-new belief. */
  readonly idFactory?: () => string;
}

/**
 * Dependencies for {@link wireBeliefEngine}. Extends the engine deps with a
 * single `enabled` boolean that the caller derives from the feature flag.
 */
export interface WireBeliefEngineDeps extends BeliefEngineDeps {
  /**
   * Resolved value of `BOSSNYUMBA_FEATURE_BELIEF_ENGINE`. The composition root
   * computes `flagValue === 'on'` and passes the boolean here; this package
   * never touches the environment itself.
   */
  readonly enabled: boolean;
}

/** Structured result of a facade `handle` call — never throws. */
export type BeliefEngineResult =
  | { readonly ok: true; readonly result: ConvinceResult }
  | { readonly ok: false; readonly error: string };

/** Dependency-bound belief engine facade returned by {@link wireBeliefEngine}. */
export interface BeliefEngine {
  /**
   * Handle one extracted claim from the chat/learning hook. The claim is
   * validated at the boundary with zod; a malformed payload yields
   * `{ ok: false }` rather than throwing. A valid claim routes through
   * {@link reviseBelief} — create-if-absent, else convince-loop behind the
   * 0.25 delta gate.
   */
  handle(claim: ExtractedClaim): Promise<BeliefEngineResult>;
}

/**
 * Wire the belief engine behind its feature flag.
 *
 * Returns a bound {@link BeliefEngine} when `deps.enabled` is true, or `null`
 * when the flag is off (default). Returning `null` is the single, explicit
 * signal the caller uses to skip mounting the learning hook entirely.
 */
export function wireBeliefEngine(
  deps: WireBeliefEngineDeps,
): BeliefEngine | null {
  if (!deps.enabled) return null;

  const clock = deps.clock ?? systemClock;
  // Bridge the Clock port to the millisecond `now()` the convince-loop uses.
  const nowMs = (): number => clock.now().getTime();

  const reviseDeps: ReviseBeliefDeps = {
    store: deps.store,
    now: nowMs,
    ...(deps.webSearch ? { webSearch: deps.webSearch } : {}),
    ...(deps.idFactory ? { idFactory: deps.idFactory } : {}),
  };

  return {
    handle: async (claim: ExtractedClaim): Promise<BeliefEngineResult> => {
      const parsed = extractedClaimSchema.safeParse(claim);
      if (!parsed.success) {
        const detail = parsed.error.issues
          .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('; ');
        emitAudit(deps.audit, {
          event: 'belief.claim.rejected',
          detail: `Malformed claim rejected at boundary — ${detail}`,
        });
        return { ok: false, error: `invalid claim: ${detail}` };
      }
      // `claim` is already typed ExtractedClaim; the zod parse above is the
      // boundary guard. We forward the ORIGINAL value to preserve the exact
      // optional-property shape (exactOptionalPropertyTypes).
      try {
        const result = await reviseBelief(claim, reviseDeps);
        emitAudit(deps.audit, {
          event: `belief.${result.action}`,
          beliefId: result.newBelief.id,
          subject: result.newBelief.subject,
          detail: result.rationale,
        });
        return { ok: true, result };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'unknown error';
        emitAudit(deps.audit, {
          event: 'belief.error',
          subject: claim.subject,
          detail: `reviseBelief failed: ${message}`,
        });
        return { ok: false, error: `belief revision failed: ${message}` };
      }
    },
  };
}
