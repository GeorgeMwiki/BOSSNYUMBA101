/**
 * `@bossnyumba/translation` — public surface.
 *
 * Mirrors @borjie/translation. The facade every text-producing
 * surface calls. Wraps Claude (sonnet-4-5, temperature 0) and adds a
 * cache + recipient-locale resolver so every surface speaks ONE
 * language: the recipient's.
 *
 * Surfaces wired:
 *   - email subjects + bodies + footers (per-recipient locale)
 *   - PDF labels + headings + disclaimers (per-recipient locale)
 *   - push notification title + body (per-recipient locale)
 *   - SMS body (char-limit aware after translation)
 *   - audit log human-readable action descriptions (per-viewer locale)
 *   - decision-journal rationale + alternatives (per-viewer locale)
 *   - webhook payload human strings (per-subscriber locale)
 *   - cron-emitted notifications (per-recipient locale)
 *   - reports (labels, headings, chart legends)
 *   - badges, action verbs, empty states (i18n keys + translate fallback)
 *   - aria-labels and screen-reader-only text (per-viewer locale)
 *
 * Domain hint: BossNyumba (real estate). Tanzanian Swahili variant
 * rule applied at the prompt layer.
 */

export {
  translate,
  createTranslate,
  setGlobalTranslate,
  resetGlobalTranslateForTests,
  type TranslateFn,
  type TranslateDeps,
  type TranslateOptions,
} from './translate.js';

export { translateMany, type TranslateManyContext } from './translate-many.js';

export {
  resolveRecipientLocale,
  sourceLangFor,
  type RecipientLocaleInputs,
} from './recipient-locale.js';

export {
  createInMemoryTranslationCache,
  type InMemoryCache,
  type InMemoryCacheStats,
} from './in-memory-cache.js';

export {
  createDrizzleTranslationCache,
  type DrizzleCacheConfig,
  type DrizzleCacheLogger,
  type SqlRunner,
} from './drizzle-cache.js';

export {
  createClaudeTranslator,
  BN_CLAUDE_MODEL,
  type ClaudeTranslatorConfig,
  type ClaudeTranslatorDeps,
} from './claude-translator.js';

export {
  contentHash,
  canonicalCacheString,
} from './hash.js';

export {
  checkContamination,
  assertNoContamination,
  ContaminationError,
  type ContaminationCheckResult,
  type ContaminationCheckOptions,
} from './contamination.js';

export type {
  Locale,
  Register,
  TranslateInput,
  TranslateOutput,
  TranslationCachePort,
  TranslationCacheKey,
  TranslationCacheValue,
  ClaudeTranslatorPort,
} from './types.js';
