/**
 * preference-pair-builder tests.
 *
 * Covers the 5 generation rules + quality filter + JSONL serialisation
 * shape for SimPO/DPO/KTO.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  buildPreferencePairs,
  pairToJsonlRow,
  applyQualityFilter,
  hasMinimumCohort,
  MIN_PAIRS_BEFORE_TUNING,
  MIN_CHOSEN_QUALITY,
  generateKtoFromThumbs,
  generateDpoFromOwnerEdit,
  generatePrmStepDpoFromToolRecovery,
  type FeedbackEventReader,
  type TurnContentResolver,
  type QualityScorer,
  type ToolRecoveryFeed,
} from '../preference-pair-builder/index.js';
import type {
  FeedbackEvent,
  PreferencePair,
} from '../types.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const CLOCK_AT = new Date('2026-05-19T08:00:00Z');

function mkContentResolver(content: {
  prompt?: string;
  response?: string;
}): TurnContentResolver {
  return {
    resolvePrompt: vi.fn(async () => content.prompt ?? 'default prompt'),
    resolveResponse: vi.fn(async () => content.response ?? 'default response'),
  };
}

function mkScorer(score = 0.8): QualityScorer {
  return { scoreResponse: vi.fn(async () => score) };
}

function mkFeedbackReader(
  events: FeedbackEvent[],
): FeedbackEventReader {
  return { listSince: vi.fn(async () => events) };
}

function mkSources(args: {
  feedbacks?: FeedbackEvent[];
  content?: Parameters<typeof mkContentResolver>[0];
  scoreValue?: number;
  toolRecovery?: ToolRecoveryFeed;
}) {
  return {
    feedback: mkFeedbackReader(args.feedbacks ?? []),
    content: mkContentResolver(args.content ?? {}),
    scorer: mkScorer(args.scoreValue ?? 0.8),
    clock: () => CLOCK_AT,
    ...(args.toolRecovery ? { toolRecovery: args.toolRecovery } : {}),
  };
}

function mkFeedback(
  partial: Partial<FeedbackEvent> & Pick<FeedbackEvent, 'kind' | 'payload'>,
): FeedbackEvent {
  return {
    tenantId: TENANT,
    turnId: 'turn-1',
    capturedAt: CLOCK_AT.toISOString(),
    ...partial,
  } as FeedbackEvent;
}

// ───────────────────── Rule 1+2: thumbs → KTO ─────────────────────

describe('Rule 1+2 — thumbs_up / thumbs_down → KTO scalar', () => {
  it('thumbs_up → KTO good with chosen=response', async () => {
    const sources = mkSources({
      content: { prompt: 'P', response: 'good answer' },
      scoreValue: 0.9,
    });
    const pair = await generateKtoFromThumbs(
      sources,
      mkFeedback({ kind: 'thumbs_up', payload: { kind: 'thumbs_up' } }),
    );
    expect(pair).not.toBeNull();
    expect(pair!.algo).toBe('kto');
    expect(pair!.ktoLabel).toBe('good');
    expect(pair!.chosen).toBe('good answer');
    expect(pair!.rejected).toBe('');
  });

  it('thumbs_down → KTO bad with rejected=response', async () => {
    const sources = mkSources({
      content: { prompt: 'P', response: 'bad answer' },
      scoreValue: 0.3,
    });
    const pair = await generateKtoFromThumbs(
      sources,
      mkFeedback({ kind: 'thumbs_down', payload: { kind: 'thumbs_down' } }),
    );
    expect(pair!.ktoLabel).toBe('bad');
    expect(pair!.rejected).toBe('bad answer');
    expect(pair!.chosen).toBe('');
  });
});

// ─────── Rule 3: regenerate-then-accept → DPO chosen=v2 ──────────

describe('Rule 3 — regenerated → accepted → DPO', () => {
  it('emits DPO pair with new content as chosen', async () => {
    const sources = mkSources({
      content: { prompt: 'Send rent reminder', response: 'v1 draft' },
      scoreValue: 0.88,
      feedbacks: [
        mkFeedback({
          kind: 'regenerated',
          payload: { kind: 'regenerated', newContent: 'v2 better draft' },
        }),
        mkFeedback({
          kind: 'accepted_as_is',
          payload: { kind: 'accepted_as_is' },
        }),
      ],
    });
    const result = await buildPreferencePairs(sources, {
      tenantId: TENANT,
      since: new Date('2026-01-01'),
      minPairs: 1,
    });
    const dpo = result.pairs.filter((p) => p.algo === 'dpo');
    expect(dpo.length).toBe(1);
    expect(dpo[0].chosen).toBe('v2 better draft');
    expect(dpo[0].rejected).toBe('v1 draft');
  });
});

// ─────── Rule 4: owner edit → DPO chosen=owner_version ──────────

describe('Rule 4 — edited_by_owner → DPO highest-signal pair', () => {
  it('emits DPO with owner edit as chosen', async () => {
    const sources = mkSources({
      content: { prompt: 'P', response: 'brain draft' },
      scoreValue: 0.95,
    });
    const pair = await generateDpoFromOwnerEdit(
      sources,
      mkFeedback({
        kind: 'edited_by_owner',
        payload: {
          kind: 'edited_by_owner',
          editedContent: 'owner-edited final',
        },
      }),
    );
    expect(pair).not.toBeNull();
    expect(pair!.algo).toBe('dpo');
    expect(pair!.chosen).toBe('owner-edited final');
    expect(pair!.rejected).toBe('brain draft');
  });
});

// ─────── Rule 5: tool fail → succeed → PRM step-DPO ──────────

describe('Rule 5 — tool fail → succeed → PRM step-DPO', () => {
  it('emits step-level pair from tool recovery', () => {
    const sources = mkSources({});
    const pair = generatePrmStepDpoFromToolRecovery(sources, {
      tenantId: TENANT,
      sourceTurnId: 'turn-X',
      prompt: 'charge tenant rent',
      failedToolCallJson: '{"tool":"rent-charge","amount":-1}',
      succeededToolCallJson: '{"tool":"rent-charge","amount":50000}',
    });
    expect(pair.algo).toBe('prm-step-dpo');
    expect(pair.chosen).toBe('{"tool":"rent-charge","amount":50000}');
    expect(pair.rejected).toBe('{"tool":"rent-charge","amount":-1}');
  });

  it('build orchestrator includes tool-recovery pairs', async () => {
    const sources = mkSources({
      toolRecovery: {
        listSince: async () => [
          {
            tenantId: TENANT,
            sourceTurnId: 'turn-X',
            prompt: 'charge',
            failedToolCallJson: '{"amount":-1}',
            succeededToolCallJson: '{"amount":50000}',
          },
        ],
      },
    });
    const result = await buildPreferencePairs(sources, {
      tenantId: TENANT,
      since: new Date('2026-01-01'),
      minPairs: 1,
    });
    expect(result.stats.prmStepDpo).toBe(1);
  });
});

// ───────────────────── Quality filter ─────────────────────────────

describe('quality filter', () => {
  it('rejects when chosenQuality < MIN_CHOSEN_QUALITY', () => {
    const verdict = applyQualityFilter({
      pair: mkBareParr({ chosenQuality: 0.4 }),
      rejectedPercentile: 0.025,
    });
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toContain('chosenQuality');
  });

  it('rejects catastrophic rejection (percentile < 0.5%)', () => {
    const verdict = applyQualityFilter({
      pair: mkBareParr({ chosenQuality: 0.9, rejectedPercentile: 0.001 }),
      rejectedPercentile: 0.001,
    });
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toContain('catastrophically');
  });

  it('rejects too-good rejected (signal too weak)', () => {
    const verdict = applyQualityFilter({
      pair: mkBareParr({ chosenQuality: 0.9, rejectedPercentile: 0.5 }),
      rejectedPercentile: 0.5,
    });
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toContain('too good');
  });

  it('accepts sweet-spot pair (p2.5 rejected, chosen quality 0.88)', () => {
    const verdict = applyQualityFilter({
      pair: mkBareParr({ chosenQuality: 0.88, rejectedPercentile: 0.025 }),
      rejectedPercentile: 0.025,
    });
    expect(verdict.accepted).toBe(true);
  });

  it('hasMinimumCohort returns true at ≥ 5k pairs', () => {
    const fewPairs: PreferencePair[] = Array(MIN_PAIRS_BEFORE_TUNING - 1).fill(
      mkBareParr({}),
    );
    const enoughPairs: PreferencePair[] = Array(MIN_PAIRS_BEFORE_TUNING).fill(
      mkBareParr({}),
    );
    expect(hasMinimumCohort(fewPairs)).toBe(false);
    expect(hasMinimumCohort(enoughPairs)).toBe(true);
  });
});

// ───────────────────── JSONL serialisation ────────────────────────

describe('pairToJsonlRow', () => {
  it('DPO row has {prompt, chosen, rejected}', () => {
    const row = pairToJsonlRow(
      mkBareParr({ algo: 'dpo', prompt: 'P', chosen: 'C', rejected: 'R' }),
    );
    expect(JSON.parse(row)).toEqual({ prompt: 'P', chosen: 'C', rejected: 'R' });
  });

  it('SimPO row has same shape as DPO', () => {
    const row = pairToJsonlRow(
      mkBareParr({ algo: 'simpo', prompt: 'P', chosen: 'C', rejected: 'R' }),
    );
    const parsed = JSON.parse(row);
    expect(parsed.chosen).toBe('C');
    expect(parsed.rejected).toBe('R');
  });

  it('KTO row has {prompt, response, label}', () => {
    const row = pairToJsonlRow(
      mkBareParr({
        algo: 'kto',
        prompt: 'P',
        chosen: 'good text',
        rejected: '',
        ktoLabel: 'good',
      }),
    );
    expect(JSON.parse(row)).toEqual({
      prompt: 'P',
      response: 'good text',
      label: 'good',
    });
  });

  it('PRM step-DPO row has {prompt, state_chosen, state_rejected}', () => {
    const row = pairToJsonlRow(
      mkBareParr({
        algo: 'prm-step-dpo',
        prompt: 'P',
        chosen: '{"tool":"x"}',
        rejected: '{"tool":"y"}',
      }),
    );
    expect(JSON.parse(row).state_chosen).toBe('{"tool":"x"}');
  });
});

describe('buildPreferencePairs stats', () => {
  it('counts dpo/kto separately', async () => {
    const sources = mkSources({
      content: { prompt: 'p', response: 'r' },
      scoreValue: 0.85,
      feedbacks: [
        mkFeedback({
          turnId: 't1',
          kind: 'thumbs_up',
          payload: { kind: 'thumbs_up' },
        }),
        mkFeedback({
          turnId: 't2',
          kind: 'edited_by_owner',
          payload: { kind: 'edited_by_owner', editedContent: 'edit' },
        }),
      ],
    });
    const result = await buildPreferencePairs(sources, {
      tenantId: TENANT,
      since: new Date('2026-01-01'),
      minPairs: 1,
    });
    // KTO from thumbs uses chosenQuality=score 0.85, rejectedPercentile=1
    // which fails "too good" filter — so kto gets filtered.
    // DPO from edit uses rejectedPercentile=0.025 which is sweet spot.
    expect(result.stats.dpo).toBe(1);
  });

  it('cohortReady=false until minPairs reached', async () => {
    const sources = mkSources({
      content: { prompt: 'p', response: 'r' },
      scoreValue: 0.9,
      feedbacks: [
        mkFeedback({
          kind: 'edited_by_owner',
          payload: { kind: 'edited_by_owner', editedContent: 'x' },
        }),
      ],
    });
    const result = await buildPreferencePairs(sources, {
      tenantId: TENANT,
      since: new Date('2026-01-01'),
      // default minPairs = 5000 — won't be reached with 1 feedback
    });
    expect(result.cohortReady).toBe(false);
  });
});

// ────────────────────────── helpers ───────────────────────────────

function mkBareParr(overrides: Partial<PreferencePair>): PreferencePair {
  return Object.freeze({
    tenantId: TENANT,
    sourceTurnId: 'turn-1',
    algo: 'dpo',
    prompt: 'P',
    chosen: 'C',
    rejected: 'R',
    chosenQuality: 0.85,
    rejectedPercentile: 0.025,
    generatedAt: CLOCK_AT.toISOString(),
    ...overrides,
  });
}
