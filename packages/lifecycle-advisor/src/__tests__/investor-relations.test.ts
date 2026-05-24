import { describe, expect, it } from 'vitest';
import { structureCapitalRaise } from '../investor-relations/capital-raise-structurer.js';
import { runSubscriptionDocChecklist } from '../investor-relations/subscription-doc-checklist.js';
import { adviseReportingCadence } from '../investor-relations/reporting-cadence-advisor.js';
import { forecastDistributions } from '../investor-relations/distribution-forecaster.js';
import { buildCapitalCallMessage } from '../investor-relations/capital-call-communicator.js';
import { buildILPAReport } from '../investor-relations/ilpa-report-builder.js';
import { draftLPAnswer, draftLPAnswers } from '../investor-relations/lp-qa-drafter.js';

describe('capital-raise-structurer', () => {
  it('recommends 506(b) for US private with ≤ 35 non-accredited', () => {
    const r = structureCapitalRaise({
      jurisdiction: 'US',
      wantsGeneralSolicitation: false,
      nonAccreditedCount: 10,
      accreditedOnly: false,
      fundingTarget: 50_000_000,
      hasRegulatedFundStructure: false,
    });
    expect(r.structure).toBe('506-b');
    expect(r.marketingAllowed).toBe('private-only');
  });

  it('recommends 506(c) when general solicitation requested', () => {
    const r = structureCapitalRaise({
      jurisdiction: 'US',
      wantsGeneralSolicitation: true,
      nonAccreditedCount: 0,
      accreditedOnly: true,
      fundingTarget: 50_000_000,
      hasRegulatedFundStructure: false,
    });
    expect(r.structure).toBe('506-c');
    expect(r.verificationRequired).toBe('reasonable-steps');
  });

  it('throws when 506(b) non-accredited > 35', () => {
    expect(() => structureCapitalRaise({
      jurisdiction: 'US',
      wantsGeneralSolicitation: false,
      nonAccreditedCount: 50,
      accreditedOnly: false,
      fundingTarget: 50_000_000,
      hasRegulatedFundStructure: false,
    })).toThrow();
  });

  it('KE AIF when regulated fund structure', () => {
    const r = structureCapitalRaise({
      jurisdiction: 'KE',
      wantsGeneralSolicitation: false,
      nonAccreditedCount: 0,
      accreditedOnly: false,
      fundingTarget: 50_000_000,
      hasRegulatedFundStructure: true,
    });
    expect(r.structure).toBe('ke-aif');
  });

  it('KE PP-20 default', () => {
    const r = structureCapitalRaise({
      jurisdiction: 'KE',
      wantsGeneralSolicitation: false,
      nonAccreditedCount: 5,
      accreditedOnly: false,
      fundingTarget: 5_000_000,
      hasRegulatedFundStructure: false,
    });
    expect(r.structure).toBe('ke-private-placement-20');
    expect(r.maxNonAccredited).toBe(20);
  });

  it('TZ PP-50 default', () => {
    const r = structureCapitalRaise({
      jurisdiction: 'TZ',
      wantsGeneralSolicitation: false,
      nonAccreditedCount: 5,
      accreditedOnly: false,
      fundingTarget: 5_000_000,
      hasRegulatedFundStructure: false,
    });
    expect(r.structure).toBe('tz-private-placement-50');
    expect(r.maxNonAccredited).toBe(50);
  });
});

describe('subscription-doc-checklist', () => {
  it('passes complete IG check', () => {
    const r = runSubscriptionDocChecklist({
      hasAccreditedQuestionnaire: true,
      hasSignedSubAgreement: true,
      hasW9OrW8: true,
      hasBadActorRep: true,
      hasAMLKYC: true,
      investmentSize: 5_000_000,
    });
    expect(r.complete).toBe(true);
    expect(r.amlRequired).toBe(true);
  });

  it('fails when missing accredited questionnaire', () => {
    const r = runSubscriptionDocChecklist({
      hasAccreditedQuestionnaire: false,
      hasSignedSubAgreement: true,
      hasW9OrW8: true,
      hasBadActorRep: true,
      hasAMLKYC: true,
      investmentSize: 500_000,
    });
    expect(r.complete).toBe(false);
    expect(r.missing.some((m) => m.includes('accredited'))).toBe(true);
  });

  it('does not require AML for sub-1M', () => {
    const r = runSubscriptionDocChecklist({
      hasAccreditedQuestionnaire: true,
      hasSignedSubAgreement: true,
      hasW9OrW8: true,
      hasBadActorRep: true,
      hasAMLKYC: false,
      investmentSize: 500_000,
    });
    expect(r.amlRequired).toBe(false);
    expect(r.complete).toBe(true);
  });
});

describe('reporting-cadence-advisor', () => {
  it('institutional gets quarterly + annual + ILPA-1.1', () => {
    const r = adviseReportingCadence({
      tier: 'institutional',
      fundSize: 500_000_000,
      investorCount: 25,
    });
    expect(r.writtenCadenceMonths).toBe(3);
    expect(r.recommendedTemplate).toBe('ILPA-1.1');
  });

  it('individual gets monthly + quarterly + ILPA-summary', () => {
    const r = adviseReportingCadence({
      tier: 'individual',
      fundSize: 25_000_000,
      investorCount: 50,
    });
    expect(r.writtenCadenceMonths).toBe(1);
    expect(r.recommendedTemplate).toBe('ILPA-summary');
  });

  it('family-office same as institutional', () => {
    const r = adviseReportingCadence({
      tier: 'family-office',
      fundSize: 100_000_000,
      investorCount: 5,
    });
    expect(r.writtenCadenceMonths).toBe(3);
    expect(r.callCadenceMonths).toBe(3);
  });
});

describe('distribution-forecaster', () => {
  it('returns LP IRR > 0 for typical project series', () => {
    const r = forecastDistributions({
      periodCashflows: [0, 0, 0, 0, 1_500_000, 1_500_000, 1_500_000, 1_500_000, 12_000_000],
      lpCommitment: 10_000_000,
      prefRate: 0.08,
      tiers: [
        { name: 'roc', type: 'return-of-capital' },
        { name: 'pref', type: 'pref' },
        { name: 'split', type: 'split', lpShare: 0.80, gpShare: 0.20 },
      ],
    });
    expect(r.perPeriod).toHaveLength(9);
    expect(r.lpMOIC).toBeGreaterThan(1);
    expect(r.lpIRR).toBeGreaterThan(0);
  });

  it('throws when lp commitment ≤ 0', () => {
    expect(() => forecastDistributions({
      periodCashflows: [100, 100],
      lpCommitment: 0,
      prefRate: 0.08,
      tiers: [{ name: 'roc', type: 'return-of-capital' }],
    })).toThrow();
  });

  it('handles single-period cashflow', () => {
    const r = forecastDistributions({
      periodCashflows: [12_000_000],
      lpCommitment: 10_000_000,
      prefRate: 0.08,
      tiers: [
        { name: 'roc', type: 'return-of-capital' },
        { name: 'pref', type: 'pref' },
        { name: 'split', type: 'split', lpShare: 0.80, gpShare: 0.20 },
      ],
    });
    expect(r.perPeriod).toHaveLength(1);
    expect(r.cumulativeLP > 0 || r.perPeriod[0]!.lpDist > 0).toBe(true);
  });
});

describe('capital-call-communicator', () => {
  it('compliant standard call', () => {
    const r = buildCapitalCallMessage({
      type: 'standard',
      callAmount: 500_000,
      cumulativeCalled: 2_000_000,
      totalCommitment: 5_000_000,
      daysNotice: 12,
      useOfProceeds: 'Acquisition closing of Asset X',
    });
    expect(r.compliant).toBe(true);
    expect(r.subject).toContain('Capital Call');
    expect(r.body).toContain('capital call');
  });

  it('violates when notice < 10 bd', () => {
    const r = buildCapitalCallMessage({
      type: 'standard',
      callAmount: 500_000,
      cumulativeCalled: 1_000_000,
      totalCommitment: 5_000_000,
      daysNotice: 5,
      useOfProceeds: 'X',
    });
    expect(r.compliant).toBe(false);
    expect(r.violations.some((v) => v.includes('notice'))).toBe(true);
  });

  it('violates when call > commitment', () => {
    const r = buildCapitalCallMessage({
      type: 'standard',
      callAmount: 10_000_000,
      cumulativeCalled: 4_000_000,
      totalCommitment: 5_000_000,
      daysNotice: 15,
      useOfProceeds: 'X',
    });
    expect(r.compliant).toBe(false);
  });

  it('violates with empty useOfProceeds', () => {
    const r = buildCapitalCallMessage({
      type: 'standard',
      callAmount: 100_000,
      cumulativeCalled: 0,
      totalCommitment: 5_000_000,
      daysNotice: 15,
      useOfProceeds: '',
    });
    expect(r.compliant).toBe(false);
  });
});

describe('ILPA report builder', () => {
  it('returns 6 sections', () => {
    const r = buildILPAReport({
      periodLabel: 'Q1-2026',
      fundNAV: 100_000_000,
      fundCalled: 80_000_000,
      fundDistributed: 30_000_000,
      fundUnfunded: 20_000_000,
      netIRR: 0.14,
      grossIRR: 0.17,
      netMOIC: 1.8,
      grossMOIC: 2.0,
      dpi: 0.40,
      rvpi: 1.40,
      tvpi: 1.80,
      topInvestments: [{ id: 'A', name: 'Property A', cost: 20_000_000, fairValue: 28_000_000, unrealizedMOIC: 1.4 }],
      materialEvents: ['Refi closed on Asset B'],
      outlook: 'Cap-rate stability across submarket favouring extension of hold.',
    });
    expect(r.sections).toHaveLength(6);
    expect(r.compliantWithTemplate).toBe('ILPA-1.1');
  });

  it('flags missing investments', () => {
    const r = buildILPAReport({
      periodLabel: 'Q1-2026',
      fundNAV: 100_000_000,
      fundCalled: 80_000_000,
      fundDistributed: 30_000_000,
      fundUnfunded: 20_000_000,
      netIRR: 0.14,
      grossIRR: 0.17,
      netMOIC: 1.8,
      grossMOIC: 2.0,
      dpi: 0.40,
      rvpi: 1.40,
      tvpi: 1.80,
      topInvestments: [],
      materialEvents: [],
      outlook: '',
    });
    expect(r.missingDataFlags).toContain('topInvestments (at least 1 required)');
  });
});

describe('LP Q&A drafter', () => {
  const fundContext = {
    coInvestPct: 0.05,
    priorFundNetIRR: 0.18,
    priorFundMOIC: 2.1,
    worstDealIRR: -0.05,
    worstDealDescription: 'Retail conversion in tertiary market underperformed due to oversupply',
    sourcingChannels: ['off-market broker', 'principal network', 'PE referral'],
    feeWaiverPct: 0.50,
    waterfallSummary: '8% pref → 50% catch-up to 20% promote → 80/20',
    esgPolicy: 'GRESB-aligned, SFDR Article 8',
    cyberPolicy: 'SOC 2 Type II annual + pen test',
    auditor: 'EY',
    counsel: 'Goodwin Procter',
  };

  it('answers co-invest question', () => {
    const a = draftLPAnswer({ question: 'What is your co-investment?', fundContext });
    expect(a.category).toBe('sponsor');
    expect(a.answer).toContain('5');
  });

  it('answers track-record question', () => {
    const a = draftLPAnswer({ question: 'What was your prior fund net IRR?', fundContext });
    expect(a.category).toBe('track-record');
    expect(a.answer).toContain('18');
  });

  it('answers worst-deal question', () => {
    const a = draftLPAnswer({ question: 'Walk me through the worst deal', fundContext });
    expect(a.category).toBe('risk');
    expect(a.answer).toContain('tertiary market');
  });

  it('returns low-confidence on unknown question', () => {
    const a = draftLPAnswer({ question: 'What is the meaning of life?', fundContext });
    expect(a.confidence).toBeLessThan(0.5);
  });

  it('answers batch', () => {
    const out = draftLPAnswers([
      { question: 'fees?', fundContext },
      { question: 'cyber?', fundContext },
      { question: 'recession?', fundContext },
    ]);
    expect(out).toHaveLength(3);
  });
});
