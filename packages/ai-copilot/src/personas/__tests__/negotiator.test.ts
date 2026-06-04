/**
 * Tests for the Price Negotiator persona (KI-008).
 *
 * The generator is backed by `generateStructured` (anthropic-client.ts), which
 * reads JSON text out of the SDK's `messages.create` response. We inject a fake
 * `AnthropicClient` whose `sdk.messages.create` returns a canned Anthropic-style
 * response carrying the JSON counter — so NO real network/Anthropic call occurs.
 */

import { describe, it, expect, vi } from 'vitest';

import {
  createNegotiatorCounterGenerator,
  type NegotiatorRequest,
} from '../negotiator.js';
import {
  ModelTier,
  type AnthropicClient,
  type AnthropicMessageResponse,
  type AnthropicSdkLike,
} from '../../providers/anthropic-client.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Canned Anthropic Messages response whose text block is `text`. */
function buildResponse(text: string): AnthropicMessageResponse {
  return {
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 12, output_tokens: 24 },
  };
}

/** Build a fake AnthropicClient that replies with one canned JSON counter. */
function buildClient(
  jsonReply: unknown,
  defaultModel: string = ModelTier.SONNET
): { client: AnthropicClient; create: ReturnType<typeof vi.fn> } {
  const create = vi
    .fn()
    .mockResolvedValue(buildResponse(JSON.stringify(jsonReply)));
  const sdk: AnthropicSdkLike = {
    messages: {
      create: create as unknown as AnthropicSdkLike['messages']['create'],
    },
  };
  return { client: { defaultModel, sdk }, create };
}

/** A representative in-band negotiation request. */
function buildRequest(
  overrides: Partial<NegotiatorRequest> = {}
): NegotiatorRequest {
  return {
    policy: {
      listPrice: 100_000,
      floorPrice: 80_000,
      approvalRequiredBelow: 85_000,
      maxDiscountPct: 0.2,
      currency: 'TZS',
      toneGuide: 'firm',
      acceptableConcessions: [
        { kind: 'free_month', description: 'One free month on a 12m lease' },
      ],
    },
    negotiation: { domain: 'lease_price', roundCount: 1 },
    history: [
      { actor: 'prospect', offer: 70_000, rationale: 'budget is tight' },
    ],
    lowerBound: 90_000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('createNegotiatorCounterGenerator — happy path', () => {
  it('returns a structurally-valid counter with a numeric offer', async () => {
    const { client, create } = buildClient({
      offer: 95_000,
      concessions: [
        {
          kind: 'free_month',
          description: 'One free month for a 12-month commitment',
          monetaryValue: 8_000,
        },
      ],
      rationale: 'Meeting partway while protecting the owner floor.',
    });

    const generate = createNegotiatorCounterGenerator({ client });
    const result = await generate(buildRequest());

    expect(typeof result.offer).toBe('number');
    expect(result.offer).toBe(95_000);
    expect(result.rationale).toBe(
      'Meeting partway while protecting the owner floor.'
    );
    expect(result.concessions).toHaveLength(1);
    expect(result.concessions[0]).toMatchObject({
      kind: 'free_month',
      monetaryValue: 8_000,
    });
    // modelTier reflects the model id passed to generateStructured (default Sonnet).
    expect(result.modelTier).toBe(ModelTier.SONNET);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('defaults concessions to an empty array when the model omits them', async () => {
    const { client } = buildClient({
      offer: 92_500,
      rationale: 'Hold firm near the lower bound.',
    });

    const generate = createNegotiatorCounterGenerator({ client });
    const result = await generate(buildRequest());

    expect(result.offer).toBe(92_500);
    expect(result.concessions).toEqual([]);
  });

  it('honours the model override and reflects it in modelTier', async () => {
    const { client, create } = buildClient(
      {
        offer: 91_000,
        concessions: [],
        rationale: 'Anchored counter.',
      },
      ModelTier.SONNET
    );

    const generate = createNegotiatorCounterGenerator({
      client,
      model: ModelTier.HAIKU,
    });
    const result = await generate(buildRequest());

    expect(result.modelTier).toBe(ModelTier.HAIKU);
    expect(create.mock.calls[0][0].model).toBe(ModelTier.HAIKU);
  });
});

// ---------------------------------------------------------------------------
// Courtesy pre-clamp to lowerBound
// ---------------------------------------------------------------------------

describe('createNegotiatorCounterGenerator — courtesy pre-clamp', () => {
  it('clamps a below-lowerBound model proposal UP to lowerBound', async () => {
    // Model proposes 70_000 (rounds to 70_000), below the 90_000 lower bound.
    const { client } = buildClient({
      offer: 70_000,
      concessions: [],
      rationale: 'Too generous — should be clamped up by the courtesy guard.',
    });

    const generate = createNegotiatorCounterGenerator({ client });
    const result = await generate(buildRequest({ lowerBound: 90_000 }));

    // Math.max(lowerBound, round(offer)) === lowerBound.
    expect(result.offer).toBe(90_000);
  });

  it('rounds an in-band fractional offer and leaves it above lowerBound', async () => {
    const { client } = buildClient({
      offer: 93_499.6,
      concessions: [],
      rationale: 'In-band fractional offer.',
    });

    const generate = createNegotiatorCounterGenerator({ client });
    const result = await generate(buildRequest({ lowerBound: 90_000 }));

    // Math.round(93_499.6) === 93_500, which exceeds the lower bound.
    expect(result.offer).toBe(93_500);
  });
});
