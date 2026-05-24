/**
 * Seismic risk — PGA-band based with site-class amplification.
 *
 * Per IBC 2024 Section 1613, USGS NSHM 2023, GEM Foundation
 * Africa Hazard Model 2024.
 */

import type { SeismicRisk, SeismicRiskInputs } from '../types.js';

const SITE_CLASS_AMPLIFICATION = {
  A: 0.8,
  B: 0.9,
  C: 1.0,
  D: 1.1,
  E: 1.4,
  F: 1.8, // site-specific; conservative default
} as const;

const COST_UPLIFT_PCT = {
  'very-low': 0,
  low: 0.02,
  moderate: 0.06,
  high: 0.12,
  'very-high': 0.18,
} as const;

const INSURANCE_UPLIFT_PCT = {
  'very-low': 0,
  low: 0.02,
  moderate: 0.08,
  high: 0.20,
  'very-high': 0.50,
} as const;

export function scoreSeismicRisk(inputs: SeismicRiskInputs): SeismicRisk {
  if (inputs.pga < 0) {
    throw new Error('PGA must be >= 0');
  }
  const amplification = SITE_CLASS_AMPLIFICATION[inputs.siteClass];
  const adjustedPga = inputs.pga * amplification;

  let band: SeismicRisk['band'];
  if (adjustedPga < 0.05) {
    band = 'very-low';
  } else if (adjustedPga < 0.10) {
    band = 'low';
  } else if (adjustedPga < 0.20) {
    band = 'moderate';
  } else if (adjustedPga < 0.40) {
    band = 'high';
  } else {
    band = 'very-high';
  }

  return {
    band,
    amplificationFactor: amplification,
    designUpliftPct: COST_UPLIFT_PCT[band],
    insurancePremiumUpliftPct: INSURANCE_UPLIFT_PCT[band],
  };
}

export const SEISMIC_SITE_CLASS_AMPLIFICATION = SITE_CLASS_AMPLIFICATION;
