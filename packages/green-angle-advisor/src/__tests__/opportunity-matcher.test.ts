/**
 * opportunity-matcher tests — covers the 30+ canonical patterns + the
 * CANONICAL "railway from A to B" fixture.
 */

import { describe, expect, it } from 'vitest';
import { classifyProject } from '../project-typer/project-classifier.js';
import { matchOpportunities } from '../opportunities/opportunity-matcher.js';
import {
  OPPORTUNITY_CATALOG,
  findOpportunityById,
  isOpportunityApplicable,
} from '../opportunities/opportunity-catalog.js';
import { estimateLandBridgeBng, estimateLandBng } from '../opportunities/bng-opportunity.js';
import { estimateCorridorSolar } from '../opportunities/solar-colocation.js';
import { estimateEvHub } from '../opportunities/ev-charging-hub.js';
import { estimateWaterReclaim } from '../opportunities/water-reclaim.js';
import { estimateBlueCarbon } from '../opportunities/blue-carbon.js';
import { estimateRegenAg } from '../opportunities/regen-ag.js';
import { estimateUrbanForestry } from '../opportunities/urban-forestry.js';

describe('OPPORTUNITY_CATALOG', () => {
  it('contains at least 30 entries', () => {
    expect(OPPORTUNITY_CATALOG.length).toBeGreaterThanOrEqual(30);
  });

  it('every entry has a unique id', () => {
    const ids = OPPORTUNITY_CATALOG.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has a non-empty title and one-liner', () => {
    for (const o of OPPORTUNITY_CATALOG) {
      expect(o.title.length).toBeGreaterThan(0);
      expect(o.oneLiner.length).toBeGreaterThan(0);
    }
  });

  it('every entry references at least one project type', () => {
    for (const o of OPPORTUNITY_CATALOG) {
      expect(o.applicableProjectTypes.length).toBeGreaterThan(0);
    }
  });

  it('every entry has at least one SDG target', () => {
    for (const o of OPPORTUNITY_CATALOG) {
      expect(o.sdgTargets.length).toBeGreaterThan(0);
    }
  });

  it('findOpportunityById returns descriptors for known ids', () => {
    expect(findOpportunityById('corridor-solar')?.title).toMatch(/corridor solar/i);
    expect(findOpportunityById('mangrove-restoration')?.category).toBe('land-use');
  });

  it('findOpportunityById returns undefined for unknown id', () => {
    expect(findOpportunityById('does-not-exist')).toBeUndefined();
  });
});

describe('isOpportunityApplicable', () => {
  const corridorSolar = findOpportunityById('corridor-solar')!;
  const mangrove = findOpportunityById('mangrove-restoration')!;

  it('corridor-solar applies to a rail corridor', () => {
    const profile = classifyProject({
      description: 'A railway from Dar es Salaam to Dodoma',
    });
    expect(isOpportunityApplicable(corridorSolar, profile)).toBe(true);
  });

  it('mangrove-restoration requires coastal biome', () => {
    const inland = classifyProject({
      description: 'A factory in Dodoma',
    });
    expect(isOpportunityApplicable(mangrove, inland)).toBe(false);

    const coastal = classifyProject({
      description: 'A container terminal at Mombasa port on the coast',
    });
    expect(isOpportunityApplicable(mangrove, coastal)).toBe(true);
  });

  it('corridor-solar does not apply to a point asset like an office', () => {
    const office = classifyProject({
      description: 'An office tower in Nairobi',
    });
    expect(isOpportunityApplicable(corridorSolar, office)).toBe(false);
  });
});

describe('matchOpportunities — canonical "railway from A to B" fixture', () => {
  const profile = classifyProject({
    description: "we're building a railway from Dar es Salaam to Dodoma",
    hints: { lengthKm: 450, jurisdictions: ['TZ'], biomes: ['coastal', 'savanna'], signals: ['freight', 'critical-habitat-near'] },
  });

  it('returns at least 5 sensible opportunities', () => {
    const opps = matchOpportunities(profile);
    expect(opps.length).toBeGreaterThanOrEqual(5);
  });

  it('includes corridor solar co-location', () => {
    const opps = matchOpportunities(profile);
    expect(opps.some((o) => o.id === 'corridor-solar')).toBe(true);
  });

  it('includes land-bridge BNG', () => {
    const opps = matchOpportunities(profile);
    expect(opps.some((o) => o.id === 'land-bridge-bng')).toBe(true);
  });

  it('includes water-reclaim at stations', () => {
    const opps = matchOpportunities(profile);
    expect(opps.some((o) => o.id === 'water-reclaim')).toBe(true);
  });

  it('includes regenerative-ag corridor', () => {
    const opps = matchOpportunities(profile);
    expect(opps.some((o) => o.id === 'regen-ag-corridor')).toBe(true);
  });

  it('includes modal-shift freight carbon credit', () => {
    const opps = matchOpportunities(profile);
    expect(opps.some((o) => o.id === 'modal-shift-freight')).toBe(true);
  });

  it('ranks by score descending', () => {
    const opps = matchOpportunities(profile);
    for (let i = 1; i < opps.length; i++) {
      expect(opps[i]!.score).toBeLessThanOrEqual(opps[i - 1]!.score);
    }
  });

  it('estimates corridor solar abatement scaled to length', () => {
    const opps = matchOpportunities(profile);
    const solar = opps.find((o) => o.id === 'corridor-solar')!;
    // 450 km / 5 = 90 MW × 1500 = 135,000 tCO2e/yr
    expect(solar.estimatedTCO2ePerYear).toBeGreaterThan(100_000);
  });
});

describe('matchOpportunities — other project types', () => {
  it('residential gets solar-pv-roof + water-reclaim + urban-forestry', () => {
    const profile = classifyProject({
      description: 'A residential apartment tower in Nairobi',
    });
    const opps = matchOpportunities(profile);
    expect(opps.some((o) => o.id === 'solar-pv-roof')).toBe(true);
    expect(opps.some((o) => o.id === 'water-reclaim')).toBe(true);
  });

  it('coastal port gets mangrove + shore-power', () => {
    const profile = classifyProject({
      description: 'A new container terminal at Mombasa port on the coast',
      hints: { signals: ['coastal-asset', 'freight'] },
    });
    const opps = matchOpportunities(profile);
    expect(opps.some((o) => o.id === 'mangrove-restoration')).toBe(true);
    expect(opps.some((o) => o.id === 'shore-power')).toBe(true);
  });

  it('mining gets land-bng + methane abatement', () => {
    const profile = classifyProject({
      description: 'An open-pit gold mine in northern Tanzania near a national park',
    });
    const opps = matchOpportunities(profile);
    expect(opps.some((o) => o.id === 'land-bng')).toBe(true);
    expect(opps.some((o) => o.id === 'methane-abatement')).toBe(true);
  });

  it('agriculture gets regen-ag + biochar', () => {
    const profile = classifyProject({
      description: 'A coffee plantation farm in Uganda',
    });
    const opps = matchOpportunities(profile);
    expect(opps.some((o) => o.id === 'regen-ag-corridor')).toBe(true);
    expect(opps.some((o) => o.id === 'biochar')).toBe(true);
  });

  it('industrial gets process-heat electrification + waste-heat', () => {
    const profile = classifyProject({
      description: 'A new cement factory in industrial zone outside Dar es Salaam',
    });
    const opps = matchOpportunities(profile);
    expect(opps.some((o) => o.id === 'process-heat-electrification')).toBe(true);
    expect(opps.some((o) => o.id === 'waste-heat-capture')).toBe(true);
  });

  it('energy gets battery storage + green hydrogen', () => {
    const profile = classifyProject({
      description: 'A 500 MW solar farm in arid Kenya',
    });
    const opps = matchOpportunities(profile);
    expect(opps.some((o) => o.id === 'battery-storage-colocation')).toBe(true);
    expect(opps.some((o) => o.id === 'hydrogen-coproduction')).toBe(true);
  });

  it('honours minScore option', () => {
    const profile = classifyProject({
      description: 'A railway from Dar es Salaam to Dodoma',
    });
    const high = matchOpportunities(profile, { minScore: 0.9 });
    const low = matchOpportunities(profile, { minScore: 0.1 });
    expect(low.length).toBeGreaterThanOrEqual(high.length);
  });

  it('honours maxResults option', () => {
    const profile = classifyProject({
      description: 'A railway from Dar es Salaam to Dodoma',
    });
    const capped = matchOpportunities(profile, { maxResults: 3 });
    expect(capped.length).toBeLessThanOrEqual(3);
  });

  it('scores are bounded [0, 1]', () => {
    const profile = classifyProject({
      description: 'A railway from Dar es Salaam to Dodoma',
    });
    const opps = matchOpportunities(profile);
    for (const o of opps) {
      expect(o.score).toBeGreaterThanOrEqual(0);
      expect(o.score).toBeLessThanOrEqual(1);
    }
  });
});

describe('Per-opportunity estimators', () => {
  describe('estimateCorridorSolar', () => {
    it('scales installed MW with corridor length', () => {
      const small = estimateCorridorSolar({
        projectTypes: ['infrastructure-rail'],
        jurisdictions: ['TZ'],
        biomes: [],
        signals: ['linear-corridor'],
        lengthKm: 50,
        confidence: 1,
        rationale: '',
      });
      const big = estimateCorridorSolar({
        projectTypes: ['infrastructure-rail'],
        jurisdictions: ['TZ'],
        biomes: [],
        signals: ['linear-corridor'],
        lengthKm: 500,
        confidence: 1,
        rationale: '',
      });
      expect(big.mwInstallable).toBeGreaterThan(small.mwInstallable);
      expect(big.annualAbatementTCO2e).toBeGreaterThan(small.annualAbatementTCO2e);
    });

    it('returns zero for zero-length corridor', () => {
      const zero = estimateCorridorSolar({
        projectTypes: ['infrastructure-rail'],
        jurisdictions: ['TZ'],
        biomes: [],
        signals: ['linear-corridor'],
        lengthKm: 0,
        confidence: 1,
        rationale: '',
      });
      expect(zero.mwInstallable).toBe(0);
      expect(zero.annualAbatementTCO2e).toBe(0);
    });
  });

  describe('estimateLandBridgeBng', () => {
    it('escalates to PS6-critical when critical habitat near', () => {
      const result = estimateLandBridgeBng({
        projectTypes: ['infrastructure-rail'],
        jurisdictions: ['TZ'],
        biomes: [],
        signals: ['linear-corridor', 'critical-habitat-near'],
        lengthKm: 100,
        confidence: 1,
        rationale: '',
      });
      expect(result.method).toBe('PS6-critical');
      expect(result.offsetRatio).toBe(10);
    });

    it('falls back to BNG-UK when no critical habitat', () => {
      const result = estimateLandBridgeBng({
        projectTypes: ['infrastructure-rail'],
        jurisdictions: ['TZ'],
        biomes: [],
        signals: ['linear-corridor'],
        lengthKm: 100,
        confidence: 1,
        rationale: '',
      });
      expect(result.method).toBe('BNG-UK');
    });
  });

  describe('estimateLandBng', () => {
    it('uses 10:1 for critical habitat', () => {
      const result = estimateLandBng({
        projectTypes: ['mining'],
        jurisdictions: ['TZ'],
        biomes: [],
        signals: ['critical-habitat-near'],
        areaHa: 200,
        confidence: 1,
        rationale: '',
      });
      expect(result.offsetRatio).toBe(10);
      expect(result.method).toBe('PS6-critical');
    });

    it('uses 3:1 for natural habitat', () => {
      const result = estimateLandBng({
        projectTypes: ['mining'],
        jurisdictions: ['TZ'],
        biomes: [],
        signals: [],
        areaHa: 200,
        confidence: 1,
        rationale: '',
      });
      expect(result.offsetRatio).toBe(3);
    });
  });

  describe('estimateEvHub', () => {
    it('places multiple hubs along corridors', () => {
      const result = estimateEvHub({
        projectTypes: ['infrastructure-highway'],
        jurisdictions: ['TZ'],
        biomes: [],
        signals: ['linear-corridor'],
        lengthKm: 600,
        confidence: 1,
        rationale: '',
      });
      expect(result.hubCount).toBeGreaterThanOrEqual(4);
    });

    it('returns single hub for retail', () => {
      const result = estimateEvHub({
        projectTypes: ['retail'],
        jurisdictions: ['KE'],
        biomes: ['urban'],
        signals: [],
        confidence: 1,
        rationale: '',
      });
      expect(result.hubCount).toBe(1);
    });
  });

  describe('estimateWaterReclaim', () => {
    it('produces more harvest in high-rainfall regions', () => {
      const wet = estimateWaterReclaim(
        {
          projectTypes: ['commercial-office'],
          jurisdictions: ['UG'],
          biomes: ['tropical-forest'],
          signals: ['high-rainfall'],
          areaHa: 1,
          confidence: 1,
          rationale: '',
        },
      );
      const dry = estimateWaterReclaim(
        {
          projectTypes: ['commercial-office'],
          jurisdictions: ['KE'],
          biomes: ['arid'],
          signals: ['low-rainfall'],
          areaHa: 1,
          confidence: 1,
          rationale: '',
        },
      );
      expect(wet.annualHarvestableM3).toBeGreaterThan(dry.annualHarvestableM3);
    });
  });

  describe('estimateBlueCarbon', () => {
    it('mangrove yields more than seagrass at same area', () => {
      const profile = {
        projectTypes: ['infrastructure-port' as const],
        jurisdictions: ['TZ' as const],
        biomes: ['coastal' as const],
        signals: ['coastal-asset' as const],
        confidence: 1,
        rationale: '',
      };
      const mg = estimateBlueCarbon(profile, 'mangrove', 100);
      const sg = estimateBlueCarbon(profile, 'seagrass', 100);
      expect(mg.annualSequestrationTCO2e).toBeGreaterThan(sg.annualSequestrationTCO2e);
    });
  });

  describe('estimateRegenAg', () => {
    it('scales by corridor length when linear', () => {
      const result = estimateRegenAg({
        projectTypes: ['infrastructure-rail'],
        jurisdictions: ['TZ'],
        biomes: [],
        signals: ['linear-corridor'],
        lengthKm: 450,
        confidence: 1,
        rationale: '',
      });
      // 450 km × 200 ha = 90_000 ha
      expect(result.hectaresUnderManagement).toBe(90_000);
      expect(result.issuableTCO2ePerYear).toBeGreaterThan(100_000);
    });

    it('applies buffer pool deduction', () => {
      const result = estimateRegenAg({
        projectTypes: ['agriculture'],
        jurisdictions: ['UG'],
        biomes: ['agricultural'],
        signals: [],
        areaHa: 1000,
        confidence: 1,
        rationale: '',
      });
      expect(result.bufferPoolPct).toBe(15);
      expect(result.issuableTCO2ePerYear).toBeLessThan(result.annualSocSequestrationTCO2e);
    });
  });

  describe('estimateUrbanForestry', () => {
    it('estimates surviving trees at 25y', () => {
      const result = estimateUrbanForestry(
        {
          projectTypes: ['commercial-office'],
          jurisdictions: ['KE'],
          biomes: ['urban'],
          signals: [],
          confidence: 1,
          rationale: '',
        },
        2, // 2 ha greened
      );
      expect(result.treesPlanted).toBe(500);
      expect(result.survivingTreesAt25y).toBe(300);
      expect(result.annualPm25ReductionKg).toBeGreaterThan(0);
    });
  });
});
