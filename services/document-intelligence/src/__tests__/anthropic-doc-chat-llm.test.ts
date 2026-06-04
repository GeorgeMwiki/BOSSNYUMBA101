/**
 * Tests for the Anthropic-backed DocChat LLM adapter (KI-009).
 *
 * Focus: the PURE exported helpers (`parseCitationTags`, `stripCitationTags`,
 * `mapRefsToCitations`) plus the composition-seam selector `selectDocChatLlm`.
 * No network is touched: `selectDocChatLlm` is exercised with no sdk (stub
 * fallback) and with a trivially-shaped fake sdk (real adapter, never called).
 */

import { describe, it, expect } from 'vitest';

import {
  parseCitationTags,
  stripCitationTags,
  mapRefsToCitations,
  selectDocChatLlm,
  AnthropicDocChatLlm,
  type DocChatLlmSdkLike,
  type ParsedCitationRef,
} from '../services/anthropic-doc-chat-llm.js';
import { StubAnthropicDocChatLlm } from '../services/document-chat.service.js';
import type { RetrievedChunk } from '../services/document-chat.service.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    id: 'chunk-id-0',
    documentId: 'doc-A',
    chunkIndex: 0,
    text: 'The monthly rent is 850,000 payable on the first of each month.',
    score: 0.91,
    ...overrides,
  };
}

/** Minimal fake SDK — satisfies the structural shape; never invoked here. */
const fakeSdk: DocChatLlmSdkLike = {
  messages: {
    create: async () => ({
      content: [{ type: 'text', text: '' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 0, output_tokens: 0 },
    }),
  },
};

// ---------------------------------------------------------------------------
// parseCitationTags
// ---------------------------------------------------------------------------

describe('parseCitationTags', () => {
  it('extracts chunk index and quote from a self-closing citation tag', () => {
    const raw =
      'Rent is 850,000. <citation chunk="0" quote="monthly rent is 850,000" />';
    const refs = parseCitationTags(raw);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({ chunk: 0, quote: 'monthly rent is 850,000' });
  });

  it('extracts multiple refs and tolerates attribute order', () => {
    const raw =
      'A <citation chunk="0" quote="alpha" /> and ' +
      'B <citation quote="beta" chunk="2" />.';
    const refs = parseCitationTags(raw);

    expect(refs).toEqual<ParsedCitationRef[]>([
      { chunk: 0, quote: 'alpha' },
      { chunk: 2, quote: 'beta' },
    ]);
  });

  it('skips tags without a parseable chunk attribute and returns [] for empty input', () => {
    expect(parseCitationTags('')).toEqual([]);
    expect(
      parseCitationTags('text <citation quote="no chunk here" /> more')
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// stripCitationTags
// ---------------------------------------------------------------------------

describe('stripCitationTags', () => {
  it('removes all citation markup from the visible answer', () => {
    const raw =
      'The rent is 850,000 <citation chunk="0" quote="850,000" /> per month.';
    const visible = stripCitationTags(raw);

    expect(visible).not.toContain('<citation');
    expect(visible).toBe('The rent is 850,000 per month.');
  });
});

// ---------------------------------------------------------------------------
// mapRefsToCitations — the hallucination guard (security-relevant)
// ---------------------------------------------------------------------------

describe('mapRefsToCitations', () => {
  it('maps a valid ref onto its retrieved chunk', () => {
    const context = [chunk()];
    const citations = mapRefsToCitations(
      [{ chunk: 0, quote: 'monthly rent is 850,000' }],
      context
    );

    expect(citations).toHaveLength(1);
    expect(citations[0]).toMatchObject({
      documentId: 'doc-A',
      chunkIndex: 0,
      quote: 'monthly rent is 850,000',
      score: 0.91,
    });
  });

  it('DROPS refs whose chunk index was not retrieved (hallucination guard)', () => {
    const context = [chunk({ chunkIndex: 0 })]; // only index 0 exists
    const refs: ParsedCitationRef[] = [
      { chunk: 0, quote: 'real' },
      { chunk: 5, quote: 'hallucinated out-of-range index' },
    ];

    const citations = mapRefsToCitations(refs, context);

    // Only the in-range citation survives; the out-of-range one is dropped.
    expect(citations).toHaveLength(1);
    expect(citations[0].chunkIndex).toBe(0);
    expect(
      citations.some((c) => c.quote === 'hallucinated out-of-range index')
    ).toBe(false);
  });

  it('drops ALL refs when context is empty', () => {
    const citations = mapRefsToCitations([{ chunk: 0, quote: 'x' }], []);
    expect(citations).toEqual([]);
  });

  it('falls back to the chunk text when the model omitted a usable quote', () => {
    const context = [chunk({ text: 'Deposit equals two months of rent.' })];
    const citations = mapRefsToCitations([{ chunk: 0, quote: '' }], context);

    expect(citations).toHaveLength(1);
    expect(citations[0].quote).toBe('Deposit equals two months of rent.');
  });

  it('deduplicates citations by (documentId, chunkIndex)', () => {
    const context = [chunk({ documentId: 'doc-A', chunkIndex: 0 })];
    const refs: ParsedCitationRef[] = [
      { chunk: 0, quote: 'first' },
      { chunk: 0, quote: 'second (same chunk)' },
    ];

    const citations = mapRefsToCitations(refs, context);
    expect(citations).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// selectDocChatLlm — composition-seam gate
// ---------------------------------------------------------------------------

describe('selectDocChatLlm', () => {
  it('returns the StubAnthropicDocChatLlm when no sdk is supplied', () => {
    expect(selectDocChatLlm({})).toBeInstanceOf(StubAnthropicDocChatLlm);
    // Defaulted (no options) also falls back to the stub.
    expect(selectDocChatLlm()).toBeInstanceOf(StubAnthropicDocChatLlm);
  });

  it('returns the real AnthropicDocChatLlm when an sdk is supplied', () => {
    const port = selectDocChatLlm({ sdk: fakeSdk });
    expect(port).toBeInstanceOf(AnthropicDocChatLlm);
  });
});
