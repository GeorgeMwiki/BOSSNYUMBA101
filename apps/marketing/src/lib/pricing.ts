/**
 * BossNyumba pricing ladder — five Swahili-named tiers ported from
 * Borjie's mining ladder (Mwanzo / Mkulima / Mfanyabiashara / Kampuni
 * / Group) and reframed for real-estate.
 *
 * Naming convention:
 *   - T1 Mkulima        — single landlord, up to 5 units
 *   - T2 Mwanafamilia   — family landlord, up to 25 units
 *   - T3 Mfanyabiashara — professional manager, up to 250 units
 *   - T4 Kampuni        — institutional, up to 2,500 units
 *   - T5 Group          — multi-country, 2,500+ units / custom
 *
 * Hard rule from CLAUDE.md: "Multi-currency, TZS-primary. Every money
 * render uses formatCurrency(amount, currencyCode)." We expose the
 * raw monthly amount in TZS so the page can defer to the formatter.
 *
 * NO "trial" language per Borjie discipline. CTAs are "Sign Up" /
 * "Log In" only.
 */

export type TierId = 'mkulima' | 'mwanafamilia' | 'mfanyabiashara' | 'kampuni' | 'group';

export interface PricingTier {
  readonly id: TierId;
  readonly position: 1 | 2 | 3 | 4 | 5;
  readonly name: string;
  readonly tagline: { sw: string; en: string };
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
 * Comparison-matrix feature ledger. Each row lists which tiers ship
 * the feature. The page renders a check / dash per (feature, tier)
 * cell. Feature order is editorial; don't sort alphabetically.
 */
export interface ComparisonFeature {
  readonly group: string;
  readonly feature: string;
  readonly tiers: ReadonlyArray<TierId>;
}

export const COMPARISON: readonly ComparisonFeature[] = [
  // === Core ===
  { group: 'Core',         feature: 'Mr. Mwikila — AI property operations manager',          tiers: ['mkulima', 'mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Core',         feature: 'Head Briefing morning summary',                          tiers: ['mkulima', 'mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Core',         feature: 'Five-level autonomy dial',                               tiers: ['mkulima', 'mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Core',         feature: 'Cryptographic audit chain',                              tiers: ['mkulima', 'mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Core',         feature: 'Swahili + English (sw/en)',                              tiers: ['mkulima', 'mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  // === Property ops ===
  { group: 'Property ops', feature: 'Rent collection (M-Pesa, Tigo Pesa, Airtel Money)',      tiers: ['mkulima', 'mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Property ops', feature: 'Tenant onboarding + screening',                          tiers: ['mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Property ops', feature: 'Maintenance ticket triage',                              tiers: ['mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Property ops', feature: 'Vendor + handyman dispatch',                             tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Property ops', feature: 'Inspection + condition reports',                         tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Property ops', feature: 'Damage-deductions ledger',                               tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  // === Finance ===
  { group: 'Finance',      feature: 'Double-entry rent ledger',                               tiers: ['mkulima', 'mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Finance',      feature: 'Owner statements + disbursements',                       tiers: ['mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Finance',      feature: 'Multi-currency (TZS / KES / USD)',                       tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Finance',      feature: 'Budgets + forecasts',                                    tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Finance',      feature: 'Treasury sweep + escrow',                                tiers: ['kampuni', 'group'] },
  // === Compliance ===
  { group: 'Compliance',   feature: 'Lease + title registry',                                 tiers: ['mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Compliance',   feature: 'Regulatory calendar (housing board / municipal)',        tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Compliance',   feature: 'Housing-regulator e-filing',                             tiers: ['kampuni', 'group'] },
  { group: 'Compliance',   feature: 'Council levy + property tax automation',                 tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  // === People ===
  { group: 'People',       feature: 'User seats included',                                    tiers: ['mkulima', 'mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'People',       feature: 'Role-based access control',                              tiers: ['mwanafamilia', 'mfanyabiashara', 'kampuni', 'group'] },
  { group: 'People',       feature: 'SSO / SCIM provisioning',                                tiers: ['kampuni', 'group'] },
  { group: 'People',       feature: 'Workforce management (estate manager / handyman team)',  tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  // === Intelligence ===
  { group: 'Intelligence', feature: 'Rent-rate forecasts (conformal)',                        tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Intelligence', feature: 'Tenant churn prediction',                                tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Intelligence', feature: 'Master Brain — portfolio-wide reasoning',                tiers: ['kampuni', 'group'] },
  { group: 'Intelligence', feature: 'LMBM — legal-master-brain memory',                       tiers: ['kampuni', 'group'] },
  { group: 'Intelligence', feature: 'Cross-tenant pattern library',                           tiers: ['group'] },
  // === Trust + support ===
  { group: 'Trust',        feature: 'Community + email support',                              tiers: ['mkulima', 'mwanafamilia'] },
  { group: 'Trust',        feature: 'Priority support, 4-hour SLA',                           tiers: ['mfanyabiashara', 'kampuni', 'group'] },
  { group: 'Trust',        feature: 'Dedicated success manager',                              tiers: ['kampuni', 'group'] },
  { group: 'Trust',        feature: '99.95% uptime SLA + named support engineer',             tiers: ['group'] },
  { group: 'Trust',        feature: 'On-prem or private-cloud deployment',                    tiers: ['group'] },
  { group: 'Trust',        feature: 'Custom audit + regulator reports',                       tiers: ['group'] },
];

export interface FaqItem {
  readonly q: string;
  readonly a: string;
}

export const PRICING_FAQ: readonly FaqItem[] = [
  {
    q: 'Je, ninaweza kuanza bila kulipa kitu? (Can I start without paying?)',
    a: 'Yes. Mkulima (T1) is free for up to 5 units, one user seat, and core property operations. Sign up with M-Pesa-linked phone, NIDA, or email — no card needed.',
  },
  {
    q: 'Are these prices in TZS, KES, or USD?',
    a: 'List prices are in Tanzanian Shillings (TZS). Kenyan customers see the TZS amount converted to KES at the spot rate at billing time, with the FX margin disclosed on the invoice. USD billing is available for Group tier on request.',
  },
  {
    q: 'Can I pay with mobile money?',
    a: 'Yes — M-Pesa, Tigo Pesa, and Airtel Money are accepted on every tier. Bank transfer is also supported on Mfanyabiashara and above. Card billing (Visa / Mastercard) on Mwanafamilia and above.',
  },
  {
    q: 'What happens if I exceed the unit cap on my tier?',
    a: 'You get an in-app notice at 90% of cap and at 100%. We never auto-upgrade your tier. You can either upgrade (price difference prorated) or pay the per-unit overage rate for the month. No service interruption either way.',
  },
  {
    q: 'Are there any seat fees on top of the per-portfolio price?',
    a: 'No. Each tier includes a generous seat allowance (1 / 3 / 12 / 50 / unlimited). Additional seats are TZS 8,000 / month each on Mfanyabiashara and above. Read-only viewer seats (e.g. for accountants, investors) are always free.',
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
    a: 'Yes. Registered housing cooperatives get 30% off Mfanyabiashara and above. Government-housing and student-housing non-profits qualify for the same discount. Email community@bossnyumba.com from your registered domain to apply.',
  },
];
