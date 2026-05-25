import { describe, expect, it } from 'vitest';
import { recommendAcquisition } from '../advisor/acquisition-recommender.js';
import { decideGoNoGo } from '../advisor/go-no-go-decision.js';
import { computeCapRateDerivative } from '../comps/cap-rate-derivative.js';
import { triangulateSales } from '../comps/sale-triangulator.js';
import { checkRentRollIntegrity } from '../financial/rent-roll-integrity.js';
import { validateT12T3 } from '../financial/t12-t3-validator.js';
import { scoreFloodRisk } from '../geo-risk/flood-zone-risk.js';
import { scoreSeismicRisk } from '../geo-risk/seismic-risk.js';
import { scoreSlopeStability } from '../geo-risk/slope-stability.js';
import { LOI_AXES, scoreLOI } from '../loi-psa/loi-25-axis-scorer.js';
import { flagPSAClauses } from '../loi-psa/psa-clause-flagger.js';
import { scopePhase1 } from '../environmental/phase1-scoping.js';
import { checkTZTitleSearch } from '../ea-jurisdictional/tz-title-search-checklist.js';
import { scoreAncestralClaim } from '../ea-jurisdictional/ancestral-claim-risk-scorer.js';
import { readAltaCommitment } from '../title/alta-commitment-reader.js';
import { readAltaSurvey } from '../survey/alta-survey-reader.js';
import { analyzeEntitlementPath } from '../zoning/entitlement-path-analyzer.js';
import type {
  ComparableSale,
  DealSnapshot,
  LOIAxisRating,
  RentRollUnit,
} from '../types.js';

const darDeal: DealSnapshot = {
  id: 'DAR-50U-2026-001',
  subMarket: 'Masaki, Dar es Salaam',
  jurisdiction: 'TZ',
  assetClass: 'multifamily',
  askingPrice: 4_500_000,
  currency: 'USD',
  nlaSqm: 3_500,
  siteAreaSqm: 1_800,
  lat: -6.7424,
  lng: 39.2783,
  t12EGI: 480_000,
  t12Opex: 165_000,
  units: 50,
  yearBuilt: 2014,
  yearRenovated: 2022,
  zoning: 'R3',
};

const darComps: ComparableSale[] = [
  { id: 'd1', salePricePerSqm: 1280, distanceMetres: 400, monthsAgo: 4, sizeSqm: 3300, assetClass: 'multifamily', qualitySimilarity: 0.92, capRate: 0.085 },
  { id: 'd2', salePricePerSqm: 1340, distanceMetres: 900, monthsAgo: 9, sizeSqm: 3700, assetClass: 'multifamily', qualitySimilarity: 0.85, capRate: 0.079 },
  { id: 'd3', salePricePerSqm: 1220, distanceMetres: 1100, monthsAgo: 13, sizeSqm: 3500, assetClass: 'multifamily', qualitySimilarity: 0.78, capRate: 0.090 },
  { id: 'd4', salePricePerSqm: 1310, distanceMetres: 700, monthsAgo: 6, sizeSqm: 3600, assetClass: 'multifamily', qualitySimilarity: 0.88, capRate: 0.081 },
  { id: 'd5', salePricePerSqm: 1295, distanceMetres: 850, monthsAgo: 11, sizeSqm: 3550, assetClass: 'multifamily', qualitySimilarity: 0.82, capRate: 0.083 },
];

const rentRoll: RentRollUnit[] = Array.from({ length: 50 }, (_, i) => ({
  unitId: `D${(i + 101).toString()}`,
  tenant: `Tenant ${i + 1}`,
  leaseStart: '2024-06-01',
  leaseEnd: '2026-05-31',
  monthlyRent: 800,
  marketRent: 900,
  securityDeposit: 800,
  concessionMonths: 0,
}));

describe('acquisition-recommender — Dar es Salaam 50-unit residential', () => {
  const triangulation = triangulateSales(darComps, {
    maxMonthsAgo: 18,
    maxDistanceMetres: 1600,
    assetClass: 'multifamily',
    subjectSizeSqm: 3500,
    sizeTolerance: 0.3,
  });
  const capDerivative = computeCapRateDerivative({
    comps: darComps,
    riskFreeRate: 0.075,
  });

  const cleanLoi: LOIAxisRating[] = LOI_AXES.map((key) => ({
    key,
    score: 4 as LOIAxisRating['score'],
    notes: '',
  }));
  const loi = scoreLOI(cleanLoi);
  const psa = flagPSAClauses({
    clauses: LOI_AXES.map((key) => ({
      key: key as never,
      present: true,
      buyerFavorable: true,
    })),
    jurisdiction: 'TZ',
  });
  const phase1 = scopePhase1({
    findings: [
      { id: 'h1', category: 'HREC', contaminant: 'naphthalene', mediaAffected: ['soil'], historicalUse: 'closed UST 1995', distanceMetres: 60, recommendedNextStep: 'noAction' },
    ],
  });
  const altaCommitment = readAltaCommitment({
    exceptions: [
      { id: 'u1', type: 'utilityEasement', description: 'TANESCO power easement', impactScore: 1, curableAtClose: false },
    ],
    standardExceptionsDeletable: true,
  });
  const survey = readAltaSurvey({
    hasMonuments: true,
    hasFloodZone: true,
    hasZoningSummary: true,
    encroachments: [],
    setbackViolations: [],
  });
  const entitlement = analyzeEntitlementPath({
    path: 'by-right',
    jurisdiction: 'TZ',
    oppositionScore: 25,
  });
  const seismic = scoreSeismicRisk({ pga: 0.04, siteClass: 'D' });
  const flood = scoreFloodRisk({ eaRiskBand: 'low' });
  const slope = scoreSlopeStability({ slopePct: 4 });
  const t12 = validateT12T3({
    t12Egi: 480_000,
    t12Opex: 165_000,
    t12NoiReported: 315_000,
    t3EgiAnnualized: 482_000,
    t3OpexAnnualized: 168_000,
    t3NoiAnnualizedReported: 314_000,
    rentRollGpr: 540_000,
    rentRollEgi: 480_000,
    hasStudentHousingSeasonality: false,
  });
  const rr = checkRentRollIntegrity(rentRoll);
  const tzTitle = checkTZTitleSearch({
    titleClass: 'general',
    certificateType: 'CT',
    issueYear: 2014,
    termYears: 99,
    encumbrancesRegistered: false,
    caveats: [],
    traTaxClearance: true,
    surveyDiagramOnFile: true,
    plotRentClearance: true,
    villageCouncilAttestation: false,
    nemcStatusClean: true,
    customaryOverlapRisk: false,
  });
  const ancestral = scoreAncestralClaim({
    distanceToCustomaryTenureKm: 25,
    titleAgeYears: 12,
    titleGenesisPath: 'grant',
    heirCount: 1,
    villageElderAttestationObtained: true,
    quietTitleDecreeObtained: true,
    pendingLandCourtLitigation: false,
  });

  const rec = recommendAcquisition({
    deal: darDeal,
    saleTriangulation: triangulation,
    capRateDerivative: capDerivative,
    loi,
    psaFlags: psa,
    phase1,
    altaCommitment,
    survey,
    entitlement,
    seismic,
    flood,
    slope,
    t12t3: t12,
    rentRoll: rr,
    tzTitle,
    ancestralClaim: ancestral,
    marketCapRate: 0.085,
  });

  it('produces a defensible recommendation', () => {
    expect(rec.dealId).toBe('DAR-50U-2026-001');
    expect(rec.verdict).toMatch(/go|proceed-with-conditions/);
    expect(rec.composite).toBeGreaterThan(0.55);
  });

  it('emits non-zero pricing recommendation', () => {
    expect(rec.pricingRecommendation.blendedRecommendedOffer).toBeGreaterThan(0);
    expect(rec.pricingRecommendation.walkAwayCeiling).toBeGreaterThan(
      rec.pricingRecommendation.blendedRecommendedOffer,
    );
  });

  it('emits narrative with deal id + verdict', () => {
    expect(rec.narrative).toContain('DAR-50U-2026-001');
    expect(rec.narrative.length).toBeGreaterThan(80);
  });

  it('emits confidence in [0,1]', () => {
    expect(rec.confidence).toBeGreaterThanOrEqual(0);
    expect(rec.confidence).toBeLessThanOrEqual(1);
  });

  it('emits closing checklist that excludes lis pendens (none in inputs)', () => {
    for (const item of rec.closingChecklist) {
      expect(item).not.toMatch(/lis pendens/i);
    }
  });
});

describe('decideGoNoGo', () => {
  it('full pass → go', () => {
    const d = decideGoNoGo({
      financialFitScore: 1,
      compTriangulationScore: 1,
      environmentalScore: 1,
      titleScore: 1,
      surveyScore: 1,
      zoningScore: 1,
      geotechScore: 1,
      financialDDScore: 1,
      eaJurisdictionalScore: 1,
    });
    expect(d.verdict).toBe('go');
    expect(d.composite).toBeCloseTo(1, 2);
  });

  it('full fail → no-go', () => {
    const d = decideGoNoGo({
      financialFitScore: 0,
      compTriangulationScore: 0,
      environmentalScore: 0,
      titleScore: 0,
      surveyScore: 0,
      zoningScore: 0,
      geotechScore: 0,
      financialDDScore: 0,
      eaJurisdictionalScore: 0,
    });
    expect(d.verdict).toBe('no-go');
  });

  it('rejects out-of-range score', () => {
    expect(() =>
      decideGoNoGo({
        financialFitScore: 1.2,
        compTriangulationScore: 1,
        environmentalScore: 1,
        titleScore: 1,
        surveyScore: 1,
        zoningScore: 1,
        geotechScore: 1,
        financialDDScore: 1,
        eaJurisdictionalScore: 1,
      }),
    ).toThrow();
  });
});
