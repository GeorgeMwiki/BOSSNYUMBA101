/**
 * owner-reaction-capture tests.
 *
 * Round-trip all 9 reaction kinds + validate that payload mismatches
 * throw + sentiment classification.
 */

import { describe, it, expect } from 'vitest';
import {
  captureReaction,
  validateFeedbackPayload,
  isPositiveReaction,
  isNegativeReaction,
  type FeedbackEventStore,
  type OwnerReactionPorts,
} from '../owner-reaction-capture/index.js';
import type {
  FeedbackEvent,
  FeedbackPayload,
  ReactionKind,
} from '../types.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const CLOCK_AT = new Date('2026-05-19T08:00:00Z');

function mkStore(): FeedbackEventStore & { __rows: FeedbackEvent[] } {
  const rows: FeedbackEvent[] = [];
  return {
    __rows: rows,
    insert: async (e) => {
      rows.push(e);
    },
    listForTurn: async (args) =>
      rows.filter(
        (r) => r.tenantId === args.tenantId && r.turnId === args.turnId,
      ),
  };
}

function mkPorts(): OwnerReactionPorts & {
  __store: ReturnType<typeof mkStore>;
} {
  const store = mkStore();
  return {
    store,
    clock: () => CLOCK_AT,
    __store: store,
  };
}

// All 9 reaction-kind round-trip fixtures.
const FIXTURES: Array<{ kind: ReactionKind; payload: FeedbackPayload }> = [
  { kind: 'thumbs_up', payload: { kind: 'thumbs_up' } },
  { kind: 'thumbs_down', payload: { kind: 'thumbs_down' } },
  { kind: 'star_rating', payload: { kind: 'star_rating', stars: 5 } },
  {
    kind: 'regenerated',
    payload: { kind: 'regenerated', newContent: 'better draft v2' },
  },
  { kind: 'accepted_as_is', payload: { kind: 'accepted_as_is' } },
  {
    kind: 'edited_by_owner',
    payload: {
      kind: 'edited_by_owner',
      editedContent: 'owner-edited final version',
    },
  },
  {
    kind: 'paused_skill',
    payload: { kind: 'paused_skill', skillId: 'rent-charge-skill' },
  },
  {
    kind: 'resumed_skill',
    payload: { kind: 'resumed_skill', skillId: 'rent-charge-skill' },
  },
  {
    kind: 'manual_override',
    payload: {
      kind: 'manual_override',
      overrideReason: 'tenant called in person',
    },
  },
];

describe('captureReaction — 9-kind round trip', () => {
  it.each(FIXTURES)(
    'persists $kind kind round-trip',
    async ({ kind, payload }) => {
      const ports = mkPorts();
      const result = await captureReaction(ports, {
        tenantId: TENANT,
        turnId: `turn-${kind}`,
        kind,
        payload,
      });
      expect(result.captured).toBe(true);
      expect(result.event.kind).toBe(kind);
      expect(result.event.capturedAt).toBe(CLOCK_AT.toISOString());
      expect(ports.__store.__rows.length).toBe(1);
      expect(ports.__store.__rows[0].payload).toEqual(payload);
    },
  );

  it('allows multiple reactions for the same turn', async () => {
    const ports = mkPorts();
    await captureReaction(ports, {
      tenantId: TENANT,
      turnId: 'turn-1',
      kind: 'thumbs_up',
      payload: { kind: 'thumbs_up' },
    });
    await captureReaction(ports, {
      tenantId: TENANT,
      turnId: 'turn-1',
      kind: 'star_rating',
      payload: { kind: 'star_rating', stars: 4 },
    });
    const events = await ports.__store.listForTurn({
      tenantId: TENANT,
      turnId: 'turn-1',
    });
    expect(events.length).toBe(2);
  });
});

describe('validateFeedbackPayload', () => {
  it('throws when payload.kind ≠ declared kind', () => {
    expect(() =>
      validateFeedbackPayload('thumbs_up', {
        kind: 'thumbs_down',
      } as FeedbackPayload),
    ).toThrow(/does not match/);
  });

  it('throws when star_rating stars out of range', () => {
    expect(() =>
      validateFeedbackPayload('star_rating', {
        kind: 'star_rating',
        stars: 7 as never,
      }),
    ).toThrow(/stars must be 1-5/);
  });

  it('throws when regenerated newContent is empty', () => {
    expect(() =>
      validateFeedbackPayload('regenerated', {
        kind: 'regenerated',
        newContent: '',
      }),
    ).toThrow(/non-empty/);
  });

  it('throws when edited_by_owner editedContent is empty', () => {
    expect(() =>
      validateFeedbackPayload('edited_by_owner', {
        kind: 'edited_by_owner',
        editedContent: '',
      }),
    ).toThrow(/non-empty/);
  });

  it('throws when paused_skill skillId missing', () => {
    expect(() =>
      validateFeedbackPayload('paused_skill', {
        kind: 'paused_skill',
        skillId: '',
      }),
    ).toThrow(/skillId/);
  });

  it('throws when manual_override overrideReason missing', () => {
    expect(() =>
      validateFeedbackPayload('manual_override', {
        kind: 'manual_override',
        overrideReason: '',
      }),
    ).toThrow(/overrideReason/);
  });
});

describe('sentiment classification', () => {
  it('thumbs_up, accepted_as_is, resumed_skill → positive', () => {
    expect(isPositiveReaction('thumbs_up')).toBe(true);
    expect(isPositiveReaction('accepted_as_is')).toBe(true);
    expect(isPositiveReaction('resumed_skill')).toBe(true);
  });

  it('thumbs_down, paused_skill, manual_override → negative', () => {
    expect(isNegativeReaction('thumbs_down')).toBe(true);
    expect(isNegativeReaction('paused_skill')).toBe(true);
    expect(isNegativeReaction('manual_override')).toBe(true);
  });

  it('star_rating is neither positive nor negative on its own (depends on stars)', () => {
    expect(isPositiveReaction('star_rating')).toBe(false);
    expect(isNegativeReaction('star_rating')).toBe(false);
  });
});
