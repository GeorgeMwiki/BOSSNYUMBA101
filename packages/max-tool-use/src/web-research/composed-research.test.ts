import { describe, expect, it } from 'vitest';
import { createWebResearcher } from './composed-research.js';
import type { TenantContext } from '../types.js';

const ctx: TenantContext = {
  tenantId: 'tnt-acme',
  principalId: 'usr-1',
  correlationId: 'corr-research',
};

describe('createWebResearcher — composedResearch', () => {
  it('runs search + fetch + code-exec composition with default deps', async () => {
    const r = await createWebResearcher().composedResearch({
      question: "What's the current KRA WHT rate?",
      tenantContext: ctx,
    });
    expect(r.codeExecutionPaired).toBe(true);
    expect(r.urlsConsulted.length).toBeGreaterThan(0);
    expect(r.extractedFacts.length).toBeGreaterThan(0);
  });

  it('reports cost ≤ $0.02 per question (search-only billable)', async () => {
    const r = await createWebResearcher().composedResearch({
      question: 'whatever',
      tenantContext: ctx,
    });
    expect(r.estimatedCostUsd).toBeLessThanOrEqual(0.02);
  });

  it('respects maxUrls and caps URL list', async () => {
    const r = await createWebResearcher().composedResearch({
      question: 'find sources',
      maxUrls: 1,
      tenantContext: ctx,
    });
    expect(r.urlsConsulted).toHaveLength(1);
  });

  it('rejects empty questions', async () => {
    await expect(
      createWebResearcher().composedResearch({
        question: '   ',
        tenantContext: ctx,
      }),
    ).rejects.toThrow(/question is required/i);
  });

  it('uses injected sources verbatim', async () => {
    const sources = ['https://example.com/policy.pdf'];
    let fetchedUrls: string[] = [];
    const r = await createWebResearcher({
      webFetch: async (url) => {
        fetchedUrls = [...fetchedUrls, url];
        return { markdown: `# ${url}\nbody`, bytes: 100 };
      },
    }).composedResearch({
      question: 'q',
      sources,
      tenantContext: ctx,
    });
    expect(fetchedUrls).toEqual(sources);
    expect(r.urlsConsulted.map((u) => u.url)).toEqual(sources);
  });
});

describe('createWebResearcher — 5 deterministic research questions', () => {
  const QUESTIONS: ReadonlyArray<string> = [
    'What is the KRA withholding tax rate for rental income?',
    'What is the TRA TOT rate in Tanzania for 2026?',
    'What is the Pesapal API base URL for production?',
    'What is the M-Pesa Daraja STK push endpoint?',
    'What is the NLS plumbing license renewal cadence?',
  ];

  for (const q of QUESTIONS) {
    it(`answers: ${q}`, async () => {
      const r = await createWebResearcher().composedResearch({
        question: q,
        tenantContext: ctx,
        maxUrls: 3,
      });
      expect(r.answer).toBeTruthy();
      expect(r.urlsConsulted.length).toBeGreaterThan(0);
      expect(r.estimatedCostUsd).toBeLessThanOrEqual(0.02);
    });
  }
});
