/**
 * Scale-tier demo fixtures.
 *
 * One representative landlord/property-management profile per tier so
 * onboarding, default-tab selection, and persona-register tests have
 * realistic fixtures spanning the full tier surface (T1-T5).
 *
 * Companion to migration 0274 (tenants.scale_tier).
 *
 * Tiers:
 *   T1 single_unit       1-5 units      — individual landlord, one apartment
 *   T2 small_portfolio   5-50 units     — small PM company, multi-unit
 *   T3 mid_portfolio     50-500 units   — regional PM with admin + ops
 *   T4 large_portfolio   500-5,000 units — commercial REIT, multi-region
 *   T5 multi_country     cross-border    — multi-region holdings group
 *
 * Each fixture is a plain object — no DB writes here. Consumers
 * (run-seed, integration tests) pick a fixture and apply it.
 */

export interface ScaleTierFixture {
  readonly slug: string;
  readonly scaleTier:
    | 't1_single_unit'
    | 't2_small_portfolio'
    | 't3_mid_portfolio'
    | 't4_large_portfolio'
    | 't5_multi_country';
  readonly displayName: string;
  readonly countryCode: string;
  readonly regulatorSet: string;
  readonly primaryCurrency: string;
  readonly defaultLanguage: string;
  readonly scaleSignals: Readonly<{
    unitCount: number;
    buildingCount: number;
    regionCount: number;
    crossBorder: boolean;
    computedAt: string;
  }>;
}

export const SCALE_TIER_FIXTURES: readonly ScaleTierFixture[] = [
  {
    slug: 'demo-t1-tz-mwananchi',
    scaleTier: 't1_single_unit',
    displayName: 'Mwananchi Rentals (Dar es Salaam, 1 unit)',
    countryCode: 'TZ',
    regulatorSet: 'TZ-set',
    primaryCurrency: 'TZS',
    defaultLanguage: 'sw',
    scaleSignals: {
      unitCount: 1,
      buildingCount: 1,
      regionCount: 1,
      crossBorder: false,
      computedAt: '2026-05-29T00:00:00Z',
    },
  },
  {
    slug: 'demo-t2-ke-nairobi-flats',
    scaleTier: 't2_small_portfolio',
    displayName: 'Nairobi Flats (Kileleshwa, 28 units)',
    countryCode: 'KE',
    regulatorSet: 'KE-set',
    primaryCurrency: 'KES',
    defaultLanguage: 'sw-KE',
    scaleSignals: {
      unitCount: 28,
      buildingCount: 3,
      regionCount: 1,
      crossBorder: false,
      computedAt: '2026-05-29T00:00:00Z',
    },
  },
  {
    slug: 'demo-t3-za-jhb-bellaroma',
    scaleTier: 't3_mid_portfolio',
    displayName: 'Bellaroma Residences (Johannesburg, 240 units)',
    countryCode: 'ZA',
    regulatorSet: 'ZA-set',
    primaryCurrency: 'ZAR',
    defaultLanguage: 'en',
    scaleSignals: {
      unitCount: 240,
      buildingCount: 12,
      regionCount: 2,
      crossBorder: false,
      computedAt: '2026-05-29T00:00:00Z',
    },
  },
  {
    slug: 'demo-t4-uk-london-canary',
    scaleTier: 't4_large_portfolio',
    displayName: 'Canary Court Holdings (London, 1,800 units)',
    countryCode: 'GB',
    regulatorSet: 'UK-set',
    primaryCurrency: 'GBP',
    defaultLanguage: 'en',
    scaleSignals: {
      unitCount: 1800,
      buildingCount: 18,
      regionCount: 4,
      crossBorder: false,
      computedAt: '2026-05-29T00:00:00Z',
    },
  },
  {
    slug: 'demo-t5-multi-pan-africa',
    scaleTier: 't5_multi_country',
    displayName: 'Pan-African Estates Group (TZ + KE + ZA + UG, 4,200 units)',
    countryCode: 'TZ',
    regulatorSet: 'TZ-set',
    primaryCurrency: 'USD',
    defaultLanguage: 'en',
    scaleSignals: {
      unitCount: 4200,
      buildingCount: 64,
      regionCount: 8,
      crossBorder: true,
      computedAt: '2026-05-29T00:00:00Z',
    },
  },
];

/**
 * Look up a fixture by slug. Returns undefined if not found — caller
 * decides whether to throw.
 */
export function findScaleTierFixture(
  slug: string,
): ScaleTierFixture | undefined {
  return SCALE_TIER_FIXTURES.find((f) => f.slug === slug);
}
