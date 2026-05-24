/**
 * Loan-covenant compliance scanner — reports DSCR / debt-yield /
 * occupancy / capex-reserve breaches plus distribution &
 * springing-lockbox triggers.
 *
 * Authority: CMSA / CREFC Investor Reporting Package (IRP) 2024.
 *
 * Months-to-breach uses the trailing-12-month NOI trend (linear
 * extrapolation): months = (actual - threshold) / monthly delta.
 */

import type {
  CovenantBreach,
  CovenantStatusInputs,
  CovenantStatusResult,
} from '../types.js';

function monthsToBreach(
  current: number,
  threshold: number,
  trendPctPerMonth: number,
): number | undefined {
  if (current <= threshold) return 0;
  if (trendPctPerMonth >= 0) return undefined;
  // current * (1 + trend)^m = threshold → m = log(threshold/current) / log(1+trend)
  const ratio = threshold / current;
  if (ratio <= 0) return undefined;
  const m = Math.log(ratio) / Math.log(1 + trendPctPerMonth);
  return m > 0 && Number.isFinite(m) ? m : undefined;
}

function cureCostForDSCR(
  actualDS: number,
  requiredDSCR: number,
  noi: number,
): number {
  // To restore DSCR to requirement, principal paydown that reduces DS proportionally
  // ds_new = noi / requiredDSCR → reduction = actualDS - ds_new
  // approximate cure cost as the principal reduction × annuity factor 10 (rough multiple)
  const required = noi / requiredDSCR;
  if (actualDS <= required) return 0;
  return (actualDS - required) * 10;
}

export function scanCovenants(
  inputs: Readonly<CovenantStatusInputs>,
): CovenantStatusResult {
  const cov = inputs.covenants;
  const trendPerMonth = inputs.trailing12MoNOITrend / 12 / 100; // convert pct/year to fraction/month
  // Implied DS = NOI / actualDSCR
  const impliedNOI = inputs.actualDSCR * (inputs.debtBalance > 0 ? inputs.debtBalance / 12 : 1);
  // For cure cost we need NOI; reverse-engineer from debt yield
  const noi = inputs.actualDebtYield * inputs.debtBalance;
  const debtServiceAnnual = noi / Math.max(1e-9, inputs.actualDSCR);

  const dscrMonthsToBreach =
    inputs.actualDSCR >= cov.minDSCR
      ? monthsToBreach(inputs.actualDSCR, cov.minDSCR, trendPerMonth)
      : undefined;
  const dyMonthsToBreach =
    inputs.actualDebtYield >= cov.minDebtYield
      ? monthsToBreach(inputs.actualDebtYield, cov.minDebtYield, trendPerMonth)
      : undefined;

  const breaches: CovenantBreach[] = [
    {
      covenant: 'DSCR',
      required: cov.minDSCR,
      actual: inputs.actualDSCR,
      breached: inputs.actualDSCR < cov.minDSCR,
      ...(dscrMonthsToBreach !== undefined ? { monthsToBreach: dscrMonthsToBreach } : {}),
      cureCost: cureCostForDSCR(debtServiceAnnual, cov.minDSCR, noi),
    },
    {
      covenant: 'debt-yield',
      required: cov.minDebtYield,
      actual: inputs.actualDebtYield,
      breached: inputs.actualDebtYield < cov.minDebtYield,
      ...(dyMonthsToBreach !== undefined ? { monthsToBreach: dyMonthsToBreach } : {}),
    },
    {
      covenant: 'occupancy',
      required: cov.minOccupancyPct,
      actual: inputs.actualOccupancyPct,
      breached: inputs.actualOccupancyPct < cov.minOccupancyPct,
    },
    {
      covenant: 'capex-reserve',
      required: cov.minCapexReservePerSqftPerYr,
      actual: inputs.actualCapexReservePerSqftPerYr,
      breached: inputs.actualCapexReservePerSqftPerYr < cov.minCapexReservePerSqftPerYr,
      cureCost: Math.max(
        0,
        (cov.minCapexReservePerSqftPerYr - inputs.actualCapexReservePerSqftPerYr) *
          inputs.grossSqft,
      ),
    },
  ];

  const distributionLockboxTriggered = inputs.actualDSCR < cov.distributionLockboxDSCR;
  const springingLockboxTriggered = inputs.actualDSCR < cov.springingLockboxDSCR;
  const hasActiveBreach = breaches.some((b) => b.breached);

  void impliedNOI; // touched for clarity; not exported
  return {
    breaches,
    hasActiveBreach,
    distributionLockboxTriggered,
    springingLockboxTriggered,
  };
}
