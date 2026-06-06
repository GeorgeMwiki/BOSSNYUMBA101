/**
 * Cross-border data-protection permit gate.
 *
 * Repoints the ported LitFin `@/lib/security/pdpc-permit-check` import.
 * The NLLB service calls this before any cross-border neural-translation
 * provider (HuggingFace, Anthropic) and treats it as fail-closed:
 * "Claude is cross-border. Fail closed." A denied permit returns `null`
 * from the relevant tier rather than sending data abroad.
 *
 * BossNyumba has privacy primitives (`@bossnyumba/privacy-router` for
 * sensitivity-tier routing, `enterprise-hardening` consent/DSR management),
 * but none expose a `assertPdpcPermit(provider) -> { allowed, humanReason }`
 * decision with the shape this service consumes. Wiring one would mean
 * inventing the mapping from those subsystems, so this is an honest local
 * gate: deny by default, allow a provider only when it is explicitly listed
 * in the `LANGUAGE_INTELLIGENCE_CROSSBORDER_PROVIDERS` allowlist (a
 * comma-separated env value).
 *
 * TODO(port): no BN equivalent — wire to the real privacy/data-residency
 * decision (e.g. `@bossnyumba/privacy-router`) when one is exposed.
 *
 * @module internal/pdpc-permit-check
 */

/** A cross-border provider gated by the permit check. */
export type CrossBorderProvider = 'huggingface' | 'anthropic'

/** Outcome of a permit check. */
export interface PdpcPermit {
  /** Whether the cross-border call is permitted. */
  readonly allowed: boolean
  /** Operator-facing explanation for the decision. */
  readonly humanReason: string
}

const ALLOWLIST_ENV = 'LANGUAGE_INTELLIGENCE_CROSSBORDER_PROVIDERS'

function readAllowlist(): ReadonlySet<string> {
  const raw = process.env[ALLOWLIST_ENV]
  if (!raw) return new Set<string>()
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0),
  )
}

/**
 * Decide whether a cross-border translation provider may be called.
 *
 * Fail-closed: denies unless the provider is explicitly allowlisted via
 * the {@link ALLOWLIST_ENV} environment variable.
 */
export async function assertPdpcPermit(
  provider: CrossBorderProvider,
): Promise<PdpcPermit> {
  const allowlist = readAllowlist()
  if (allowlist.has(provider)) {
    return {
      allowed: true,
      humanReason: `Provider "${provider}" is allowlisted for cross-border processing via ${ALLOWLIST_ENV}.`,
    }
  }

  return {
    allowed: false,
    humanReason: `Cross-border provider "${provider}" is not permitted: add it to ${ALLOWLIST_ENV} to enable cross-border translation.`,
  }
}
