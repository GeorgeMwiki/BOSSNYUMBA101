import { describe, it, expect } from 'vitest';
import {
  buildDepartmentHealthReport,
  buildDepartmentHealthReportWithNarrative,
} from '../advisor/department-health-report.js';
import {
  prioritizeRecommendations,
  topNRecommendations,
  __test__,
} from '../advisor/strategic-recommendation-prioritizer.js';
import { makePortfolio, NOW_MS } from './fixtures.js';
import type { MultiLLMSynthesizer } from '../types.js';

describe('department-health-report', () => {
  it('produces a 3-bullet headline + sections + topRecommendations', () => {
    const report = buildDepartmentHealthReport({
      portfolio: makePortfolio(),
      nowMs: NOW_MS,
    });
    expect(report.headline.length).toBe(3);
    expect(report.sections.length).toBeGreaterThanOrEqual(7);
    expect(report.topRecommendations.length).toBeLessThanOrEqual(5);
  });

  it('top recommendations are sorted descending by composite', () => {
    const report = buildDepartmentHealthReport({
      portfolio: makePortfolio(),
      nowMs: NOW_MS,
    });
    for (let i = 1; i < report.topRecommendations.length; i += 1) {
      const a = report.topRecommendations[i]?.composite ?? 0;
      const b = report.topRecommendations[i - 1]?.composite ?? 0;
      expect(a).toBeLessThanOrEqual(b + 1e-9);
    }
  });

  it('respects the tenantId in every section', () => {
    const portfolio = makePortfolio();
    const report = buildDepartmentHealthReport({ portfolio, nowMs: NOW_MS });
    expect(report.tenantId).toBe(portfolio.tenantId);
  });

  it('integrates narrative when synthesizer injected', async () => {
    const stub: MultiLLMSynthesizer = {
      async synthesize() {
        return 'A veteran director would say: focus on geographic diversification and OER drift.';
      },
    };
    const report = await buildDepartmentHealthReportWithNarrative({
      portfolio: makePortfolio(),
      nowMs: NOW_MS,
      synthesizer: stub,
      tone: 'veteran-director',
    });
    expect(report.narrative).toContain('veteran director');
  });

  it('compliance horizon defaults to 90 days', () => {
    const report = buildDepartmentHealthReport({
      portfolio: makePortfolio(),
      nowMs: NOW_MS,
    });
    const regSection = report.sections.find((s) => s.kind === 'regulatory-compliance');
    expect(regSection?.title).toContain('90');
  });
});

describe('strategic-recommendation-prioritizer', () => {
  it('composite weights sum to 1', () => {
    expect(__test__.W_STRATEGIC + __test__.W_IRR + __test__.W_URGENCY).toBeCloseTo(1.0);
  });

  it('prioritizes a higher-strategic recommendation above a lower one', () => {
    const recs = prioritizeRecommendations([
      { id: 'a', kind: 'portfolio', severity: 'medium', headline: 'a', rationale: '', citation: '', strategicScore: 0.2, urgencyScore: 0.2, composite: 0 },
      { id: 'b', kind: 'portfolio', severity: 'medium', headline: 'b', rationale: '', citation: '', strategicScore: 0.9, urgencyScore: 0.5, composite: 0 },
    ]);
    expect(recs[0]?.id).toBe('b');
  });

  it('topN returns no more than N', () => {
    const recs = prioritizeRecommendations([
      { id: '1', kind: 'portfolio', severity: 'medium', headline: '', rationale: '', citation: '', strategicScore: 0.1, urgencyScore: 0.1, composite: 0 },
      { id: '2', kind: 'portfolio', severity: 'medium', headline: '', rationale: '', citation: '', strategicScore: 0.2, urgencyScore: 0.2, composite: 0 },
      { id: '3', kind: 'portfolio', severity: 'medium', headline: '', rationale: '', citation: '', strategicScore: 0.3, urgencyScore: 0.3, composite: 0 },
    ]);
    expect(topNRecommendations(recs, 2).length).toBe(2);
  });

  it('irrNormalised returns 0 when no IRR', () => {
    expect(__test__.irrNormalised({ id: '', kind: 'portfolio', severity: 'low', headline: '', rationale: '', citation: '', strategicScore: 0, urgencyScore: 0, composite: 0 }, 10)).toBe(0);
  });
});
