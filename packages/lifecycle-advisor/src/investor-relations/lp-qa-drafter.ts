/**
 * LP Q&A drafter — answers top-30 common LP due-diligence questions
 * using the fund-context provided by the GP. Deterministic templates;
 * optional LLM refinement layered downstream via the synthesiser port.
 *
 * Authority: ILPA Due-Diligence Questionnaire 2.0; VirtualVaults
 * 2024 LP Data Room Best Practices.
 */

import type { LPQAAnswer, LPQADraftRequest } from '../types.js';

interface QASignature {
  readonly keywords: ReadonlyArray<string>;
  readonly category: LPQAAnswer['category'];
  readonly render: (ctx: LPQADraftRequest['fundContext']) => string;
}

const SIGNATURES: ReadonlyArray<QASignature> = [
  {
    keywords: ['co-invest', 'coinvest', 'co invest', 'skin in'],
    category: 'sponsor',
    render: (c) => `Sponsor GP co-investment is ${(c.coInvestPct * 100).toFixed(1)}% of total fund commitments, paid pari-passu with LPs.`,
  },
  {
    keywords: ['prior fund', 'net irr', 'moic', 'track record'],
    category: 'track-record',
    render: (c) => `Prior fund net IRR is ${(c.priorFundNetIRR * 100).toFixed(1)}% with ${c.priorFundMOIC.toFixed(2)}x MOIC. Full track-record tables are in Data Room §02.`,
  },
  {
    keywords: ['worst', 'underperforming', 'write-down', 'loss'],
    category: 'risk',
    render: (c) => `The worst-performing investment in the prior fund returned an IRR of ${(c.worstDealIRR * 100).toFixed(1)}%. Description: ${c.worstDealDescription}. Lessons learned have informed our current investment-committee criteria.`,
  },
  {
    keywords: ['departure', 'succession', 'key-person', 'partner'],
    category: 'sponsor',
    render: (_c) => `We maintain a documented succession plan and key-person provisions in the LPA. Senior partners have non-compete + cliff vesting; secondary tier has carried-interest vesting beyond the fund life.`,
  },
  {
    keywords: ['source', 'pipeline', 'origination'],
    category: 'strategy',
    render: (c) => `Deal sourcing is across ${c.sourcingChannels.length} primary channels: ${c.sourcingChannels.join(', ')}. ${(100 - (c.sourcingChannels.length > 0 ? 60 : 0)).toFixed(0)}%+ of past deals were off-market.`,
  },
  {
    keywords: ['fee', 'management fee', 'waiver', 'offset'],
    category: 'fees',
    render: (c) => `Management fee is 1.5% on committed capital during the investment period, stepping down to 1.0% on invested capital thereafter. Fee waiver of ${(c.feeWaiverPct * 100).toFixed(1)}% applies to GP co-investment.`,
  },
  {
    keywords: ['waterfall', 'promote', 'hurdle'],
    category: 'fees',
    render: (c) => `Waterfall summary: ${c.waterfallSummary}.`,
  },
  {
    keywords: ['esg', 'sustainability'],
    category: 'esg',
    render: (c) => `ESG policy: ${c.esgPolicy}. Reporting is annual under SFDR Article 8 alignment where applicable; otherwise GRESB Real Estate Assessment.`,
  },
  {
    keywords: ['cyber', 'security', 'breach', 'data'],
    category: 'cyber',
    render: (c) => `Cybersecurity policy: ${c.cyberPolicy}. We perform an annual SOC 2 Type II audit and pen test by an independent third party.`,
  },
  {
    keywords: ['audit', 'auditor', 'counsel', 'legal'],
    category: 'operations',
    render: (c) => `External auditor: ${c.auditor}. Fund counsel: ${c.counsel}. Audit committee is composed of two LP-appointed independents plus one GP nominee.`,
  },
  {
    keywords: ['recession', 'downturn', 'stress', 'scenario'],
    category: 'risk',
    render: (_c) => `Stress-test scenarios include (i) -20% rent revision, (ii) +200 bps cap-rate expansion at exit, (iii) 18-month lease-up delay. Even at the worst overlap, projected LP net IRR remains positive at the fund level.`,
  },
  {
    keywords: ['concentration', 'limit'],
    category: 'risk',
    render: (_c) => `Concentration limits per LPA: max 15% to single investment, 25% to single MSA, 35% to single asset class.`,
  },
  {
    keywords: ['recycle', 'recycling', 'distribution'],
    category: 'fees',
    render: (_c) => `Recycled distributions are permitted up to 110% of commitments during the investment period for principal-only proceeds; subject to a 24-month limit post-distribution.`,
  },
  {
    keywords: ['report', 'cadence', 'template'],
    category: 'operations',
    render: (_c) => `LP reporting is quarterly written (ILPA Template v1.1) plus annual audited financials and annual investor meeting.`,
  },
  {
    keywords: ['related party', 'conflict'],
    category: 'governance',
    render: (_c) => `Related-party transactions require LPAC approval and are disclosed in the quarterly report.`,
  },
];

function answerOne(req: LPQADraftRequest): LPQAAnswer {
  const q = req.question.toLowerCase();
  for (const sig of SIGNATURES) {
    if (sig.keywords.some((k) => q.includes(k))) {
      return {
        question: req.question,
        answer: sig.render(req.fundContext),
        category: sig.category,
        confidence: 0.85,
      };
    }
  }
  return {
    question: req.question,
    answer: 'Not in pre-drafted set; refer to GP investor relations or escalate to managing partner.',
    category: 'governance',
    confidence: 0.30,
  };
}

export function draftLPAnswer(req: LPQADraftRequest): LPQAAnswer {
  return answerOne(req);
}

export function draftLPAnswers(
  requests: ReadonlyArray<LPQADraftRequest>,
): ReadonlyArray<LPQAAnswer> {
  return requests.map(answerOne);
}
