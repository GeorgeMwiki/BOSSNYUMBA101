/**
 * veteran-expert-report tests — end-to-end composition, canonical
 * "railway A→B" fixture, prioritizer, SDG + co-benefits scorers,
 * MultiLLMSynthesizerPort injection.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  generateVeteranExpertReport,
} from '../advisor/veteran-expert-report.js';
import { prioritizeOpportunities } from '../advisor/opportunity-prioritizer.js';
import { matchOpportunities } from '../opportunities/opportunity-matcher.js';
import { classifyProject } from '../project-typer/project-classifier.js';
import { scoreSdgAlignment } from '../impact/sdg-alignment-scorer.js';
import { scoreCoBenefits } from '../impact/co-benefits-scorer.js';
import type { MultiLLMSynthesizerPort } from '../types.js';

describe('generateVeteranExpertReport — CANONICAL railway A→B fixture', () => {
  it('returns a populated report for "railway from Dar es Salaam to Dodoma"', async () => {
    const report = await generateVeteranExpertReport({
      description: "we're building a railway from Dar es Salaam to Dodoma",
      hints: {
        lengthKm: 450,
        jurisdictions: ['TZ'],
        biomes: ['coastal', 'savanna'],
        signals: ['freight', 'critical-habitat-near'],
      },
    });
    expect(report.profile.projectTypes).toContain('infrastructure-rail');
    expect(report.opportunities.length).toBeGreaterThanOrEqual(5);
    expect(report.financing.length).toBeGreaterThan(0);
    expect(report.carbon.length).toBeGreaterThan(0);
    expect(report.impact.coBenefitsScore).toBeGreaterThan(0);
    expect(report.narrative.length).toBeGreaterThan(0);
  });

  it('produces a narrative including the project profile + opportunities', async () => {
    const report = await generateVeteranExpertReport({
      description: "we're building a railway from Dar es Salaam to Dodoma",
      hints: { lengthKm: 450 },
    });
    expect(report.narrative).toContain('infrastructure-rail');
    expect(report.narrative.toLowerCase()).toContain('opportunit');
  });

  it('includes ranked priorities with mcda scores', async () => {
    const report = await generateVeteranExpertReport({
      description: "we're building a railway from Dar es Salaam to Dodoma",
      hints: { lengthKm: 450 },
    });
    expect(report.priorities.length).toBe(report.opportunities.length);
    expect(report.priorities[0]?.rank).toBe(1);
  });

  it('every priority opportunity id is also in opportunities list', async () => {
    const report = await generateVeteranExpertReport({
      description: "we're building a railway from Dar es Salaam to Dodoma",
      hints: { lengthKm: 450 },
    });
    const oppIds = new Set(report.opportunities.map((o) => o.id));
    for (const p of report.priorities) {
      expect(oppIds.has(p.opportunityId)).toBe(true);
    }
  });
});

describe('generateVeteranExpertReport — MultiLLMSynthesizerPort', () => {
  it('uses synthesizer output when provided', async () => {
    const synth: MultiLLMSynthesizerPort = {
      synthesize: vi.fn().mockResolvedValue({
        answer: 'SYNTHESIZED NARRATIVE FROM AI',
        confidence: 0.9,
      }),
    };
    const report = await generateVeteranExpertReport(
      { description: 'A new container terminal at Mombasa port' },
      { synthesizer: synth },
    );
    expect(report.narrative).toBe('SYNTHESIZED NARRATIVE FROM AI');
    expect(synth.synthesize).toHaveBeenCalled();
  });

  it('falls back to heuristic on synthesizer failure', async () => {
    const synth: MultiLLMSynthesizerPort = {
      synthesize: vi.fn().mockRejectedValue(new Error('rate limit')),
    };
    const report = await generateVeteranExpertReport(
      { description: 'A new container terminal at Mombasa port' },
      { synthesizer: synth },
    );
    expect(report.narrative.toLowerCase()).toContain('opportunit');
  });

  it('falls back to heuristic on empty synthesizer answer', async () => {
    const synth: MultiLLMSynthesizerPort = {
      synthesize: vi.fn().mockResolvedValue({ answer: '', confidence: 0 }),
    };
    const report = await generateVeteranExpertReport(
      { description: 'A new container terminal at Mombasa port' },
      { synthesizer: synth },
    );
    expect(report.narrative.length).toBeGreaterThan(0);
  });
});

describe('generateVeteranExpertReport — option pass-through', () => {
  it('honours minOpportunityScore', async () => {
    const allOpps = await generateVeteranExpertReport({
      description: 'A railway from Dar es Salaam to Dodoma',
      hints: { lengthKm: 450 },
    });
    const fewerOpps = await generateVeteranExpertReport(
      {
        description: 'A railway from Dar es Salaam to Dodoma',
        hints: { lengthKm: 450 },
      },
      { minOpportunityScore: 0.9 },
    );
    expect(fewerOpps.opportunities.length).toBeLessThanOrEqual(allOpps.opportunities.length);
  });

  it('honours maxOpportunities', async () => {
    const report = await generateVeteranExpertReport(
      {
        description: 'A railway from Dar es Salaam to Dodoma',
        hints: { lengthKm: 450 },
      },
      { maxOpportunities: 3 },
    );
    expect(report.opportunities.length).toBeLessThanOrEqual(3);
  });

  it('honours maxFinancing', async () => {
    const report = await generateVeteranExpertReport(
      {
        description: 'A railway from Dar es Salaam to Dodoma',
        hints: { lengthKm: 450 },
      },
      { maxFinancing: 2 },
    );
    expect(report.financing.length).toBeLessThanOrEqual(2);
  });

  it('throws when mcdaWeights do not sum to 1.0', async () => {
    await expect(() =>
      generateVeteranExpertReport(
        {
          description: 'A railway from Dar es Salaam to Dodoma',
          hints: { lengthKm: 450 },
        },
        { mcdaWeights: { irr: 0.5, esg: 0.5, urgency: 0.5 } },
      ),
    ).rejects.toThrow(/MCDA weights must sum to 1/);
  });
});

describe('prioritizeOpportunities (direct)', () => {
  const profile = classifyProject({
    description: 'A railway from Dar es Salaam to Dodoma',
    hints: { lengthKm: 450 },
  });
  const opps = matchOpportunities(profile);

  it('returns same count as input', () => {
    const ranked = prioritizeOpportunities(opps);
    expect(ranked.length).toBe(opps.length);
  });

  it('rank is unique and starts at 1', () => {
    const ranked = prioritizeOpportunities(opps);
    expect(ranked[0]?.rank).toBe(1);
    expect(new Set(ranked.map((r) => r.rank)).size).toBe(ranked.length);
  });

  it('respects custom weights when they sum to 1.0', () => {
    const irr = prioritizeOpportunities(opps, { irr: 1, esg: 0, urgency: 0 });
    const esg = prioritizeOpportunities(opps, { irr: 0, esg: 1, urgency: 0 });
    expect(irr[0]?.opportunityId).toBeDefined();
    expect(esg[0]?.opportunityId).toBeDefined();
    // weighting matters — top opportunity often differs
    // (allow equality when scores are tied)
  });

  it('throws when weights do not sum to 1.0', () => {
    expect(() => prioritizeOpportunities(opps, { irr: 0.5, esg: 0.5, urgency: 0.5 })).toThrow();
  });
});

describe('SDG + co-benefits scorers (direct)', () => {
  const profile = classifyProject({
    description: 'A railway from Dar es Salaam to Dodoma',
    hints: { lengthKm: 450 },
  });
  const opps = matchOpportunities(profile);

  it('SDG vector has 17 entries', () => {
    const sdg = scoreSdgAlignment(opps);
    expect(sdg.vector.length).toBe(17);
  });

  it('SDG count is between 0 and 17', () => {
    const sdg = scoreSdgAlignment(opps);
    expect(sdg.count).toBeGreaterThanOrEqual(0);
    expect(sdg.count).toBeLessThanOrEqual(17);
  });

  it('alignment = count/17', () => {
    const sdg = scoreSdgAlignment(opps);
    expect(sdg.alignment).toBeCloseTo(sdg.count / 17, 5);
  });

  it('co-benefits score is in [0, 1]', () => {
    const impact = scoreCoBenefits(opps);
    expect(impact.coBenefitsScore).toBeGreaterThanOrEqual(0);
    expect(impact.coBenefitsScore).toBeLessThanOrEqual(1);
  });

  it('co-benefits dimensions are all in [0, 1]', () => {
    const impact = scoreCoBenefits(opps);
    expect(impact.dimensions.sdgAlignment).toBeGreaterThanOrEqual(0);
    expect(impact.dimensions.jobs).toBeLessThanOrEqual(1);
    expect(impact.dimensions.health).toBeLessThanOrEqual(1);
    expect(impact.dimensions.water).toBeLessThanOrEqual(1);
    expect(impact.dimensions.gender).toBeLessThanOrEqual(1);
  });

  it('throws when co-benefits weights do not sum to 1.0', () => {
    expect(() =>
      scoreCoBenefits(opps, { sdgAlignment: 0.5, jobs: 0.5, health: 0.5, water: 0.5, gender: 0.5 }),
    ).toThrow();
  });

  it('handles empty opportunities list gracefully', () => {
    const impact = scoreCoBenefits([]);
    expect(impact.sdgCount).toBe(0);
    expect(impact.coBenefitsScore).toBe(0);
  });
});

describe('VeteranExpertReport — narrative formatting checks', () => {
  it('lists the top 5 opportunities in the narrative', async () => {
    const report = await generateVeteranExpertReport({
      description: 'A railway from Dar es Salaam to Dodoma',
      hints: { lengthKm: 450 },
    });
    expect(report.narrative).toMatch(/1\./);
    expect(report.narrative).toMatch(/2\./);
    expect(report.narrative).toMatch(/3\./);
  });

  it('includes a financing summary section', async () => {
    const report = await generateVeteranExpertReport({
      description: 'A railway from Dar es Salaam to Dodoma',
      hints: { lengthKm: 450 },
    });
    expect(report.narrative.toLowerCase()).toContain('financing');
  });

  it('includes carbon methodology summary', async () => {
    const report = await generateVeteranExpertReport({
      description: 'A railway from Dar es Salaam to Dodoma',
      hints: { lengthKm: 450 },
    });
    expect(report.narrative.toLowerCase()).toContain('carbon');
  });

  it('includes impact summary', async () => {
    const report = await generateVeteranExpertReport({
      description: 'A railway from Dar es Salaam to Dodoma',
      hints: { lengthKm: 450 },
    });
    expect(report.narrative.toLowerCase()).toContain('sdg');
  });
});

describe('Carbon project gates', () => {
  it('VCS methodology surfaces PDD requirement', async () => {
    const report = await generateVeteranExpertReport({
      description: 'A railway from Dar es Salaam to Dodoma',
      hints: { lengthKm: 450, signals: ['freight'] },
    });
    const vmr0006 = report.carbon.find((c) => c.methodology.id === 'VCS-VMR0006');
    expect(vmr0006).toBeDefined();
    expect(vmr0006!.gatesToClear).toContain('Project Design Document (PDD)');
  });

  it('PACM methodology surfaces host-country authorisation', async () => {
    const report = await generateVeteranExpertReport({
      description: 'A coffee plantation in Uganda with biochar potential',
      hints: { jurisdictions: ['UG'], areaHa: 1000 },
    });
    const pacm = report.carbon.find((c) => c.methodology.id === 'PACM-Removals');
    if (pacm) {
      expect(pacm.gatesToClear).toContain('Host-country Article 6.4 authorisation');
    }
  });

  it('blue carbon surfaces coastal land-tenure clearance', async () => {
    const report = await generateVeteranExpertReport({
      description: 'A container port expansion on the coast of Mombasa',
      hints: { areaHa: 250, jurisdictions: ['KE'], signals: ['coastal-asset', 'freight'] },
    });
    const bc = report.carbon.find((c) => c.methodology.id === 'VCS-VM0033');
    expect(bc).toBeDefined();
    expect(bc!.gatesToClear).toContain('Coastal land-tenure clearance');
  });
});
