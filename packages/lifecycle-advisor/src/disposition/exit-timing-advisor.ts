/**
 * Exit-timing advisor — composite trigger using hold-period IRR vs
 * forward cap-rate curve and market-activity signals (RCA velocity,
 * Trepp CMBS issuance).
 *
 * Authority: NCREIF Property Index Q1-2026, Real Capital Analytics
 * (RCA) US Trends 2026, Trepp CMBS Issuance Tracker 2026, ULI
 * *Emerging Trends 2026*.
 *
 * Triggers (each binary):
 *   1. forwardIRR < holdingHurdle - 200 bps
 *   2. marketCapRate ≤ entryCapRate - 50 bps
 *   3. taxBasis × (1 - depreciationRecapture) > debtPaydown
 *   4. RCA velocity z-score > 0.5
 *   5. CMBS issuance z-score > -0.5
 *
 * Score:
 *   4-5 of 5 → sell-now
 *   3 of 5  → soft-test
 *   ≤ 2     → continue-hold
 */

import type { ExitTimingInputs, ExitTimingResult } from '../types.js';

const IRR_SPREAD_BPS = 200;
const CAP_SPREAD_BPS = 50;
const RCA_Z_FLOOR = 0.5;
const CMBS_Z_FLOOR = -0.5;

export function adviseExitTiming(
  inputs: Readonly<ExitTimingInputs>,
): ExitTimingResult {
  const irrSpreadBps = (inputs.holdingHurdle - inputs.forwardIRR24mo) * 10_000;
  const capSpreadBps = (inputs.entryCapRate - inputs.marketCapRate) * 10_000;
  const netBasisAfterRecapture =
    inputs.taxBasis * (1 - inputs.depreciationRecapture);

  const triggers = [
    {
      name: 'forward-irr-below-hurdle',
      met: irrSpreadBps > IRR_SPREAD_BPS,
      threshold: `forwardIRR < holdingHurdle - ${IRR_SPREAD_BPS} bps`,
      actual: `${irrSpreadBps.toFixed(0)} bps shortfall`,
    },
    {
      name: 'cap-compression-realised',
      met: capSpreadBps >= CAP_SPREAD_BPS,
      threshold: `market cap ≤ entry cap - ${CAP_SPREAD_BPS} bps`,
      actual: `${capSpreadBps.toFixed(0)} bps compression`,
    },
    {
      name: 'no-tax-trap',
      met: netBasisAfterRecapture > inputs.debtPaydown,
      threshold: 'net basis after recapture > debt paydown',
      actual: `net ${netBasisAfterRecapture.toFixed(0)} vs debt ${inputs.debtPaydown.toFixed(0)}`,
    },
    {
      name: 'rca-liquid-market',
      met: inputs.rcaVelocityZ > RCA_Z_FLOOR,
      threshold: `RCA velocity z > ${RCA_Z_FLOOR}`,
      actual: `${inputs.rcaVelocityZ.toFixed(2)}σ`,
    },
    {
      name: 'cmbs-debt-open',
      met: inputs.cmbsIssuanceZ > CMBS_Z_FLOOR,
      threshold: `CMBS issuance z > ${CMBS_Z_FLOOR}`,
      actual: `${inputs.cmbsIssuanceZ.toFixed(2)}σ`,
    },
  ];

  const score = triggers.filter((t) => t.met).length;
  let verdict: ExitTimingResult['verdict'];
  if (score >= 4) verdict = 'sell-now';
  else if (score === 3) verdict = 'soft-test';
  else verdict = 'continue-hold';

  return {
    assetId: inputs.assetId,
    verdict,
    score,
    triggers,
  };
}
