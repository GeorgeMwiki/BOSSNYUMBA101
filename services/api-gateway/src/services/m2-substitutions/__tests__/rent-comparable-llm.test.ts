/**
 * M-2 surface 1 tests — rent-comparable LLM advisor.
 *
 * Covers:
 *   1. Happy path — LLM returns valid JSON with evidence; output flows through.
 *   2. Cache control — system block carries `cache_control: ephemeral`.
 *   3. Fail-fallback — LLM throws or returns empty evidence; heuristic wins.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  createLlmRentComparableAdvisor,
  defaultHeuristicRentComparable,
  type RentComparableInput,
} from '../rent-comparable-llm.js';
import type { BrainLlmClient } from '../../brain/llm-call.js';

const SAMPLE_INPUT: RentComparableInput = {
  unitId: 'unit-1',
  tenantTimezone: 'Africa/Dar_es_Salaam',
  currency: 'TZS',
  bedrooms: 2,
  squareMeters: 70,
  currentRentMinorUnits: 800_000,
  comparables: [
    {
      adapterId: 'rentometer',
      url: null,
      title: 'Area summary',
      rawDescription: 'Median monthly rent: 850000. Mean: 870000.',
      latitude: -6.8,
      longitude: 39.28,
    },
    {
      adapterId: 'airbnb',
      url: 'https://example.com/x',
      title: 'Apartment 2br',
      rawDescription: '2-bed monthly equivalent 900000.',
      latitude: -6.81,
      longitude: 39.29,
    },
  ],
};

function buildFakeClient(
  response: unknown,
  capture: { request: unknown | null },
): BrainLlmClient {
  return Object.freeze({
    model: 'claude-sonnet-4-6',
    sdk: {
      messages: {
        async create(request: unknown): Promise<{
          content: Array<{ type: string; text?: string }>;
          usage?: Record<string, number>;
        }> {
          capture.request = request;
          return {
            content: [{ type: 'text', text: JSON.stringify(response) }],
            usage: { input_tokens: 100, output_tokens: 200 },
          };
        },
      },
    },
  });
}

describe('rent-comparable-llm (M-2 surface 1)', () => {
  it('happy path — LLM JSON parses + evidence cited + output returned', async () => {
    const capture: { request: unknown | null } = { request: null };
    const client = buildFakeClient(
      {
        recommendedRentMinorUnits: 870_000,
        lowBandMinorUnits: 830_000,
        highBandMinorUnits: 920_000,
        narrativeSw: 'Mapendekezo yameongozwa na rentometer + airbnb. Median 870000.',
        narrativeEn: 'Recommendation derived from rentometer + airbnb comparables. Median 870000.',
        evidenceAdapterIds: ['rentometer', 'airbnb'],
      },
      capture,
    );
    const advisor = createLlmRentComparableAdvisor({ client });
    const out = await advisor(SAMPLE_INPUT);
    expect(out.llmProvider).toBe('anthropic');
    expect(out.recommendedRentMinorUnits).toBe(870_000);
    expect(out.evidenceAdapterIds).toContain('rentometer');
    expect(out.narrativeSw.length).toBeGreaterThan(0);
    expect(out.narrativeEn.length).toBeGreaterThan(0);
  });

  it('cache_control — system block carries ephemeral cache marker', async () => {
    const capture: { request: unknown | null } = { request: null };
    const client = buildFakeClient(
      {
        recommendedRentMinorUnits: 870_000,
        lowBandMinorUnits: 830_000,
        highBandMinorUnits: 920_000,
        narrativeSw: 'sw-narrative with rentometer evidence at end.',
        narrativeEn: 'en-narrative with rentometer evidence at end.',
        evidenceAdapterIds: ['rentometer'],
      },
      capture,
    );
    const advisor = createLlmRentComparableAdvisor({ client });
    await advisor(SAMPLE_INPUT);
    const req = capture.request as {
      system: Array<{ type: string; text: string; cache_control?: { type: string } }>;
    };
    expect(Array.isArray(req.system)).toBe(true);
    expect(req.system[0]?.cache_control?.type).toBe('ephemeral');
    expect(req.system[0]?.text).toContain('Mr. Mwikila');
  });

  it('fail-fallback — LLM throws -> heuristic clamp wins', async () => {
    const client: BrainLlmClient = Object.freeze({
      model: 'claude-sonnet-4-6',
      sdk: {
        messages: {
          async create(): Promise<never> {
            throw new Error('upstream 429');
          },
        },
      },
    });
    const logger = { warn: vi.fn(), error: vi.fn() };
    const advisor = createLlmRentComparableAdvisor({
      client,
      logger: logger as never,
    });
    const out = await advisor(SAMPLE_INPUT);
    expect(out.llmProvider).toBe('heuristic');
    expect(out.evidenceAdapterIds).toEqual(['rentometer', 'airbnb']);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('heuristic — directly callable, returns valid recommendation', async () => {
    const out = await defaultHeuristicRentComparable(SAMPLE_INPUT);
    expect(out.llmProvider).toBe('heuristic');
    expect(out.recommendedRentMinorUnits).toBeGreaterThan(0);
    expect(out.lowBandMinorUnits).toBeLessThanOrEqual(out.recommendedRentMinorUnits);
    expect(out.highBandMinorUnits).toBeGreaterThanOrEqual(out.recommendedRentMinorUnits);
  });
});
