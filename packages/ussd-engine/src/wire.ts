/**
 * USSD engine — composition root (default-OFF feature flag).
 *
 * The engine ships behind a flag that is OFF unless explicitly enabled. This
 * package stays ENV-FREE: it never reads `process.env`. The caller (the
 * api-gateway composition root) reads the flag
 * `BOSSNYUMBA_FEATURE_USSD_ENGINE` and passes the resolved boolean as
 * `deps.enabled`. When the flag is off, {@link wireUssdEngine} returns `null`
 * and the gateway simply never mounts the USSD webhook route.
 *
 * The returned {@link UssdEngine} is a thin, dependency-bound facade over
 * {@link handleUssdRequest}: the host calls `engine.handle(request)` from the
 * Africa's-Talking webhook handler without re-threading ports each time.
 *
 * @module @bossnyumba/ussd-engine/wire
 */

import { ussdRequestSchema, type UssdRequest, type UssdResponse } from './types.js';
import { handleUssdRequest, type UssdEngineDeps } from './session-machine.js';

/** The canonical feature-flag name. READ BY THE CALLER, never by this package. */
export const USSD_ENGINE_FLAG = 'BOSSNYUMBA_FEATURE_USSD_ENGINE' as const;

/**
 * Dependencies for {@link wireUssdEngine}. Extends the engine deps with a
 * single `enabled` boolean that the caller derives from the feature flag.
 */
export interface WireUssdEngineDeps extends UssdEngineDeps {
  /**
   * Resolved value of `BOSSNYUMBA_FEATURE_USSD_ENGINE`. The composition root
   * computes `flagValue === 'on'` and passes the boolean here; this package
   * never touches the environment itself.
   */
  readonly enabled: boolean;
}

/** Dependency-bound USSD engine facade returned by {@link wireUssdEngine}. */
export interface UssdEngine {
  /**
   * Handle one inbound gateway request. The request is validated at the
   * boundary with zod; a malformed payload yields a terminal generic-error
   * screen rather than throwing into the webhook handler.
   */
  handle(request: UssdRequest): Promise<UssdResponse>;
}

/**
 * Wire the USSD engine behind its feature flag.
 *
 * Returns a bound {@link UssdEngine} when `deps.enabled` is true, or `null`
 * when the flag is off (default). Returning `null` is the single, explicit
 * signal the caller uses to skip mounting the USSD route entirely.
 */
export function wireUssdEngine(deps: WireUssdEngineDeps): UssdEngine | null {
  if (!deps.enabled) return null;

  const engineDeps: UssdEngineDeps = {
    store: deps.store,
    identity: deps.identity,
    data: deps.data,
    ...(deps.audit ? { audit: deps.audit } : {}),
    ...(deps.clock ? { clock: deps.clock } : {}),
    ...(deps.defaultLanguage ? { defaultLanguage: deps.defaultLanguage } : {}),
  };

  return {
    handle: async (request: UssdRequest): Promise<UssdResponse> => {
      const parsed = ussdRequestSchema.safeParse(request);
      if (!parsed.success) {
        const lang = engineDeps.defaultLanguage ?? 'en';
        return {
          message:
            lang === 'sw'
              ? 'Hitilafu imetokea. Piga tena.'
              : 'Something went wrong. Dial again.',
          isEnd: true,
        };
      }
      // `request` is already typed UssdRequest; the zod parse above is the
      // boundary guard. We forward the original value to preserve the exact
      // optional-property shape (exactOptionalPropertyTypes).
      return handleUssdRequest(request, engineDeps);
    },
  };
}
