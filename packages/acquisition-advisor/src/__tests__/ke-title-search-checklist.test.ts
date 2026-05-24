import { describe, expect, it } from 'vitest';
import { scoreAncestralClaim } from '../ea-jurisdictional/ancestral-claim-risk-scorer.js';
import { checkKETitleSearch } from '../ea-jurisdictional/ke-title-search-checklist.js';
import { checkTZTitleSearch } from '../ea-jurisdictional/tz-title-search-checklist.js';
import { checkUGTitleSearch } from '../ea-jurisdictional/ug-title-search-checklist.js';

describe('checkKETitleSearch', () => {
  it('clean when everything passes', () => {
    const r = checkKETitleSearch({
      lrNumber: 'LR12345',
      nlimsRegistered: true,
      tenureType: 'freehold',
      mortgageRegistered: false,
      caveats: [],
      restrictionsRegistered: false,
      spousalConsentObtained: true,
      ratesClearance: true,
      landRentClearance: true,
      surveyPlanReconciled: true,
      lcbConsentRequired: false,
      lcbConsentObtained: false,
      knownDoubleAllotmentRisk: false,
      inPublicLandWatchlist: false,
    });
    expect(r.verdict).toBe('clean');
    expect(r.criticalGaps.length).toBe(0);
  });

  it('unworkable when public-land watchlist + caveat both flagged', () => {
    const r = checkKETitleSearch({
      lrNumber: 'LR12345',
      nlimsRegistered: false,
      tenureType: 'freehold',
      mortgageRegistered: false,
      caveats: ['Caveat 1'],
      restrictionsRegistered: false,
      spousalConsentObtained: true,
      ratesClearance: true,
      landRentClearance: true,
      surveyPlanReconciled: true,
      lcbConsentRequired: false,
      lcbConsentObtained: false,
      knownDoubleAllotmentRisk: false,
      inPublicLandWatchlist: true,
    });
    expect(r.verdict).toBe('unworkable');
  });

  it('requires-cure when only spousal consent missing', () => {
    const r = checkKETitleSearch({
      lrNumber: 'LR12345',
      nlimsRegistered: true,
      tenureType: 'freehold',
      mortgageRegistered: false,
      caveats: [],
      restrictionsRegistered: false,
      spousalConsentObtained: false,
      ratesClearance: true,
      landRentClearance: true,
      surveyPlanReconciled: true,
      lcbConsentRequired: false,
      lcbConsentObtained: false,
      knownDoubleAllotmentRisk: false,
      inPublicLandWatchlist: false,
    });
    expect(r.verdict).toBe('requires-cure');
    expect(r.criticalGaps).toContain('spousalConsent');
  });

  it('agricultural land must have LCB consent', () => {
    const r = checkKETitleSearch({
      lrNumber: 'LR12345',
      nlimsRegistered: true,
      tenureType: 'freehold',
      mortgageRegistered: false,
      caveats: [],
      restrictionsRegistered: false,
      spousalConsentObtained: true,
      ratesClearance: true,
      landRentClearance: true,
      surveyPlanReconciled: true,
      lcbConsentRequired: true,
      lcbConsentObtained: false,
      knownDoubleAllotmentRisk: false,
      inPublicLandWatchlist: false,
    });
    expect(r.criticalGaps).toContain('lcbConsent');
  });
});

describe('checkTZTitleSearch', () => {
  it('clean for general-land CT with all checks', () => {
    const r = checkTZTitleSearch({
      titleClass: 'general',
      certificateType: 'CT',
      issueYear: 2010,
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
    expect(r.verdict).toBe('clean');
  });

  it('rejects mismatched cert type + class', () => {
    const r = checkTZTitleSearch({
      titleClass: 'general',
      certificateType: 'CCRO',
      issueYear: 2010,
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
    expect(r.criticalGaps).toContain('certificateTypeMatchesClass');
  });

  it('customary overlap risk is critical', () => {
    const r = checkTZTitleSearch({
      titleClass: 'general',
      certificateType: 'CT',
      issueYear: 2010,
      termYears: 99,
      encumbrancesRegistered: false,
      caveats: [],
      traTaxClearance: true,
      surveyDiagramOnFile: true,
      plotRentClearance: true,
      villageCouncilAttestation: false,
      nemcStatusClean: true,
      customaryOverlapRisk: true,
    });
    expect(r.criticalGaps).toContain('noCustomaryOverlap');
  });

  it('village-class title requires council attestation', () => {
    const r = checkTZTitleSearch({
      titleClass: 'village',
      certificateType: 'CCRO',
      issueYear: 2018,
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
    expect(r.criticalGaps).toContain('villageCouncilAttestation');
  });
});

describe('checkUGTitleSearch', () => {
  it('clean Mailo title with all checks', () => {
    const r = checkUGTitleSearch({
      tenureSystem: 'mailo',
      whitePageSearchClean: true,
      encroachmentSearchClean: true,
      bibanjaHoldersPresent: false,
      spousalConsentObtained: true,
      kccaRatesClearance: true,
      nemaStatusClean: true,
      demdAuthenticated: true,
      overlappingCustomaryClaim: false,
    });
    expect(r.verdict).toBe('clean');
  });

  it('bibanja holders on Mailo land are critical', () => {
    const r = checkUGTitleSearch({
      tenureSystem: 'mailo',
      whitePageSearchClean: true,
      encroachmentSearchClean: true,
      bibanjaHoldersPresent: true,
      spousalConsentObtained: true,
      kccaRatesClearance: true,
      nemaStatusClean: true,
      demdAuthenticated: true,
      overlappingCustomaryClaim: false,
    });
    expect(r.criticalGaps).toContain('noBibanjaHolders');
  });

  it('leasehold with short term warns', () => {
    const r = checkUGTitleSearch({
      tenureSystem: 'leasehold',
      leaseTermYears: 5,
      whitePageSearchClean: true,
      encroachmentSearchClean: true,
      bibanjaHoldersPresent: false,
      spousalConsentObtained: true,
      kccaRatesClearance: true,
      nemaStatusClean: true,
      demdAuthenticated: false, // not required for leasehold
      overlappingCustomaryClaim: false,
    });
    expect(r.checklist.some((c) => c.key === 'leaseTermAcceptable' && !c.passed)).toBe(true);
  });
});

describe('scoreAncestralClaim', () => {
  it('low band for clean modern title with quiet-title decree', () => {
    const r = scoreAncestralClaim({
      distanceToCustomaryTenureKm: 30,
      titleAgeYears: 40,
      titleGenesisPath: 'grant',
      heirCount: 1,
      villageElderAttestationObtained: true,
      quietTitleDecreeObtained: true,
      pendingLandCourtLitigation: false,
    });
    expect(r.band).toBe('low');
  });

  it('severe band for fresh title in customary zone with litigation', () => {
    const r = scoreAncestralClaim({
      distanceToCustomaryTenureKm: 0.5,
      titleAgeYears: 2,
      titleGenesisPath: 'unknown',
      heirCount: 8,
      villageElderAttestationObtained: false,
      quietTitleDecreeObtained: false,
      pendingLandCourtLitigation: true,
    });
    expect(r.band).toBe('severe');
    expect(r.recommendedActions.length).toBeGreaterThan(0);
  });

  it('rejects negative inputs', () => {
    expect(() =>
      scoreAncestralClaim({
        distanceToCustomaryTenureKm: -1,
        titleAgeYears: 10,
        titleGenesisPath: 'grant',
        heirCount: 1,
        villageElderAttestationObtained: true,
        quietTitleDecreeObtained: true,
        pendingLandCourtLitigation: false,
      }),
    ).toThrow();
  });
});
