import { describe, expect, it } from 'vitest';
import { orchestrateLifecycle } from '../advisor/lifecycle-orchestrator.js';

describe('lifecycle-orchestrator', () => {
  it('returns development recommendation for pre-development stage', () => {
    const r = orchestrateLifecycle({
      assetId: 'A1',
      stage: 'pre-development',
      feasibility: {
        assetId: 'A1',
        totalDevelopmentCost: 100_000_000,
        stabilisedNOI: 10_500_000,
        goingInCapRate: 0.075,
        hurdleIRR: 0.12,
        projectIRR: 0.18,
        peakEquity: 30_000_000,
        ownerEquityCapacity: 50_000_000,
        hardContingencyPct: 0.08,
        softContingencyPct: 0.12,
        ltc: 0.65,
        ltv: 0.55,
      },
    });
    expect(r.recommendations.length).toBeGreaterThan(0);
    expect(r.nextBestAction.domain).toBe('development');
  });

  it('returns critical recommendation when feasibility redesigns', () => {
    const r = orchestrateLifecycle({
      assetId: 'A1',
      stage: 'pre-development',
      feasibility: {
        assetId: 'A1',
        totalDevelopmentCost: 100_000_000,
        stabilisedNOI: 4_000_000, // too low
        goingInCapRate: 0.075,
        hurdleIRR: 0.12,
        projectIRR: 0.06,
        peakEquity: 60_000_000,
        ownerEquityCapacity: 50_000_000,
        hardContingencyPct: 0.04,
        softContingencyPct: 0.05,
        ltc: 0.85,
        ltv: 0.80,
      },
    });
    expect(r.nextBestAction.priority).toBe('critical');
  });

  it('returns disposition recommendation in window stage', () => {
    const r = orchestrateLifecycle({
      assetId: 'A1',
      stage: 'disposition-window',
      exitTiming: {
        assetId: 'A1',
        forwardIRR24mo: 0.06,
        holdingHurdle: 0.10,
        marketCapRate: 0.060,
        entryCapRate: 0.075,
        taxBasis: 50_000_000,
        depreciationRecapture: 0.20,
        debtPaydown: 20_000_000,
        rcaVelocityZ: 0.8,
        cmbsIssuanceZ: 0.2,
      },
      buyerPipeline: {
        buyers: [
          {
            id: 'I1', name: 'Pension', tier: 'institutional',
            assetClassFit: 0.9, capRateAppetiteFit: 0.85,
            ticketSizeFit: 1.0, buyerPoolActivity: 0.8,
          },
        ],
      },
    });
    expect(r.recommendations.some((rc) => rc.domain === 'disposition')).toBe(true);
  });

  it('returns refi recommendation on refi-window', () => {
    const r = orchestrateLifecycle({
      assetId: 'A1',
      stage: 'refi-window',
      lenderSelection: {
        assetClass: 'multifamily',
        jurisdiction: 'KE',
        dealSize: 5_000_000,
        desiredLTV: 0.60,
        desiredTermYears: 7,
        transitional: false,
        trophyAsset: false,
      },
    });
    expect(r.recommendations.some((rc) => rc.domain === 'refinancing')).toBe(true);
  });

  it('returns IR recommendation on stabilised-hold with reporting', () => {
    const r = orchestrateLifecycle({
      assetId: 'A1',
      stage: 'stabilised-hold',
      reportingCadence: {
        tier: 'institutional',
        fundSize: 100_000_000,
        investorCount: 20,
      },
    });
    expect(r.recommendations.some((rc) => rc.domain === 'investor-relations')).toBe(true);
  });

  it('falls back to no-data action when nothing supplied', () => {
    const r = orchestrateLifecycle({
      assetId: 'A1',
      stage: 'lease-up',
    });
    expect(r.nextBestAction).toBeDefined();
    expect(r.nextBestAction.confidence).toBeLessThan(0.5);
  });

  it('escalates covenant breach to critical regardless of stage', () => {
    const r = orchestrateLifecycle({
      assetId: 'A1',
      stage: 'stabilised-hold',
      covenantStatus: {
        actualDSCR: 1.05,
        actualDebtYield: 0.07,
        actualOccupancyPct: 0.70,
        actualCapexReservePerSqftPerYr: 0.10,
        trailing12MoNOITrend: -3,
        grossSqft: 50_000,
        debtBalance: 40_000_000,
        covenants: {
          minDSCR: 1.25,
          minDebtYield: 0.08,
          minOccupancyPct: 0.85,
          minCapexReservePerSqftPerYr: 0.25,
          distributionLockboxDSCR: 1.20,
          springingLockboxDSCR: 1.10,
        },
      },
    });
    expect(r.nextBestAction.priority).toBe('critical');
    expect(r.nextBestAction.domain).toBe('refinancing');
  });

  it('sorts recommendations by priority', () => {
    const r = orchestrateLifecycle({
      assetId: 'A1',
      stage: 'disposition-window',
      exitTiming: {
        assetId: 'A1',
        forwardIRR24mo: 0.06,
        holdingHurdle: 0.10,
        marketCapRate: 0.060,
        entryCapRate: 0.075,
        taxBasis: 50_000_000,
        depreciationRecapture: 0.20,
        debtPaydown: 20_000_000,
        rcaVelocityZ: 0.8,
        cmbsIssuanceZ: 0.2,
      },
      reportingCadence: {
        tier: 'institutional',
        fundSize: 100_000_000,
        investorCount: 20,
      },
    });
    // Priority should be sorted: high (exit) before low (reporting)
    const priorities = r.recommendations.map((rc) => rc.priority);
    const idxHigh = priorities.indexOf('high');
    const idxLow = priorities.indexOf('low');
    if (idxHigh !== -1 && idxLow !== -1) {
      expect(idxHigh).toBeLessThan(idxLow);
    }
  });
});
