/**
 * BossNyumba pricing ladder — five real-estate tiers from individual
 * landlord up to multi-country institutional group.
 *
 * Tier identity:
 *   - `id` is a stable lowercase Swahili token used by analytics, URL
 *     params, and internal logic. Never localised.
 *   - `displayName` carries the user-facing label per locale. Swahili
 *     keeps the heritage tier name (Mkulima / Mwanafamilia / …); English
 *     uses the descriptive translation (Smallholder / Family / …) so the
 *     English UI stays in pure English.
 *
 * Ladder:
 *   - T1 Mkulima / Smallholder      — single landlord, up to 5 units
 *   - T2 Mwanafamilia / Family      — family landlord, up to 25 units
 *   - T3 Mfanyabiashara / Professional — pro manager, up to 250 units
 *   - T4 Kampuni / Corporate        — institutional, up to 2,500 units
 *   - T5 Group                      — multi-country, 2,500+ units / custom
 *
 * Hard rule from CLAUDE.md: "Multi-currency, TZS-primary. Every money
 * render uses formatCurrency(amount, currencyCode)." We expose the
 * raw monthly amount in TZS so the page can defer to the formatter.
 *
 * NO "trial" language per product discipline. CTAs are "Sign Up" /
 * "Log In" only.
 */

import type { Locale } from './i18n';

export type TierId = 'mkulima' | 'mwanafamilia' | 'mfanyabiashara' | 'kampuni' | 'group';

export interface PricingTier {
  readonly id: TierId;
  readonly position: 1 | 2 | 3 | 4 | 5;
  /** @deprecated Use `displayName[locale]`. Kept as the Swahili literal for backwards-compatible callers. */
  readonly name: string;
  readonly displayName: { readonly sw: string; readonly en: string };
  readonly tagline: { readonly sw: string; readonly en: string };
  /** Monthly subscription in TZS, per portfolio (not per unit). */
  readonly priceMonthlyTzs: number | 'custom';
  /** Per-unit overage in TZS for additional units beyond the cap. */
  readonly perUnitTzs: number | 'custom';
  readonly unitCap: number | 'unlimited';
  readonly seats: number | 'unlimited';
  readonly highlighted?: boolean;
  readonly ctaKey: 'signup' | 'demo' | 'sales';
}

export const TIERS: readonly PricingTier[] = [
  {
    id: 'mkulima',
    position: 1,
    name: 'Mkulima',
    displayName: { sw: 'Mkulima', en: 'Smallholder' },
    tagline: {
      sw: 'Kwa mmiliki mmoja wa nyumba',
      en: 'For the individual landlord',
    },
    priceMonthlyTzs: 0,
    perUnitTzs: 0,
    unitCap: 5,
    seats: 1,
    ctaKey: 'signup',
  },
  {
    id: 'mwanafamilia',
    position: 2,
    name: 'Mwanafamilia',
    displayName: { sw: 'Mwanafamilia', en: 'Family' },
    tagline: {
      sw: 'Familia inayomiliki vyumba vichache',
      en: 'For the family-owned portfolio',
    },
    priceMonthlyTzs: 45_000,
    perUnitTzs: 1_800,
    unitCap: 25,
    seats: 3,
    ctaKey: 'signup',
  },
  {
    id: 'mfanyabiashara',
    position: 3,
    name: 'Mfanyabiashara',
    displayName: { sw: 'Mfanyabiashara', en: 'Professional' },
    tagline: {
      sw: 'Meneja wa mali wa kitaalam',
      en: 'For the professional property manager',
    },
    priceMonthlyTzs: 220_000,
    perUnitTzs: 1_400,
    unitCap: 250,
    seats: 12,
    highlighted: true,
    ctaKey: 'demo',
  },
  {
    id: 'kampuni',
    position: 4,
    name: 'Kampuni',
    displayName: { sw: 'Kampuni', en: 'Corporate' },
    tagline: {
      sw: 'Kampuni za mali na REIT',
      en: 'For property companies and REITs',
    },
    priceMonthlyTzs: 1_400_000,
    perUnitTzs: 900,
    unitCap: 2_500,
    seats: 50,
    ctaKey: 'demo',
  },
  {
    id: 'group',
    position: 5,
    name: 'Group',
    displayName: { sw: 'Group', en: 'Group' },
    tagline: {
      sw: 'Mali nyingi, nchi nyingi',
      en: 'Multi-country, sovereign portfolios',
    },
    priceMonthlyTzs: 'custom',
    perUnitTzs: 'custom',
    unitCap: 'unlimited',
    seats: 'unlimited',
    ctaKey: 'sales',
  },
];

/**
 * Helper: resolve the user-facing tier label for the current locale.
 * Used by every page that previously interpolated `tier.name` directly.
 */
export function tierLabel(tier: PricingTier, locale: Locale): string {
  return tier.displayName[locale] ?? tier.displayName.en;
}

/**
 * Helper: resolve a tier label by id (avoids hand-threading the full
 * tier object into copy lookups).
 */
export function tierLabelById(id: TierId, locale: Locale): string {
  const found = TIERS.find((t) => t.id === id);
  return found ? tierLabel(found, locale) : id;
}

/**
 * Comparison-matrix feature ledger. Each row lists which tiers ship
 * the feature. The page renders a check / dash per (feature, tier)
 * cell. Feature order is editorial; don't sort alphabetically.
 */
export interface ComparisonFeature {
  readonly group: string;
  readonly feature: string;
  readonly tiers: ReadonlyArray<TierId>;
  /**
   * Optional Swahili translations. When present, the rendering layer
   * picks `groupSw` / `featureSw` for locale === 'sw'. If absent, the
   * EN strings are used as fallback so the table never breaks.
   */
  readonly groupSw?: string;
  readonly featureSw?: string;
}

/**
 * Resolve a feature's group + feature label for a given locale.
 * Falls back to English if SW translation is missing for that row.
 */
export function comparisonGroupLabel(
  cf: ComparisonFeature,
  locale: Locale,
): string {
  return locale === 'sw' && cf.groupSw ? cf.groupSw : cf.group;
}

export function comparisonFeatureLabel(
  cf: ComparisonFeature,
  locale: Locale,
): string {
  return locale === 'sw' && cf.featureSw ? cf.featureSw : cf.feature;
}

export const COMPARISON: readonly ComparisonFeature[] = [
  // === Core ===
  { group: 'Core',         groupSw: 'Msingi',          feature: 'Mr. Mwikila — AI property operations manager',          featureSw: 'Mwl. Mwikila — meneja wa shughuli za mali wa AI',                   tiers: ['mkulima', 'mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Core',         groupSw: 'Msingi',          feature: 'Head Briefing morning summary',                          featureSw: 'Muhtasari wa asubuhi wa Mkuu',                                       tiers: ['mkulima', 'mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Core',         groupSw: 'Msingi',          feature: 'Five-level autonomy dial',                               featureSw: 'Kipimo cha viwango vitano vya uhuru',                                tiers: ['mkulima', 'mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Core',         groupSw: 'Msingi',          feature: 'Cryptographic audit chain',                              featureSw: 'Mnyororo wa ukaguzi wa kripto',                                      tiers: ['mkulima', 'mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Core',         groupSw: 'Msingi',          feature: 'Swahili + English (sw/en)',                              featureSw: 'Kiswahili + Kiingereza (sw/en)',                                      tiers: ['mkulima', 'mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  // === Property ops ===
  { group: 'Property ops', groupSw: 'Shughuli za mali', feature: 'Rent collection (M-Pesa, Tigo Pesa, Airtel Money)',     featureSw: 'Ukusanyaji wa kodi (M-Pesa, Tigo Pesa, Airtel Money)',                tiers: ['mkulima', 'mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Property ops', groupSw: 'Shughuli za mali', feature: 'Tenant onboarding + screening',                         featureSw: 'Usajili na uchunguzi wa wapangaji',                                   tiers: ['mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Property ops', groupSw: 'Shughuli za mali', feature: 'Maintenance ticket triage',                             featureSw: 'Uchambuzi wa tiketi za matengenezo',                                  tiers: ['mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Property ops', groupSw: 'Shughuli za mali', feature: 'Vendor + handyman dispatch',                            featureSw: 'Usambazaji wa wauzaji na mafundi',                                    tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Property ops', groupSw: 'Shughuli za mali', feature: 'Inspection + condition reports',                        featureSw: 'Taarifa za ukaguzi na hali',                                          tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Property ops', groupSw: 'Shughuli za mali', feature: 'Damage-deductions ledger',                              featureSw: 'Leja ya makato ya uharibifu',                                         tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  // === Finance ===
  { group: 'Finance',      groupSw: 'Fedha',           feature: 'Double-entry rent ledger',                               featureSw: 'Leja ya kodi ya kuingia mara mbili',                                  tiers: ['mkulima', 'mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Finance',      groupSw: 'Fedha',           feature: 'Owner statements + disbursements',                       featureSw: 'Taarifa za mwenye nyumba na malipo',                                  tiers: ['mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Finance',      groupSw: 'Fedha',           feature: 'Multi-currency (TZS / KES / USD)',                       featureSw: 'Sarafu nyingi (TZS / KES / USD)',                                     tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Finance',      groupSw: 'Fedha',           feature: 'Budgets + forecasts',                                    featureSw: 'Bajeti na utabiri',                                                   tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Finance',      groupSw: 'Fedha',           feature: 'Treasury sweep + escrow',                                featureSw: 'Hazina pamoja na escrow',                                             tiers: ['kampuni', 'group'] },
  // === Compliance ===
  { group: 'Compliance',   groupSw: 'Utii',            feature: 'Lease + title registry',                                 featureSw: 'Daftari la mikataba na hati miliki',                                  tiers: ['mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Compliance',   groupSw: 'Utii',            feature: 'Regulatory calendar (housing board / municipal)',        featureSw: 'Kalenda ya udhibiti (bodi ya makazi / manispaa)',                     tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Compliance',   groupSw: 'Utii',            feature: 'Housing-regulator e-filing',                             featureSw: 'Uwasilishaji wa kielektroniki kwa mdhibiti wa makazi',                tiers: ['kampuni', 'group'] },
  { group: 'Compliance',   groupSw: 'Utii',            feature: 'Council levy + property tax automation',                 featureSw: 'Otomatiki ya ushuru wa halmashauri na kodi ya mali',                  tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  // === People ===
  { group: 'People',       groupSw: 'Watu',            feature: 'User seats included',                                    featureSw: 'Viti vya watumiaji vilivyojumuishwa',                                 tiers: ['mkulima', 'mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'People',       groupSw: 'Watu',            feature: 'Role-based access control',                              featureSw: 'Udhibiti wa upatikanaji kwa jukumu',                                  tiers: ['mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'People',       groupSw: 'Watu',            feature: 'SSO / SCIM provisioning',                                featureSw: 'Utoaji wa SSO / SCIM',                                                tiers: ['kampuni', 'group'] },
  { group: 'People',       groupSw: 'Watu',            feature: 'Workforce management (estate manager / handyman team)', featureSw: 'Usimamizi wa wafanyakazi (meneja wa mali / timu ya mafundi)',        tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  // === Intelligence ===
  { group: 'Intelligence', groupSw: 'Akili',           feature: 'Rent-rate forecasts (conformal)',                        featureSw: 'Utabiri wa viwango vya kodi (conformal)',                             tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Intelligence', groupSw: 'Akili',           feature: 'Tenant churn prediction',                                featureSw: 'Utabiri wa wapangaji kuondoka',                                       tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Intelligence', groupSw: 'Akili',           feature: 'Master Brain — portfolio-wide reasoning',                featureSw: 'Master Brain — hoja katika mali yote',                                tiers: ['kampuni', 'group'] },
  { group: 'Intelligence', groupSw: 'Akili',           feature: 'LMBM — legal-master-brain memory',                       featureSw: 'LMBM — kumbukumbu za ubongo-mkuu-wa-kisheria',                        tiers: ['kampuni', 'group'] },
  { group: 'Intelligence', groupSw: 'Akili',           feature: 'Cross-tenant pattern library',                           featureSw: 'Maktaba ya mifumo ya wateja mbalimbali',                              tiers: ['group'] },
  // === Trust + support ===
  { group: 'Trust',        groupSw: 'Uaminifu',        feature: 'Community + email support',                              featureSw: 'Msaada wa jumuiya na barua pepe',                                     tiers: ['mkulima', 'mwanafamilia'] },
  { group: 'Trust',        groupSw: 'Uaminifu',        feature: 'Priority support, 4-hour SLA',                           featureSw: 'Msaada wa kipaumbele, SLA ya saa 4',                                  tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Trust',        groupSw: 'Uaminifu',        feature: 'Dedicated success manager',                              featureSw: 'Meneja wa mafanikio aliyetajwa',                                      tiers: ['kampuni', 'group'] },
  { group: 'Trust',        groupSw: 'Uaminifu',        feature: '99.95% uptime SLA + named support engineer',             featureSw: 'SLA ya muda wa kufanya kazi 99.95% + mhandisi wa msaada aliyetajwa',  tiers: ['group'] },
  { group: 'Trust',        groupSw: 'Uaminifu',        feature: 'On-prem or private-cloud deployment',                    featureSw: 'Usimikaji wa on-prem au wingu binafsi',                               tiers: ['group'] },
  { group: 'Trust',        groupSw: 'Uaminifu',        feature: 'Custom audit + regulator reports',                       featureSw: 'Ukaguzi maalum na taarifa za mdhibiti',                               tiers: ['group'] },
];

export interface FaqItem {
  readonly q: string;
  readonly a: string;
}

/**
 * Bilingual FAQ. English copy strips Swahili tier names from the user-
 * visible text; Swahili copy keeps the heritage names.
 */
export const PRICING_FAQ_EN: readonly FaqItem[] = [
  {
    q: 'Can I start without paying?',
    a: 'Yes. The Smallholder tier is free for up to 5 units, one user seat, and core property operations. Sign up with an M-Pesa-linked phone, NIDA, or email — no card needed.',
  },
  {
    q: 'Are these prices in TZS, KES, or USD?',
    a: 'List prices are in Tanzanian Shillings (TZS). Kenyan customers see the TZS amount converted to KES at the spot rate at billing time, with the FX margin disclosed on the invoice. USD billing is available for the Group tier on request.',
  },
  {
    q: 'Can I pay with mobile money?',
    a: 'Yes — M-Pesa, Tigo Pesa, and Airtel Money are accepted on every tier. Bank transfer is also supported on Professional and above. Card billing (Visa / Mastercard) on Family and above.',
  },
  {
    q: 'What happens if I exceed the unit cap on my tier?',
    a: 'You get an in-app notice at 90% of cap and at 100%. We never auto-upgrade your tier. You can either upgrade (price difference prorated) or pay the per-unit overage rate for the month. No service interruption either way.',
  },
  {
    q: 'Are there any seat fees on top of the per-portfolio price?',
    a: 'No. Each tier includes a generous seat allowance (1 / 3 / 12 / 50 / unlimited). Additional seats are TZS 8,000 / month each on Professional and above. Read-only viewer seats (e.g. for accountants, investors) are always free.',
  },
  {
    q: 'Do you take a cut of the rent we collect?',
    a: 'No. Rent payments flow into your own M-Pesa / bank account; BossNyumba never holds tenant funds. You only pay your monthly subscription. The double-entry rent ledger reconciles automatically.',
  },
  {
    q: 'Can I cancel any time?',
    a: 'Yes. Cancel from Settings -> Billing. We bill calendar months in advance — when you cancel, you keep access until the end of the current month. No early-termination fee. Your data exports are free for 90 days after cancellation.',
  },
  {
    q: 'Do you offer discounts for cooperatives or non-profits?',
    a: 'Yes. Registered housing cooperatives get 30% off Professional and above. Government-housing and student-housing non-profits qualify for the same discount. Email community@bossnyumba.com from your registered domain to apply.',
  },
];

export const PRICING_FAQ_SW: readonly FaqItem[] = [
  {
    q: 'Je, ninaweza kuanza bila kulipa kitu?',
    a: 'Ndiyo. Daraja la Mkulima ni bure kwa hadi vyumba 5, kiti kimoja cha mtumiaji, na shughuli za msingi za mali. Jisajili kwa nambari ya simu iliyounganishwa na M-Pesa, NIDA, au barua pepe — hakuna kadi inayohitajika.',
  },
  {
    q: 'Je, bei hizi ziko katika TZS, KES, au USD?',
    a: 'Bei za orodha ziko katika Shilingi za Tanzania (TZS). Wateja wa Kenya wanaona kiasi cha TZS kilichobadilishwa kwa KES kwa kiwango cha siku ya malipo, na marejeo ya FX yameelezwa kwenye ankara. Malipo ya USD yanapatikana kwa daraja la Group kwa ombi.',
  },
  {
    q: 'Je, ninaweza kulipa kwa pesa za simu?',
    a: 'Ndiyo — M-Pesa, Tigo Pesa, na Airtel Money zinakubaliwa kwenye kila daraja. Uhamisho wa benki pia unasaidiwa kwenye Mfanyabiashara na juu. Malipo ya kadi (Visa / Mastercard) kwenye Mwanafamilia na juu.',
  },
  {
    q: 'Nini hutokea nikizidi kikomo cha vyumba kwenye daraja langu?',
    a: 'Unapokea taarifa ndani ya programu ukifikia 90% na 100% ya kikomo. Hatupandishi daraja lako kiotomatiki. Unaweza kupandisha daraja (tofauti ya bei inagawanywa kwa muda) au kulipa kiwango cha ziada kwa kila chumba kwa mwezi. Hakuna usumbufu wa huduma.',
  },
  {
    q: 'Je, kuna ada za viti zaidi ya bei ya kila portfolio?',
    a: 'Hapana. Kila daraja linajumuisha viti vya kutosha (1 / 3 / 12 / 50 / bila kikomo). Viti vya ziada ni TZS 8,000 / mwezi kwenye Mfanyabiashara na juu. Viti vya kusoma tu (mfano kwa wahasibu, wawekezaji) ni bure daima.',
  },
  {
    q: 'Je, mnachukua sehemu ya kodi tunayokusanya?',
    a: 'Hapana. Malipo ya kodi yanaingia moja kwa moja kwenye akaunti yako ya M-Pesa / benki; BossNyumba haishikilii pesa za wapangaji. Unalipa tu malipo yako ya kila mwezi. Daftari la kodi la maingizo mawili linapatanisha kiotomatiki.',
  },
  {
    q: 'Je, ninaweza kuacha wakati wowote?',
    a: 'Ndiyo. Acha kutoka Mipangilio -> Malipo. Tunatoza miezi ya kalenda mapema — ukiacha, unabaki na ufikiaji hadi mwisho wa mwezi wa sasa. Hakuna ada ya kumaliza mapema. Mauzo ya data yako ni bure kwa siku 90 baada ya kufunga.',
  },
  {
    q: 'Je, mnatoa punguzo kwa vyama vya ushirika au mashirika yasiyo ya faida?',
    a: 'Ndiyo. Vyama vya ushirika wa nyumba vilivyosajiliwa vinapata punguzo la 30% kwenye Mfanyabiashara na juu. Mashirika yasiyo ya faida ya nyumba za serikali na za wanafunzi yanastahiki punguzo hilo hilo. Tuma barua pepe community@bossnyumba.com kutoka kwa kikoa chako kilichosajiliwa kuomba.',
  },
];

export function pricingFaq(locale: Locale): readonly FaqItem[] {
  return locale === 'sw' ? PRICING_FAQ_SW : PRICING_FAQ_EN;
}

/** @deprecated Kept for callers still importing the legacy mixed-language array. Prefer `pricingFaq(locale)`. */
export const PRICING_FAQ: readonly FaqItem[] = PRICING_FAQ_EN;
