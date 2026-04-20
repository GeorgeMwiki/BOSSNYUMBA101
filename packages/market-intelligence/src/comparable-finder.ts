/**
 * Comparable Finder — find similar units to a target unit, ranked by
 * "distance" across (district, unit type, area, year built).
 *
 * Distance is a weighted sum of normalized field differences. Lower =
 * more similar.
 */

import type { Comparable, UnitObservation } from './types.js';

export interface ComparableQuery {
  readonly targetUnit: UnitObservation;
  readonly pool: readonly UnitObservation[];
  readonly maxResults?: number;
}

function areaDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return diff / Math.max(a, b, 1);
}

function unitTypeDistance(
  a: UnitObservation['unitType'],
  b: UnitObservation['unitType'],
): number {
  if (a === b) return 0;
  const residential = new Set(['studio', '1br', '2br', '3br', '4br']);
  if (residential.has(a) && residential.has(b)) return 0.3;
  return 1.0;
}

function yearBuiltDistance(a?: number, b?: number): number {
  if (a === undefined || b === undefined) return 0.5;
  return Math.min(1, Math.abs(a - b) / 50);
}

function rentPerSqft(o: UnitObservation): number {
  const rent = o.monthlyRentKes ?? o.monthlyRentTzs ?? 0;
  if (o.areaSqft <= 0) return 0;
  return rent / o.areaSqft;
}

export function findComparables(query: ComparableQuery): readonly Comparable[] {
  const { targetUnit, pool } = query;
  const maxResults = query.maxResults ?? 5;
  const scored = pool
    .filter((u) => u.unitId !== targetUnit.unitId)
    .map((u) => {
      const districtDiff = u.districtId === targetUnit.districtId ? 0 : 1;
      const typeDiff = unitTypeDistance(u.unitType, targetUnit.unitType);
      const areaDiff = areaDistance(u.areaSqft, targetUnit.areaSqft);
      const yearDiff = yearBuiltDistance(u.yearBuilt, targetUnit.yearBuilt);
      const distance =
        districtDiff * 0.4 + typeDiff * 0.3 + areaDiff * 0.2 + yearDiff * 0.1;
      const comparable: Comparable = {
        unitId: u.unitId,
        districtId: u.districtId,
        unitType: u.unitType,
        areaSqft: u.areaSqft,
        rentPerSqft: rentPerSqft(u),
        yearBuilt: u.yearBuilt,
        distanceScore: distance,
      };
      return comparable;
    });
  scored.sort((a, b) => a.distanceScore - b.distanceScore);
  return scored.slice(0, maxResults);
}
