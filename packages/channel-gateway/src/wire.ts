/**
 * Channel gateway — composition root (default-OFF feature flag).
 *
 * The gateway ships behind a flag that is OFF unless explicitly enabled. This
 * package stays ENV-FREE: it never reads `process.env`. The caller (the
 * api-gateway composition root) reads the flag
 * `BOSSNYUMBA_FEATURE_CHANNEL_GATEWAY` and passes the resolved boolean as
 * `deps.enabled`. When the flag is off, {@link wireChannelGateway} returns
 * `null` and the gateway simply never mounts the inbound channel webhook
 * routes.
 *
 * The returned {@link ChannelGatewayFacade} is a thin, dependency-bound facade
 * over {@link createChannelGateway}: the host calls `gateway.handle(input)`
 * from each connector webhook handler without re-threading ports each time.
 *
 * @module @bossnyumba/channel-gateway/wire
 */

import {
  canonicalizeInputSchema,
  type CanonicalizeResult,
} from './types.js';
import {
  createChannelGateway,
  type CanonicalizeInput,
  type ChannelGatewayDeps,
} from './gateway.js';

/** The canonical feature-flag name. READ BY THE CALLER, never by this package. */
export const CHANNEL_GATEWAY_FLAG =
  'BOSSNYUMBA_FEATURE_CHANNEL_GATEWAY' as const;

/**
 * Dependencies for {@link wireChannelGateway}. Extends the gateway deps with a
 * single `enabled` boolean that the caller derives from the feature flag.
 */
export interface WireChannelGatewayDeps extends ChannelGatewayDeps {
  /**
   * Resolved value of `BOSSNYUMBA_FEATURE_CHANNEL_GATEWAY`. The composition
   * root computes `flagValue === 'on'` and passes the boolean here; this
   * package never touches the environment itself.
   */
  readonly enabled: boolean;
}

/** Dependency-bound channel-gateway facade returned by {@link wireChannelGateway}. */
export interface ChannelGatewayFacade {
  /**
   * Canonicalize one inbound connector request. The request envelope is
   * validated at the boundary with zod; a malformed envelope yields a typed
   * `{ ok: false, reason: 'malformed' }` rejection rather than throwing into
   * the webhook handler.
   */
  handle(input: CanonicalizeInput): Promise<CanonicalizeResult>;
}

/**
 * Wire the channel gateway behind its feature flag.
 *
 * Returns a bound {@link ChannelGatewayFacade} when `deps.enabled` is true, or
 * `null` when the flag is off (default). Returning `null` is the single,
 * explicit signal the caller uses to skip mounting the channel webhook routes
 * entirely.
 */
export function wireChannelGateway(
  deps: WireChannelGatewayDeps,
): ChannelGatewayFacade | null {
  if (!deps.enabled) return null;

  const gatewayDeps: ChannelGatewayDeps = {
    signature: deps.signature,
    tier: deps.tier,
    ...(deps.clock ? { clock: deps.clock } : {}),
    ...(deps.audit ? { audit: deps.audit } : {}),
  };
  const gateway = createChannelGateway(gatewayDeps);

  return {
    handle: async (
      input: CanonicalizeInput,
    ): Promise<CanonicalizeResult> => {
      const parsed = canonicalizeInputSchema.safeParse(input);
      if (!parsed.success) {
        return {
          ok: false,
          reason: 'malformed',
          detail: 'invalid canonicalize input envelope',
        };
      }
      // `input` is already typed CanonicalizeInput; the zod parse above is the
      // boundary guard. We forward the original value to preserve the exact
      // optional-property shape (exactOptionalPropertyTypes) and the `unknown`
      // payload.
      return gateway.canonicalize(input);
    },
  };
}
