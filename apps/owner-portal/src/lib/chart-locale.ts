/**
 * chart-locale — maps the owner-portal active UI locale (`'en' | 'sw'`)
 * to a BCP-47 tag suitable for `Intl` / `Date.prototype.toLocaleDateString`
 * when grouping chart axes by month/period.
 *
 * Why this util exists
 * --------------------
 *
 *   Several owner-portal charts grouped their month buckets with a
 *   hard-coded `'en-KE'` literal (e.g. Disbursements, Financial). That
 *   violated the CLAUDE.md "no hard-coded jurisdiction" rule: Kenya is a
 *   *planned expansion* market, not the launch jurisdiction (Tanzania
 *   is), and the locale also pinned the month label language to English
 *   regardless of the user's `sw` toggle.
 *
 *   The fix is to derive the formatting locale from the active UI locale
 *   resolved by `LocaleProvider` / `useLocaleContext`, mapping it to the
 *   region-tagged BCP-47 tag East-African users expect:
 *
 *     - `en` → `en-GB`  (DD/MM ordering, the EA convention; region-neutral
 *                         English that is NOT pinned to any single
 *                         jurisdiction — month labels render "Jun 2026")
 *     - `sw` → `sw-TZ`  (Swahili, Tanzania — the launch jurisdiction;
 *                         month labels render "Jun 2026" in Swahili)
 *
 *   Month/year grouping keys ("Jun 2026") stay stable per-locale so the
 *   `Map` bucket de-duplication in the chart builders keeps collapsing
 *   the same month into one bar.
 */

import type { Locale } from '../i18n';

/**
 * BCP-47 tag used for chart axis date formatting, keyed by UI locale.
 *
 * `en` is mapped to the region-neutral `en-GB` rather than any single
 * country tag so we never bake a jurisdiction into a money/period chart.
 */
const CHART_LOCALE_BY_UI_LOCALE: Record<Locale, string> = {
  en: 'en-GB',
  sw: 'sw-TZ',
};

/**
 * Resolve the BCP-47 formatting tag for a chart, given the active UI
 * locale. Falls back to the English (`en-GB`) tag for any unexpected
 * value so a chart never throws on an out-of-range locale.
 *
 * @param locale Active UI locale from `useLocaleContext()` (`'en' | 'sw'`).
 * @returns BCP-47 tag for `toLocaleDateString` / `Intl`.
 */
export function chartLocaleTag(locale: Locale): string {
  return CHART_LOCALE_BY_UI_LOCALE[locale] ?? CHART_LOCALE_BY_UI_LOCALE.en;
}
