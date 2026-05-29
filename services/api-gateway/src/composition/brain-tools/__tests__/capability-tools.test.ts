/**
 * Capability tools (CSA-3 / CSA-4) — output integrity tests.
 *
 * Verifies the disclosure-safe surface contract:
 *   - whatCanYouDoTool returns ≤3 bilingual capabilities.
 *   - aboutTool returns persona-preserving response + next action.
 *   - Neither tool leaks internal mechanics tokens.
 *   - compose_guidance fields are NON-EMPTY (the RT-5 directive must
 *     reach the model so it composes fresh).
 */

import { describe, expect, it } from 'vitest';
import {
  whatCanYouDoTool,
  aboutTool,
  toDisclosure,
  pickCuratedSample,
} from '../capability-tools.js';

const baseCtx = {
  tenantId: 'tnt-test',
  actorId: 'usr-test',
  personaSlug: 'T1_owner_strategist',
};

describe('whatCanYouDoTool', () => {
  it('returns up to 3 capability cards for the curated sample', async () => {
    const out = await whatCanYouDoTool.handler(
      { language: 'en', limit: 3 },
      baseCtx,
    );
    expect(out.capabilities.length).toBeGreaterThan(0);
    expect(out.capabilities.length).toBeLessThanOrEqual(3);
  });

  it('returns capabilities scoped to the requested topic', async () => {
    const out = await whatCanYouDoTool.handler(
      { topic: 'drafting', language: 'en', limit: 3 },
      baseCtx,
    );
    expect(out.topic).toBe('drafting');
    expect(out.capabilities.length).toBeGreaterThan(0);
  });

  it('every capability has bilingual public_name + public_description', async () => {
    const out = await whatCanYouDoTool.handler(
      { language: 'en', limit: 3 },
      baseCtx,
    );
    for (const cap of out.capabilities) {
      expect(cap.public_name.en.length).toBeGreaterThan(0);
      expect(cap.public_name.sw.length).toBeGreaterThan(0);
      expect(cap.public_description.en.length).toBeGreaterThan(0);
      expect(cap.public_description.sw.length).toBeGreaterThan(0);
    }
  });

  it('emits a non-empty compose_guidance directive (RT-5)', async () => {
    const out = await whatCanYouDoTool.handler(
      { language: 'en', limit: 2 },
      baseCtx,
    );
    expect(out.compose_guidance.length).toBeGreaterThan(20);
    expect(out.compose_guidance.toLowerCase()).toContain('reason');
  });

  it('emits an invitation + summary in both languages', async () => {
    const out = await whatCanYouDoTool.handler(
      { language: 'en', limit: 2 },
      baseCtx,
    );
    expect(out.invitation.en.length).toBeGreaterThan(0);
    expect(out.invitation.sw.length).toBeGreaterThan(0);
    expect(out.summary.en.length).toBeGreaterThan(0);
    expect(out.summary.sw.length).toBeGreaterThan(0);
  });
});

describe('aboutTool', () => {
  it('returns a persona-preserving response for who_are_you', async () => {
    const out = await aboutTool.handler(
      { intent: 'who_are_you', language: 'en' },
      baseCtx,
    );
    expect(out.intent).toBe('who_are_you');
    expect(out.response.en).toMatch(/Mr\. Mwikila/i);
    expect(out.response.sw).toMatch(/Bwana Mwikila|Mwikila/i);
  });

  it('returns a different response for each intent', async () => {
    const intents = [
      'who_are_you',
      'how_does_this_work',
      'are_you_ai',
      'what_about_mistakes',
      'data_privacy',
    ] as const;
    const responses: string[] = [];
    for (const intent of intents) {
      const out = await aboutTool.handler({ intent, language: 'en' }, baseCtx);
      responses.push(out.response.en);
    }
    expect(new Set(responses).size).toBe(intents.length);
  });

  it('never names an LLM provider or model brand in the response', async () => {
    const banned =
      /\b(claude|gpt|anthropic|openai|sonnet|haiku|opus|gemini)\b/i;
    const intents = [
      'who_are_you',
      'how_does_this_work',
      'are_you_ai',
      'what_about_mistakes',
      'data_privacy',
    ] as const;
    for (const intent of intents) {
      const out = await aboutTool.handler({ intent, language: 'en' }, baseCtx);
      expect(banned.test(out.response.en)).toBe(false);
      expect(banned.test(out.response.sw)).toBe(false);
    }
  });

  it('always returns a concrete next_action drawn from the registry', async () => {
    const out = await aboutTool.handler(
      { intent: 'who_are_you', language: 'en' },
      baseCtx,
    );
    expect(out.next_action.capability_name.en.length).toBeGreaterThan(0);
    expect(out.next_action.capability_name.sw.length).toBeGreaterThan(0);
    expect(out.next_action.example_question.en.length).toBeGreaterThan(0);
  });

  it('emits a non-empty compose_guidance directive (RT-5)', async () => {
    const out = await aboutTool.handler(
      { intent: 'who_are_you', language: 'en' },
      baseCtx,
    );
    expect(out.compose_guidance.length).toBeGreaterThan(20);
    expect(out.compose_guidance.toLowerCase()).toContain('reason');
  });
});

describe('pure helpers', () => {
  it('toDisclosure strips internal fields', () => {
    const entry = {
      id: 'mwikila.draft.lease',
      topic: 'drafting' as const,
      user_outcome: 'x',
      public_name: { en: 'a', sw: 'b' },
      public_description: { en: 'c', sw: 'd' },
      example_question: { en: 'e', sw: 'f' },
      example_response_pattern: { en: 'g', sw: 'h' },
      related: [],
      visibility: 'PUBLIC' as const,
    };
    const disc = toDisclosure(entry);
    expect('id' in disc).toBe(false);
    expect('related' in disc).toBe(false);
    expect('visibility' in disc).toBe(false);
    expect('topic' in disc).toBe(false);
  });

  it('pickCuratedSample returns at most the requested limit', () => {
    const sample = pickCuratedSample(2);
    expect(sample.length).toBeLessThanOrEqual(2);
  });
});
