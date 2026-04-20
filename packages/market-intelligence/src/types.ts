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

export type Currency = 'KES' | 'TZS' | 'UGX' | 'RWF';

export interface SeasonalityBand {
  readonly countryCode: string;
  readonly month: number;
  readonly multiplier: number;
  readonly notes: string;
}
