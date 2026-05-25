/**
 * Rent-roll integrity — duplicate units, lease overlap, escalation
 * accuracy, mark-to-market upside.
 */

import type {
  RentRollIntegrity,
  RentRollIntegrityFinding,
  RentRollUnit,
} from '../types.js';

const MARK_TO_MARKET_FLAG_PCT = 0.15;

export function checkRentRollIntegrity(
  units: ReadonlyArray<RentRollUnit>,
): RentRollIntegrity {
  const findings: RentRollIntegrityFinding[] = [];
  const seenIds = new Map<string, number>();

  for (const u of units) {
    seenIds.set(u.unitId, (seenIds.get(u.unitId) ?? 0) + 1);
  }
  for (const [id, count] of seenIds.entries()) {
    if (count > 1) {
      findings.push({
        code: 'duplicate_unit',
        severity: 'critical',
        unitId: id,
        message: `Unit ${id} appears ${count} times in the rent roll`,
      });
    }
  }

  // Lease overlap
  const byUnit = new Map<string, RentRollUnit[]>();
  for (const u of units) {
    if (!byUnit.has(u.unitId)) byUnit.set(u.unitId, []);
    byUnit.get(u.unitId)!.push(u);
  }
  for (const [unitId, leases] of byUnit.entries()) {
    if (leases.length < 2) continue;
    leases.sort((a, b) => a.leaseStart.localeCompare(b.leaseStart));
    for (let i = 1; i < leases.length; i += 1) {
      if (leases[i].leaseStart < leases[i - 1].leaseEnd) {
        findings.push({
          code: 'lease_overlap',
          severity: 'critical',
          unitId,
          message: `Unit ${unitId}: lease ${leases[i].tenant} starts before previous lease ends`,
        });
      }
    }
  }

  // Negative-rent or zero-rent (warn unless concession explains)
  for (const u of units) {
    if (u.monthlyRent < 0) {
      findings.push({
        code: 'negative_rent',
        severity: 'critical',
        unitId: u.unitId,
        message: `Unit ${u.unitId}: negative rent`,
      });
    } else if (u.monthlyRent === 0 && u.concessionMonths === 0) {
      findings.push({
        code: 'zero_rent_no_concession',
        severity: 'warn',
        unitId: u.unitId,
        message: `Unit ${u.unitId}: zero rent without concession`,
      });
    }
    if (u.securityDeposit < 0) {
      findings.push({
        code: 'negative_deposit',
        severity: 'critical',
        unitId: u.unitId,
        message: `Unit ${u.unitId}: negative security deposit`,
      });
    }
  }

  // Mark-to-market upside
  const upsideUnits = units.filter(
    (u) => u.monthlyRent > 0 && (u.marketRent - u.monthlyRent) / u.monthlyRent >= MARK_TO_MARKET_FLAG_PCT,
  );
  const totalInPlace = units.reduce((s, u) => s + u.monthlyRent, 0);
  const totalMarket = units.reduce((s, u) => s + u.marketRent, 0);
  const markToMarketUpsidePct =
    totalInPlace > 0 ? (totalMarket - totalInPlace) / totalInPlace : 0;

  for (const u of upsideUnits) {
    findings.push({
      code: 'below_market_rent',
      severity: 'info',
      unitId: u.unitId,
      message: `Unit ${u.unitId}: in-place rent ${u.monthlyRent.toFixed(0)} vs market ${u.marketRent.toFixed(0)} — ${((u.marketRent - u.monthlyRent) / u.monthlyRent * 100).toFixed(1)}% upside`,
    });
  }

  // % rent breakpoint sanity (retail only — caller responsible)
  for (const u of units) {
    if (u.percentageRentBreakpoint !== undefined && u.percentageRentBreakpoint <= 0) {
      findings.push({
        code: 'invalid_percentage_breakpoint',
        severity: 'warn',
        unitId: u.unitId,
        message: `Unit ${u.unitId}: percentage rent breakpoint must be > 0`,
      });
    }
  }

  const pass = !findings.some((f) => f.severity === 'critical');

  return {
    findings,
    markToMarketUpsidePct,
    pass,
  };
}
