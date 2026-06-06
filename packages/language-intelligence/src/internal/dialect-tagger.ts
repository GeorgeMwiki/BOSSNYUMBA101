/**
 * Tanzanian dialect tagger.
 *
 * Repoints the ported LitFin
 * `@/core/litfin-ai/learning/language-acquisition/dialect-tagger` import.
 *
 * BossNyumba has no equivalent dialect-tagging capability:
 * `@bossnyumba/swahili-intelligence` exports a `Dialect` type, but it models
 * register/style (`coastal`, `sheng`, `formal`, …) rather than the Tanzanian
 * ethnic languages the short-turn detector needs (Maasai, Sukuma, Chaga, …).
 *
 * What is genuine and ported here:
 *   - the `Dialect` union, and
 *   - `dialectToLangCode`, the factual ISO 639-3 + TZ-region mapping
 *     (e.g. Sukuma → `suk-tz`) that the detector already enumerates in its
 *     `ShortTurnLang` union.
 *
 * What is NOT ported: the per-dialect word lexicons that drive recall.
 * `tagDialects` therefore returns no matches today (the detector degrades
 * to its en/sw path), pending a real dialect corpus.
 *
 * TODO(port): no BN equivalent — supply Tanzanian dialect lexicons and
 * implement `tagDialects` scoring, or wire to a future shared tagger.
 *
 * @module internal/dialect-tagger
 */

/**
 * Tanzanian dialects the short-turn detector can attribute a turn to.
 * Each value maps 1:1 onto a `mas-tz`-style code via {@link dialectToLangCode}.
 */
export type Dialect =
  | 'maasai'
  | 'sukuma'
  | 'chaga'
  | 'hehe'
  | 'haya'
  | 'nyamwezi'
  | 'bena'

/** A dialect attribution with its confidence in `[0, 1]`. */
export interface DialectMatch {
  readonly dialect: Dialect
  readonly confidence: number
}

/**
 * ISO 639-3 language code + `-tz` region suffix for each dialect. These are
 * the exact codes the detector enumerates in its `ShortTurnLang` union.
 */
const DIALECT_LANG_CODE: Readonly<Record<Dialect, string>> = {
  maasai: 'mas-tz',
  sukuma: 'suk-tz',
  chaga: 'cha-tz',
  hehe: 'heh-tz',
  haya: 'hay-tz',
  nyamwezi: 'nym-tz',
  bena: 'bez-tz',
}

/** Map a {@link Dialect} to its `<iso639-3>-tz` language code. */
export function dialectToLangCode(dialect: Dialect): string {
  return DIALECT_LANG_CODE[dialect]
}

/**
 * Tag the dialects present in a token list.
 *
 * Returns matches at or above `minConfidence`. No Tanzanian dialect lexicon
 * has been ported yet, so this currently yields no matches; callers fall back
 * to their en/sw scoring. See the module-level TODO(port).
 */
export function tagDialects(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- contract preserved; implementation pending a dialect corpus
  tokens: readonly string[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- contract preserved; implementation pending a dialect corpus
  minConfidence: number,
): readonly DialectMatch[] {
  return []
}
