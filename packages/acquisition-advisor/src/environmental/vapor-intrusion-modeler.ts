/**
 * Vapor intrusion modeler — per ASTM E2600-15 *Standard Guide for
 * Vapor Encroachment Screening*. Estimates attenuation factor
 * from a chlorinated-solvent or petroleum vapor source and
 * recommends sub-slab depressurization mitigation if needed.
 *
 * Attenuation factor crude estimate: distance + soil + building.
 * Production use should rely on full J&E or measured sub-slab data.
 */

import type { VaporIntrusionModel } from '../types.js';

const SOIL_DIFFUSIVITY = {
  sand: 0.85,
  silt: 0.55,
  clay: 0.25,
  fill: 0.75,
} as const;

const BUILDING_AMPLIFICATION = {
  'slab-on-grade': 1.0,
  basement: 1.6,
  crawlspace: 1.3,
} as const;

const CONTAMINANT_BASE_AF = {
  TCE: 0.02,
  PCE: 0.015,
  benzene: 0.025,
  naphthalene: 0.018,
  other: 0.020,
} as const;

const MITIGATION_AF_THRESHOLD = 0.003;
const BASE_MITIGATION_COST_USD = 12_000;
const SLAB_FACTOR = {
  'slab-on-grade': 1.0,
  basement: 2.0,
  crawlspace: 1.5,
} as const;

export interface VaporIntrusionInputs {
  readonly distanceFromSourceMetres: number;
  readonly contaminant: VaporIntrusionModel['contaminant'];
  readonly soilType: VaporIntrusionModel['soilType'];
  readonly buildingType: VaporIntrusionModel['buildingType'];
}

export function modelVaporIntrusion(
  inputs: VaporIntrusionInputs,
): VaporIntrusionModel {
  if (inputs.distanceFromSourceMetres < 0) {
    throw new Error('distanceFromSourceMetres must be >= 0');
  }
  const distanceAttenuation = Math.exp(-inputs.distanceFromSourceMetres / 35);
  const soilFactor = SOIL_DIFFUSIVITY[inputs.soilType];
  const buildingFactor = BUILDING_AMPLIFICATION[inputs.buildingType];
  const baseAf = CONTAMINANT_BASE_AF[inputs.contaminant];

  const attenuationFactor = baseAf * distanceAttenuation * soilFactor * buildingFactor;
  const mitigationRequired = attenuationFactor >= MITIGATION_AF_THRESHOLD;
  const mitigationCostUsd = mitigationRequired
    ? BASE_MITIGATION_COST_USD * SLAB_FACTOR[inputs.buildingType]
    : 0;

  return {
    distanceFromSourceMetres: inputs.distanceFromSourceMetres,
    contaminant: inputs.contaminant,
    soilType: inputs.soilType,
    buildingType: inputs.buildingType,
    attenuationFactor,
    mitigationRequired,
    mitigationCostUsd,
  };
}
