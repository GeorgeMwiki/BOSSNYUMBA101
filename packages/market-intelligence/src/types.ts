/**
 * Market Intelligence shared types.
 */

export interface DistrictMetric {
  readonly districtId: string;
  readonly districtName: string;
  readonly countryCode: string;
  readonly rentPerSqftKes?: number;
  readonly rentPerSqftTzs?: number;
  readonly vacancyRatePct: number;
  readonly capRatePct: number;
  readonly yieldOnCostPct: number;
  readonly sampleSize: number;
  readonly asOf: string;
}

export interface UnitObservation {
  readonly unitId: string;
  readonly tenantId: string;
  readonly districtId: string;
  readonly countryCode: string;
  readonly unitType: 'studio' | '1br' | '2br' | '3br' | '4br' | 'shop' | 'office' | 'warehouse';
  readonly areaSqft: number;
  readonly monthlyRentKes?: number;
  readonly monthlyRentTzs?: number;
  readonly isOccupied: boolean;
  readonly yearBuilt?: number;
  readonly observedAt: string;
}

export interface Comparable {
  readonly unitId: string;
  readonly districtId: string;
  readonly unitType: UnitObservation['unitType'];
  readonly areaSqft: number;
  readonly rentPerSqft: number;
  readonly yearBuilt?: number;
  readonly distanceScore: number;
}

/**
 * ISO-4217 currency code — typed as `string` for "built for the world"
 * support. Runtime validation lives at country-onboarding edges; this
 * module accepts any code so the market-intelligence engine can score
 * data from any jurisdiction the platform supports.
 */
export type Currency = string;

export interface SeasonalityBand {
  readonly countryCode: string;
  readonly month: number;
  readonly multiplier: number;
  readonly notes: string;
}
