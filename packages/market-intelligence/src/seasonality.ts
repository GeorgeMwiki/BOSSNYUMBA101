/**
 * Seasonality — rent-pattern multipliers per country per calendar month.
 *
 * Multipliers are relative to the 12-month mean (1.0). Tanzania and Kenya
 * typically see stronger tenant demand in January–March (school year start)
 * and late November–December (return from upcountry). Coastal tourism
 * regions peak December–February.
 */

import type { SeasonalityBand } from './types.js';

export const TZA_SEASONALITY: readonly SeasonalityBand[] = [
  { countryCode: 'TZA', month: 1, multiplier: 1.08, notes: 'School year start demand peaks' },
  { countryCode: 'TZA', month: 2, multiplier: 1.06, notes: 'Continuing school year demand' },
  { countryCode: 'TZA', month: 3, multiplier: 1.02, notes: 'Rain season mild pullback' },
  { countryCode: 'TZA', month: 4, multiplier: 0.97, notes: 'Long rains quieter demand' },
  { countryCode: 'TZA', month: 5, multiplier: 0.95, notes: 'Lowest season demand' },
  { countryCode: 'TZA', month: 6, multiplier: 0.96, notes: 'Pre-winter quiet' },
  { countryCode: 'TZA', month: 7, multiplier: 0.98, notes: 'Warming back up' },
  { countryCode: 'TZA', month: 8, multiplier: 1.00, notes: 'Annual mean' },
  { countryCode: 'TZA', month: 9, multiplier: 1.02, notes: 'University intake' },
  { countryCode: 'TZA', month: 10, multiplier: 1.03, notes: 'October steady' },
  { countryCode: 'TZA', month: 11, multiplier: 1.05, notes: 'Return to cities' },
  { countryCode: 'TZA', month: 12, multiplier: 1.08, notes: 'Year-end relocations' },
];

export const KEN_SEASONALITY: readonly SeasonalityBand[] = [
  { countryCode: 'KEN', month: 1, multiplier: 1.10, notes: 'School year start; strongest demand' },
  { countryCode: 'KEN', month: 2, multiplier: 1.07, notes: 'Continuing school demand' },
  { countryCode: 'KEN', month: 3, multiplier: 1.02, notes: 'Moderating' },
  { countryCode: 'KEN', month: 4, multiplier: 0.96, notes: 'Long rains' },
  { countryCode: 'KEN', month: 5, multiplier: 0.94, notes: 'Low season' },
  { countryCode: 'KEN', month: 6, multiplier: 0.95, notes: 'Continued low season' },
  { countryCode: 'KEN', month: 7, multiplier: 0.98, notes: 'Mild recovery' },
  { countryCode: 'KEN', month: 8, multiplier: 1.00, notes: 'Annual mean' },
  { countryCode: 'KEN', month: 9, multiplier: 1.03, notes: 'University term' },
  { countryCode: 'KEN', month: 10, multiplier: 1.04, notes: 'Steady' },
  { countryCode: 'KEN', month: 11, multiplier: 1.05, notes: 'Return to cities' },
  { countryCode: 'KEN', month: 12, multiplier: 1.08, notes: 'Year-end / relocation' },
];

export const UGA_SEASONALITY: readonly SeasonalityBand[] = [
  { countryCode: 'UGA', month: 1, multiplier: 1.07, notes: 'School year start' },
  { countryCode: 'UGA', month: 2, multiplier: 1.05, notes: 'Continuing demand' },
  { countryCode: 'UGA', month: 3, multiplier: 1.01, notes: 'Pre-rains' },
  { countryCode: 'UGA', month: 4, multiplier: 0.97, notes: 'Rains' },
  { countryCode: 'UGA', month: 5, multiplier: 0.96, notes: 'Continued rains' },
  { countryCode: 'UGA', month: 6, multiplier: 0.97, notes: 'Dry season begins' },
  { countryCode: 'UGA', month: 7, multiplier: 0.99, notes: 'Drier steady' },
  { countryCode: 'UGA', month: 8, multiplier: 1.00, notes: 'Annual mean' },
  { countryCode: 'UGA', month: 9, multiplier: 1.02, notes: 'Uni term' },
  { countryCode: 'UGA', month: 10, multiplier: 1.03, notes: 'Steady' },
  { countryCode: 'UGA', month: 11, multiplier: 1.04, notes: 'Return' },
  { countryCode: 'UGA', month: 12, multiplier: 1.06, notes: 'Year-end' },
];

const CATALOG: Readonly<Record<string, readonly SeasonalityBand[]>> = {
  TZA: TZA_SEASONALITY,
  KEN: KEN_SEASONALITY,
  UGA: UGA_SEASONALITY,
};

export function seasonalityMultiplier(
  countryCode: string,
  month: number,
): number {
  const bands = CATALOG[countryCode];
  if (!bands) return 1.0;
  const band = bands.find((b) => b.month === month);
  return band?.multiplier ?? 1.0;
}

export function applySeasonality(
  baseRent: number,
  countryCode: string,
  month: number,
): number {
  return baseRent * seasonalityMultiplier(countryCode, month);
}

export function getSeasonalityTable(
  countryCode: string,
): readonly SeasonalityBand[] {
  return CATALOG[countryCode] ?? [];
}
