/**
 * Internal feed adapter — aggregates district metrics from the platform's
 * own unit observations. This is the default feed for BOSSNYUMBA.
 */

import type { DistrictMetric, UnitObservation } from '../types.js';

export interface InternalAggregatorInput {
  readonly observations: readonly UnitObservation[];
  readonly asOf: string;
}

function rentPerSqft(obs: UnitObservation): number | undefined {
  const rent = obs.monthlyRentKes ?? obs.monthlyRentTzs;
  if (!rent) return undefined;
  if (obs.areaSqft <= 0) return undefined;
  return rent / obs.areaSqft;
}

function average(nums: readonly number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function aggregateInternal(
  input: InternalAggregatorInput,
): readonly DistrictMetric[] {
  const byDistrict = new Map<string, UnitObservation[]>();
  for (const obs of input.observations) {
    const existing = byDistrict.get(obs.districtId) ?? [];
    byDistrict.set(obs.districtId, [...existing, obs]);
  }
  const metrics: DistrictMetric[] = [];
  for (const [districtId, obsList] of byDistrict) {
    const withRents = obsList
      .map(rentPerSqft)
      .filter((v): v is number => v !== undefined);
    const occupied = obsList.filter((o) => o.isOccupied).length;
    const vacancyRatePct =
      obsList.length === 0 ? 0 : ((obsList.length - occupied) / obsList.length) * 100;
    const rentAvg = average(withRents);
    const annualRentAvg = rentAvg * 12;
    const capRatePct = rentAvg > 0 ? (annualRentAvg / (annualRentAvg * 12)) * 100 : 0;
    const yieldOnCostPct = rentAvg > 0 ? (annualRentAvg / (annualRentAvg * 11)) * 100 : 0;
    const first = obsList[0]!;
    const kesValues = obsList
      .map((o) => (o.monthlyRentKes && o.areaSqft ? o.monthlyRentKes / o.areaSqft : undefined))
      .filter((v): v is number => v !== undefined);
    const tzsValues = obsList
      .map((o) => (o.monthlyRentTzs && o.areaSqft ? o.monthlyRentTzs / o.areaSqft : undefined))
      .filter((v): v is number => v !== undefined);
    metrics.push({
      districtId,
      districtName: districtId,
      countryCode: first.countryCode,
      rentPerSqftKes: kesValues.length > 0 ? average(kesValues) : undefined,
      rentPerSqftTzs: tzsValues.length > 0 ? average(tzsValues) : undefined,
      vacancyRatePct,
      capRatePct,
      yieldOnCostPct,
      sampleSize: obsList.length,
      asOf: input.asOf,
    });
  }
  return metrics;
}
