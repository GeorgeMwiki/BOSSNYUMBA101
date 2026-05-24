/**
 * Offset volume estimator — tCO2e/yr per (project shape, methodology).
 *
 * Combines:
 *   - methodology-specific yield (e.g. blue-carbon, biochar)
 *   - project scale (length, area, throughput)
 *   - generic decay over crediting period
 *
 * Pure. No I/O.
 */

import type { CarbonMethodology, ProjectProfile } from '../types.js';

export interface OffsetVolumeResult {
  readonly tCO2ePerYear: number;
  readonly creditingPeriodYears: number;
  readonly lifetimeTCO2e: number;
  readonly notes: string;
}

const DEFAULT_CREDITING_PERIOD: Readonly<Record<string, number>> = {
  VCS: 30,
  GS: 25,
  PACM: 15,
  CAR: 25,
  ACR: 25,
  PlanVivo: 30,
  Puro: 100,
  CDM: 21,
  OTHER: 20,
};

export function estimateOffsetVolume(
  profile: ProjectProfile,
  methodology: CarbonMethodology,
): OffsetVolumeResult {
  const period = DEFAULT_CREDITING_PERIOD[methodology.registry] ?? 20;

  const perYear = perYearForMethodology(methodology.id, profile);
  return {
    tCO2ePerYear: Math.round(perYear),
    creditingPeriodYears: period,
    lifetimeTCO2e: Math.round(perYear * period),
    notes: `Crediting period ${period} years per ${methodology.registry} default.`,
  };
}

function perYearForMethodology(methodologyId: string, profile: ProjectProfile): number {
  const lengthKm = profile.lengthKm ?? 0;
  const areaHa = profile.areaHa ?? 0;

  switch (methodologyId) {
    case 'VCS-VM0033':
    case 'VCS-VM0035':
      // 17 tCO2e/ha/yr × restorable ha (default 250 for ports)
      return (areaHa > 0 ? areaHa : 250) * 17;
    case 'VCS-VM0042':
      // Soil C sequestration, regen-ag corridor
      return (areaHa > 0 ? areaHa : lengthKm * 200) * 1.835;
    case 'VCS-VM0044':
    case 'Puro-Biochar':
      // Biochar: assume 1000 tCO2e/yr per modest pyrolyser line
      return 2500;
    case 'VCS-VM0047':
    case 'GS-LUF-AR':
      // A/R: 8 tCO2e/ha/yr nominal early years
      return (areaHa > 0 ? areaHa : 100) * 8;
    case 'VCS-VMR0006':
      // Modal shift freight: scale by corridor length
      return Math.max(50_000, (lengthKm > 0 ? lengthKm : 100) * 450);
    case 'GS-EE-Cookstove':
      return 3000;
    case 'GS-RE-SmallHydro':
      return 5000;
    case 'PACM-Removals':
      return (areaHa > 0 ? areaHa : 100) * 6;
    case 'PACM-Avoidance':
      return (areaHa > 0 ? areaHa : 500) * 4;
    case 'ACR-AdvRef':
      return 600;
    case 'VCS-VM0007':
    case 'VCS-VM0048':
      return (areaHa > 0 ? areaHa : 1000) * 5;
    case 'VCS-VM0009':
      return (areaHa > 0 ? areaHa : 500) * 6;
    default:
      return 1000;
  }
}
