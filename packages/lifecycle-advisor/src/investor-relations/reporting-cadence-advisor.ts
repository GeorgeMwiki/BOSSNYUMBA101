/**
 * Reporting cadence advisor — recommends written / meeting / call
 * cadence per investor tier (institutional, individual, family-office).
 *
 * Authority: ILPA Reporting Template v1.1 (2024), NCREIF Reporting
 * Standards 2024.
 */

import type {
  ReportingCadenceInputs,
  ReportingCadenceResult,
} from '../types.js';

export function adviseReportingCadence(
  inputs: Readonly<ReportingCadenceInputs>,
): ReportingCadenceResult {
  if (inputs.tier === 'institutional') {
    return {
      tier: 'institutional',
      writtenCadenceMonths: 3,
      meetingCadenceMonths: 12,
      callCadenceMonths: 3,
      recommendedTemplate: 'ILPA-1.1',
      recipients: 'all institutional LPs (GP-led annual + quarterly written)',
    };
  }
  if (inputs.tier === 'family-office') {
    return {
      tier: 'family-office',
      writtenCadenceMonths: 3,
      meetingCadenceMonths: 12,
      callCadenceMonths: 3,
      recommendedTemplate: 'ILPA-1.1',
      recipients: 'family-office principal + investment director',
    };
  }
  // individual
  return {
    tier: 'individual',
    writtenCadenceMonths: 1,
    meetingCadenceMonths: 12,
    recommendedTemplate: 'ILPA-summary',
    recipients: 'each accredited individual investor (monthly recap + quarterly long report + annual K-1)',
  };
}
