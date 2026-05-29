import { describe, expect, it } from 'vitest';
import { summariseDoc } from '../summarizer.js';
import type { ParsedDoc } from '../types.js';

function fakeParsed(text = 'Lease for unit A-1, monthly rent TZS 500,000.'): ParsedDoc {
  return Object.freeze({
    text,
    warnings: Object.freeze([]),
    detectedLanguage: 'en' as const,
    extractedFacts: Object.freeze([
      { kind: 'realestate.doc_kind', value: 'lease_agreement', confidence: 0.8 },
    ]),
  });
}

describe('summariseDoc - deterministic fallback', () => {
  it('returns bilingual fallback when no llmCall is passed', async () => {
    const out = await summariseDoc({ tenantId: 't', filename: 'lease.pdf', sourceKind: 'pdf', parsed: fakeParsed() });
    expect(out.summaryEn).toContain('lease.pdf');
    expect(out.summarySw).toContain('lease.pdf');
    expect(out.summaryMd).toContain('EN');
    expect(out.summaryMd).toContain('SW');
  });
  it('falls back when the llm returns non-json', async () => {
    const out = await summariseDoc({
      tenantId: 't', filename: 'x.txt', sourceKind: 'text', parsed: fakeParsed(),
      llmCall: async () => ({ text: 'no json here, sorry' }),
    });
    expect(out.summaryEn).toContain('x.txt');
  });
  it('falls back when the llm throws', async () => {
    const out = await summariseDoc({
      tenantId: 't', filename: 'x.txt', sourceKind: 'text', parsed: fakeParsed(),
      llmCall: async () => { throw new Error('boom'); },
    });
    expect(out.summaryEn).toContain('x.txt');
  });
});

describe('summariseDoc - LLM path', () => {
  it('returns the llm-emitted bilingual summary when JSON valid', async () => {
    const out = await summariseDoc({
      tenantId: 't', filename: 'lease.pdf', sourceKind: 'pdf', parsed: fakeParsed(),
      llmCall: async () => ({
        text: JSON.stringify({
          summary_md: 'EN summary. SW muhtasari.',
          summary_en: 'EN summary',
          summary_sw: 'SW muhtasari',
          key_facts: [
            { kind: 'amount', value: 'TZS 500,000', confidence: 0.9 },
            { kind: 'date', value: '2026-05-29', confidence: 0.95 },
            { kind: 'tenant_name', value: 'Asha M.', confidence: 0.7 },
          ],
        }),
      }),
    });
    expect(out.summaryEn).toBe('EN summary');
    expect(out.summarySw).toBe('SW muhtasari');
    expect(out.keyFacts).toHaveLength(3);
  });
  it('tolerates a JSON inside a markdown fence', async () => {
    const out = await summariseDoc({
      tenantId: 't', filename: 'l.pdf', sourceKind: 'pdf', parsed: fakeParsed(),
      llmCall: async () => ({
        text: '```json\n{"summary_md":"x","summary_en":"e","summary_sw":"s","key_facts":[{"kind":"a","value":"b"},{"kind":"c","value":"d"},{"kind":"e","value":"f"}]}\n```',
      }),
    });
    expect(out.summaryEn).toBe('e');
    expect(out.summarySw).toBe('s');
    expect(out.keyFacts).toHaveLength(3);
  });
  it('clamps key_facts to 7 maximum', async () => {
    const out = await summariseDoc({
      tenantId: 't', filename: 'l.pdf', sourceKind: 'pdf', parsed: fakeParsed(),
      llmCall: async () => ({
        text: JSON.stringify({
          summary_en: 'e', summary_sw: 's', summary_md: 'm',
          key_facts: Array.from({ length: 20 }, (_, i) => ({
            kind: 'k', value: String(i), confidence: 0.5,
          })),
        }),
      }),
    });
    expect(out.keyFacts).toHaveLength(7);
  });
  it('falls back when llm returns empty en/sw fields', async () => {
    const out = await summariseDoc({
      tenantId: 't', filename: 'l.pdf', sourceKind: 'pdf', parsed: fakeParsed(),
      llmCall: async () => ({
        text: JSON.stringify({ summary_en: '', summary_sw: '', summary_md: 'x', key_facts: [] }),
      }),
    });
    expect(out.summaryEn).toContain('BossNyumba');
  });
  it('truncates over-large doc text in the user prompt', async () => {
    const long = 'lease '.repeat(5000);
    const seen: string[] = [];
    await summariseDoc({
      tenantId: 't', filename: 'big.txt', sourceKind: 'text', parsed: fakeParsed(long),
      llmCall: async ({ userPrompt }) => { seen.push(userPrompt); return { text: 'invalid' }; },
    });
    expect(seen[0]).toContain('middle truncated');
  });
});
