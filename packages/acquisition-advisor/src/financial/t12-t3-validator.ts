/**
 * T-12 + T-3 operating-statement validator — per NCREIF Operating
 * Reporting Standards + IPMS 2025.
 *
 * Checks:
 *  - T-12 EGI - Opex = T-12 NOI math reconciles.
 *  - T-3 annualized math reconciles.
 *  - T-3 vs T-12 drift within ±5% (unless seasonality flag set).
 *  - Rent-roll GPR reconciles to T-12 EGI with reasonable variance.
 */

import type { T12T3Finding, T12T3Inputs, T12T3Validation } from '../types.js';

const T3_DRIFT_TOLERANCE = 0.05;
const RENT_ROLL_VARIANCE_TOLERANCE = 0.10;
const RENT_ROLL_VARIANCE_HARD = 0.20;

export function validateT12T3(inputs: T12T3Inputs): T12T3Validation {
  const findings: T12T3Finding[] = [];

  const t12NoiComputed = inputs.t12Egi - inputs.t12Opex;
  const t3NoiComputed = inputs.t3EgiAnnualized - inputs.t3OpexAnnualized;

  // T-12 math check
  if (Math.abs(t12NoiComputed - inputs.t12NoiReported) / Math.max(1, Math.abs(inputs.t12NoiReported)) > 0.01) {
    findings.push({
      code: 't12_noi_mismatch',
      severity: 'critical',
      message: `T-12 NOI reported (${inputs.t12NoiReported.toFixed(0)}) does not match computed (${t12NoiComputed.toFixed(0)})`,
    });
  }

  // T-3 math check
  if (Math.abs(t3NoiComputed - inputs.t3NoiAnnualizedReported) / Math.max(1, Math.abs(inputs.t3NoiAnnualizedReported)) > 0.01) {
    findings.push({
      code: 't3_noi_mismatch',
      severity: 'critical',
      message: `T-3 NOI reported (${inputs.t3NoiAnnualizedReported.toFixed(0)}) does not match computed (${t3NoiComputed.toFixed(0)})`,
    });
  }

  // T-3 vs T-12 drift
  const t12vT3DriftPct = inputs.t12Egi === 0
    ? 0
    : (inputs.t3EgiAnnualized - inputs.t12Egi) / inputs.t12Egi;

  if (Math.abs(t12vT3DriftPct) > T3_DRIFT_TOLERANCE && !inputs.hasStudentHousingSeasonality) {
    findings.push({
      code: 't3_t12_drift',
      severity: 'warn',
      message: `T-3 vs T-12 drift ${(t12vT3DriftPct * 100).toFixed(1)}% exceeds ±5% tolerance`,
    });
  }

  // Rent roll vs T-12 EGI variance
  const rentRollEgiVariancePct = inputs.rentRollEgi === 0
    ? 0
    : (inputs.rentRollEgi - inputs.t12Egi) / inputs.t12Egi;

  if (Math.abs(rentRollEgiVariancePct) > RENT_ROLL_VARIANCE_HARD) {
    findings.push({
      code: 'rent_roll_variance_critical',
      severity: 'critical',
      message: `Rent-roll EGI variance ${(rentRollEgiVariancePct * 100).toFixed(1)}% exceeds ±20%`,
    });
  } else if (Math.abs(rentRollEgiVariancePct) > RENT_ROLL_VARIANCE_TOLERANCE) {
    findings.push({
      code: 'rent_roll_variance_warn',
      severity: 'warn',
      message: `Rent-roll EGI variance ${(rentRollEgiVariancePct * 100).toFixed(1)}% exceeds ±10%`,
    });
  }

  // GPR sanity
  if (inputs.rentRollGpr < inputs.rentRollEgi) {
    findings.push({
      code: 'gpr_below_egi',
      severity: 'critical',
      message: 'GPR cannot be below EGI; rent roll has internal inconsistency',
    });
  }

  const pass = !findings.some((f) => f.severity === 'critical');

  return {
    t12NoiComputed,
    t3NoiComputed,
    t12vT3DriftPct,
    rentRollEgiVariancePct,
    findings,
    pass,
  };
}
