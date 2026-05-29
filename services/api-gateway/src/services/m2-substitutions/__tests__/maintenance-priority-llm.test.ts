/**
 * M-2 surface 3 tests — maintenance-priority LLM scorer.
 *
 * Covers:
 *   1. Happy path — LLM returns valid structured assessment + photo citations.
 *   2. Cache control — ephemeral marker present on system block.
 *   3. Fail-fallback — LLM error -> heuristic clamp with safety escalation.
 *   4. Heuristic — safety keyword + vulnerable occupant escalates to CRITICAL.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  createLlmMaintenancePriorityScorer,
  defaultHeuristicMaintenancePriority,
  type MaintenancePriorityInput,
} from '../maintenance-priority-llm.js';
import type { BrainLlmClient } from '../../brain/llm-call.js';

const SAFETY_INPUT: MaintenancePriorityInput = {
  requestId: 'req-1',
  description: 'Smell of gas near the kitchen stove. Tenant evacuated children.',
  photoUrls: ['https://photos.example/req-1/a.jpg'],
  hints: ['gas leak', 'kitchen'],
  propertyType: 'residential',
  hasMinors: true,
  hasMedicalDependent: false,
};

const COSMETIC_INPUT: MaintenancePriorityInput = {
  requestId: 'req-2',
  description: 'A small paint chip near the door handle.',
  photoUrls: [],
  hints: ['paint chip'],
  propertyType: 'residential',
  hasMinors: false,
  hasMedicalDependent: false,
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
            usage: { input_tokens: 110, output_tokens: 180 },
          };
        },
      },
    },
  });
}

describe('maintenance-priority-llm (M-2 surface 3)', () => {
  it('happy path — LLM returns structured assessment with photo citations', async () => {
    const capture: { request: unknown | null } = { request: null };
    const client = buildFakeClient(
      {
        category: 'SAFETY',
        severity: 'CRITICAL',
        urgency: 'EMERGENCY',
        priorityScore: 98,
        safetyConcerns: ['Gas leak risk to minors'],
        suggestedActionsSw: ['Funga gesi mara moja.', 'Wasiliana na huduma ya dharura.'],
        suggestedActionsEn: ['Shut gas main immediately.', 'Call emergency response.'],
        citedPhotoUrls: ['https://photos.example/req-1/a.jpg'],
      },
      capture,
    );
    const scorer = createLlmMaintenancePriorityScorer({ client });
    const out = await scorer(SAFETY_INPUT);
    expect(out.llmProvider).toBe('anthropic');
    expect(out.severity).toBe('CRITICAL');
    expect(out.urgency).toBe('EMERGENCY');
    expect(out.priorityScore).toBeGreaterThanOrEqual(90);
    expect(out.citedPhotoUrls).toContain('https://photos.example/req-1/a.jpg');
  });

  it('cache_control — system block carries ephemeral marker', async () => {
    const capture: { request: unknown | null } = { request: null };
    const client = buildFakeClient(
      {
        category: 'COSMETIC',
        severity: 'LOW',
        urgency: 'LOW',
        priorityScore: 10,
        safetyConcerns: [],
        suggestedActionsSw: ['Subiri shughuli ya ukarabati.'],
        suggestedActionsEn: ['Schedule with next maintenance pass.'],
        citedPhotoUrls: [],
      },
      capture,
    );
    const scorer = createLlmMaintenancePriorityScorer({ client });
    await scorer(COSMETIC_INPUT);
    const req = capture.request as {
      system: Array<{ type: string; text: string; cache_control?: { type: string } }>;
    };
    expect(req.system[0]?.cache_control?.type).toBe('ephemeral');
    expect(req.system[0]?.text).toContain('Mr. Mwikila');
  });

  it('fail-fallback — LLM throws -> heuristic clamps to EMERGENCY for gas+minors', async () => {
    const client: BrainLlmClient = Object.freeze({
      model: 'claude-sonnet-4-6',
      sdk: {
        messages: {
          async create(): Promise<never> {
            throw new Error('network timeout');
          },
        },
      },
    });
    const logger = { warn: vi.fn(), error: vi.fn() };
    const scorer = createLlmMaintenancePriorityScorer({
      client,
      logger: logger as never,
    });
    const out = await scorer(SAFETY_INPUT);
    expect(out.llmProvider).toBe('heuristic');
    expect(out.severity).toBe('CRITICAL');
    expect(out.urgency).toBe('EMERGENCY');
    expect(out.priorityScore).toBeGreaterThanOrEqual(90);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('heuristic — cosmetic paint chip drops to LOW with score < 25', async () => {
    const out = await defaultHeuristicMaintenancePriority(COSMETIC_INPUT);
    expect(out.severity).toBe('LOW');
    expect(out.urgency).toBe('LOW');
    expect(out.priorityScore).toBeLessThanOrEqual(25);
    expect(out.category).toBe('COSMETIC');
  });
});
