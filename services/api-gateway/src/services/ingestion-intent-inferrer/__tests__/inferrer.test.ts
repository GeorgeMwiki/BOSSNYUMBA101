/**
 * Inferrer adapter / fallback tests — Wave COMPANY-BRAIN (Y-A).
 *
 * Covers:
 *   - No LLM provided → heuristic.
 *   - forceHeuristic=true → heuristic.
 *   - LLM throws → heuristic fallback.
 *   - LLM returns non-JSON → heuristic fallback.
 *   - LLM returns valid JSON with hallucinated evidence ids → filtered
 *     out; if all proposals end up evidence-empty → heuristic backfill.
 *   - LLM returns valid JSON with allowed evidence → normalised
 *     IngestIntent surfaces.
 */

import { describe, expect, it, vi } from 'vitest';

import { inferIngestIntent, type InferrerLlmCall } from '../inferrer.js';
import type { IngestSnapshot } from '../types.js';

function snapshotFixture(): IngestSnapshot {
  return {
    receipt: {
      uploadId: 'upload-xyz',
      status: 'indexed',
      chunksCount: 5,
      entitiesExtracted: 4,
      summary: null,
      warnings: [],
      previewEntities: [],
    },
    filename: 'lease.pdf',
    sourceKind: 'pdf',
    summaryEn: 'Standard residential lease agreement.',
    summarySw: 'Mkataba wa kawaida wa kupanga nyumba.',
    keyFacts: [{ kind: 'doc.kind', value: 'lease', confidence: 1 }],
    availableEntities: [
      { kind: 'unit_type', id: 'apartment', displayName: 'Apartment' },
      { kind: 'concept', id: 'lease', displayName: 'Lease' },
      { kind: 'role', id: 'tenant', displayName: 'Tenant' },
      { kind: 'role', id: 'landlord', displayName: 'Landlord' },
    ],
    chunkSamples: [
      { chunkId: 'chunk-1', excerpt: 'Tenant agrees to pay rent monthly.' },
      { chunkId: 'chunk-2', excerpt: 'Landlord shall maintain the unit.' },
    ],
    detectedLanguage: 'en',
  };
}

describe('inferIngestIntent — adapter contract', () => {
  it('uses heuristic when no llmCall is provided', async () => {
    const intent = await inferIngestIntent(snapshotFixture());
    expect(intent.provider).toBe('heuristic');
    expect(intent.reasonTag).toBe('heuristic-v1');
  });

  it('uses heuristic when forceHeuristic is true even with llmCall set', async () => {
    const llmCall: InferrerLlmCall = vi.fn().mockResolvedValue({
      text: '{}',
      provider: 'anthropic',
    });
    const intent = await inferIngestIntent(snapshotFixture(), {
      llmCall,
      forceHeuristic: true,
    });
    expect(intent.provider).toBe('heuristic');
    expect(llmCall).not.toHaveBeenCalled();
  });

  it('falls back to heuristic when LLM throws', async () => {
    const llmCall: InferrerLlmCall = vi
      .fn()
      .mockRejectedValue(new Error('rate limited'));
    const intent = await inferIngestIntent(snapshotFixture(), { llmCall });
    expect(intent.provider).toBe('heuristic');
  });

  it('falls back to heuristic when LLM returns non-JSON', async () => {
    const llmCall: InferrerLlmCall = vi.fn().mockResolvedValue({
      text: 'sorry, no JSON for you',
      provider: 'openai',
    });
    const intent = await inferIngestIntent(snapshotFixture(), { llmCall });
    expect(intent.provider).toBe('heuristic');
  });

  it('filters hallucinated evidence ids out of LLM proposals', async () => {
    const llmCall: InferrerLlmCall = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        narrative_en: 'Snapshot scanned.',
        narrative_sw: 'Mkutano umechanganuliwa.',
        confidence: 0.7,
        proposed_tabs: [
          {
            tab_type: 'tenants',
            title_en: 'Top tenants',
            title_sw: 'Wapangaji wakuu',
            reason_en: 'Many candidate tenant entities found.',
            reason_sw: 'Wahusika wengi wamepatikana.',
            evidence_ids: ['chunk-1', 'HALLUCINATED-CHUNK'],
            confidence: 0.8,
            config: {},
          },
        ],
        proposed_reminders: [],
        proposed_opportunities: [],
        proposed_risks: [],
      }),
      provider: 'anthropic',
    });
    const intent = await inferIngestIntent(snapshotFixture(), { llmCall });
    expect(intent.provider).toBe('anthropic');
    expect(intent.proposedTabs).toHaveLength(1);
    // Hallucinated id filtered, only chunk-1 remains.
    expect(intent.proposedTabs[0]!.evidenceIds).toEqual(['chunk-1']);
  });

  it('falls back to heuristic when LLM emits only proposals with hallucinated evidence', async () => {
    const llmCall: InferrerLlmCall = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        proposed_tabs: [
          {
            tab_type: 'tenants',
            title_en: 't',
            title_sw: 't',
            reason_en: 'r',
            reason_sw: 'r',
            evidence_ids: ['HALLUCINATED-1', 'HALLUCINATED-2'],
            confidence: 0.5,
            config: {},
          },
        ],
      }),
      provider: 'anthropic',
    });
    const intent = await inferIngestIntent(snapshotFixture(), { llmCall });
    expect(intent.provider).toBe('heuristic');
  });

  it('coerces an unknown tab_type to a safe default', async () => {
    const llmCall: InferrerLlmCall = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        proposed_tabs: [
          {
            tab_type: 'underground_mining_pit',
            title_en: 'Weird tab',
            title_sw: 'Kichupo kigeni',
            reason_en: 'Test',
            reason_sw: 'Jaribio',
            evidence_ids: ['chunk-1'],
            confidence: 0.7,
            config: {},
          },
        ],
        proposed_reminders: [],
        proposed_opportunities: [],
        proposed_risks: [],
      }),
      provider: 'anthropic',
    });
    const intent = await inferIngestIntent(snapshotFixture(), { llmCall });
    expect(intent.proposedTabs[0]!.tabType).toBe('tenants');
  });

  it('strips markdown ```json fences when parsing LLM reply', async () => {
    const llmCall: InferrerLlmCall = vi.fn().mockResolvedValue({
      text: '```json\n{"proposed_tabs":[{"tab_type":"tenants","title_en":"T","title_sw":"T","reason_en":"R","reason_sw":"R","evidence_ids":["chunk-1"],"confidence":0.7,"config":{}}]}\n```',
      provider: 'openai',
    });
    const intent = await inferIngestIntent(snapshotFixture(), { llmCall });
    expect(intent.provider).toBe('openai');
    expect(intent.proposedTabs).toHaveLength(1);
  });

  it('clamps invalid confidence values to [0, 1]', async () => {
    const llmCall: InferrerLlmCall = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        confidence: 99,
        proposed_tabs: [
          {
            tab_type: 'tenants',
            title_en: 'T',
            title_sw: 'T',
            reason_en: 'R',
            reason_sw: 'R',
            evidence_ids: ['chunk-1'],
            confidence: -5,
            config: {},
          },
        ],
      }),
      provider: 'anthropic',
    });
    const intent = await inferIngestIntent(snapshotFixture(), { llmCall });
    expect(intent.confidence).toBeLessThanOrEqual(1);
    expect(intent.proposedTabs[0]!.confidence).toBeGreaterThanOrEqual(0);
  });
});
