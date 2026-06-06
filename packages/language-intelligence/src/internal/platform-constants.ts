/**
 * Translation-provider rate-limit constants.
 *
 * Repoints the ported LitFin `@/config/platform-constants` import. BossNyumba
 * has no equivalent constants module for external translation providers, so
 * the values live locally with the only consumer
 * (`external-dictionary-service.ts`).
 *
 * These are the published free-tier quotas for the two providers the service
 * cascades through, expressed in characters per calendar month. The warn /
 * hard-stop thresholds are conservative fractions of each free tier so the
 * service backs off well before the provider starts billing.
 *
 *   - Azure Translator free tier:  2,000,000 chars/month
 *   - Google Cloud Translation v2: 500,000 chars/month
 *
 * @module internal/platform-constants
 */

export interface TranslationLimits {
  /** Azure Translator free-tier monthly character quota. */
  readonly azureFreeCharacters: number
  /** Emit a warning once Azure usage crosses this character count. */
  readonly azureWarnThreshold: number
  /** Stop issuing Azure calls once usage crosses this character count. */
  readonly azureHardStop: number
  /** Google Cloud Translation free-tier monthly character quota. */
  readonly googleFreeCharacters: number
  /** Emit a warning once Google usage crosses this character count. */
  readonly googleWarnThreshold: number
  /** Stop issuing Google calls once usage crosses this character count. */
  readonly googleHardStop: number
}

const AZURE_FREE_CHARACTERS = 2_000_000
const GOOGLE_FREE_CHARACTERS = 500_000

// Warn at 80% of free tier, hard-stop at 95% — keeps a safety margin
// before either provider transitions into paid usage.
export const TRANSLATION_LIMITS: TranslationLimits = {
  azureFreeCharacters: AZURE_FREE_CHARACTERS,
  azureWarnThreshold: Math.floor(AZURE_FREE_CHARACTERS * 0.8),
  azureHardStop: Math.floor(AZURE_FREE_CHARACTERS * 0.95),
  googleFreeCharacters: GOOGLE_FREE_CHARACTERS,
  googleWarnThreshold: Math.floor(GOOGLE_FREE_CHARACTERS * 0.8),
  googleHardStop: Math.floor(GOOGLE_FREE_CHARACTERS * 0.95),
}
