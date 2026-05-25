/**
 * Biodiversity Net Gain (BNG) — fine-grained estimator.
 *
 * Two sub-shapes:
 *
 *   - land-bridge-bng:  wildlife crossings on linear infrastructure
 *                       (the impacted parties are wide-ranging species
 *                        cut by the corridor; offset is per-impact).
 *   - land-bng:         mining + point-asset terrestrial impact
 *                       (offset is per-hectare of habitat disturbed).
 *
 * Pricing references:
 *   - UK BNG statutory floor (Feb 2024): GBP 42,000 / biodiversity unit
 *     (2× lowest market price floor).
 *   - Market: GBP 12,000 – 30,000 / BU for medium-distinctiveness.
 *   - IFC PS6 critical-habitat offset ratio: 10:1; natural: 3:1.
 *
 * Pure. No I/O.
 */

import type { ProjectProfile } from '../types.js';

export interface BngEstimate {
  /** Biodiversity units required (BNG) or hectares offset (PS6). */
  readonly unitsRequired: number;
  /** Indicative offset cost USD (mid-market). */
  readonly indicativeCostUsd: number;
  /** Offset ratio applied (e.g. 10:1 for critical habitat). */
  readonly offsetRatio: number;
  /** Method label (BNG-UK | PS6-critical | PS6-natural). */
  readonly method: 'BNG-UK' | 'PS6-critical' | 'PS6-natural';
  /** Notes for the report. */
  readonly notes: string;
}

const GBP_USD = 1.27;

export function estimateLandBridgeBng(profile: ProjectProfile): BngEstimate {
  // Corridor scaled to length. 1 BU per km baseline for medium-distinct
  // habitat impacted, doubled to 2 BU/km if critical habitat is near.
  const length = profile.lengthKm ?? 100;
  const criticalHabitat = profile.signals.includes('critical-habitat-near');

  if (criticalHabitat) {
    // IFC PS6 critical-habitat path: offset ratio 10:1, expressed in ha.
    const haImpacted = length * 0.5; // 0.5 ha per km right-of-way average
    const haOffset = haImpacted * 10;
    return {
      unitsRequired: haOffset,
      indicativeCostUsd: haOffset * 25000, // ~USD 25k/ha for managed reserve land
      offsetRatio: 10,
      method: 'PS6-critical',
      notes: 'IFC PS6 critical habitat 10:1 offset triggered by adjacency to protected area.',
    };
  }

  // BNG-UK pathway (or analogous emerging frameworks elsewhere)
  const bus = length * 1.5;
  return {
    unitsRequired: Math.round(bus),
    indicativeCostUsd: Math.round(bus * 21000 * GBP_USD), // mid-market GBP 21k
    offsetRatio: 1.1,
    method: 'BNG-UK',
    notes: 'Mid-market biodiversity unit pricing (medium-distinctiveness habitat).',
  };
}

export function estimateLandBng(profile: ProjectProfile): BngEstimate {
  const haImpacted = profile.areaHa ?? 100;
  const criticalHabitat = profile.signals.includes('critical-habitat-near');
  const ratio = criticalHabitat ? 10 : 3;
  const haOffset = haImpacted * ratio;
  return {
    unitsRequired: haOffset,
    indicativeCostUsd: Math.round(haOffset * (criticalHabitat ? 25000 : 12000)),
    offsetRatio: ratio,
    method: criticalHabitat ? 'PS6-critical' : 'PS6-natural',
    notes: criticalHabitat
      ? 'Critical habitat impact requires 10:1 offset; high-value land.'
      : 'Natural habitat impact requires 3:1 offset.',
  };
}
