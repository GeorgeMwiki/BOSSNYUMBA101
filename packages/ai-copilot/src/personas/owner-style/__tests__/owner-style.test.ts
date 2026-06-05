/**
 * Tests for the owner-style learning loop (gap-8).
 *
 * Covers: Bayesian blend + decay + reaction-boost, EN + SW feedback-signal
 * detection, confidence-gated style hint, and the service's honest-degrade
 * contract (a failing store NEVER throws from refine and NEVER fabricates).
 */

import { describe, it, expect } from 'vitest';

import { makeDefaultProfile } from '../style-dimensions.js';
import { updateProfile } from '../profiler.js';
import {
  parseFeedbackText,
  applyFeedback,
  type FeedbackSignalKind,
} from '../feedback-loop.js';
import { buildStyleHint } from '../style-hint.js';
import {
  createOwnerStyleService,
  type OwnerStyleService,
} from '../owner-style-service.js';
import {
  createInMemoryProfileStore,
  type OwnerStyleProfileStore,
} from '../persistence-port.js';
import type { OwnerStyleProfile } from '../style-dimensions.js';

const TENANT = 'tenant-1';
const fixedNow = () => '2026-06-05T00:00:00.000Z';

// ---------------------------------------------------------------------------
// Profiler
// ---------------------------------------------------------------------------

describe('profiler', () => {
  it('starts neutral and immutably returns a new profile', () => {
    const prior = makeDefaultProfile({ tenantId: TENANT, now: fixedNow });
    expect(prior.verbosity.value).toBe('balanced');
    expect(prior.feedbackCount).toBe(0);

    const next = updateProfile(
      prior,
      { text: 'hello there', tsMs: 1 },
      { now: fixedNow }
    );
    expect(next).not.toBe(prior);
    expect(prior.feedbackCount).toBe(0); // input untouched
    expect(next.feedbackCount).toBe(1);
  });

  it('a long message pushes verbosity toward verbose', () => {
    const prior = makeDefaultProfile({ tenantId: TENANT, now: fixedNow });
    const longText = Array.from({ length: 60 }, () => 'word').join(' ');
    const next = updateProfile(
      prior,
      { text: longText, tsMs: 1 },
      { now: fixedNow }
    );
    expect(next.verbosity.value).toBe('verbose');
  });

  it('a negative reaction down-weights the evidence', () => {
    const prior = makeDefaultProfile({ tenantId: TENANT, now: fixedNow });
    const longText = Array.from({ length: 60 }, () => 'word').join(' ');
    const pos = updateProfile(
      prior,
      { text: longText, tsMs: 1, reaction: 1 },
      { now: fixedNow }
    );
    const neg = updateProfile(
      prior,
      { text: longText, tsMs: 1, reaction: -1 },
      { now: fixedNow }
    );
    // Positive reaction amplifies the verbose vote more than a negative one.
    expect(pos.verbosity.confidence).toBeGreaterThan(neg.verbosity.confidence);
  });
});

// ---------------------------------------------------------------------------
// Feedback signals — EN + SW
// ---------------------------------------------------------------------------

describe('feedback-signal detection (EN + SW)', () => {
  const cases: ReadonlyArray<{ text: string; kind: FeedbackSignalKind }> = [
    // English
    { text: 'this is too long', kind: 'too_long' },
    { text: 'be brief please', kind: 'be_brief' },
    { text: 'give me more detail', kind: 'more_detail' },
    { text: 'use swahili from now on', kind: 'use_swahili' },
    { text: 'use english please', kind: 'use_english' },
    { text: 'be more cautious here', kind: 'more_cautious' },
    { text: 'be more aggressive', kind: 'more_aggressive' },
    { text: 'more formal please', kind: 'more_formal' },
    { text: 'relax, more casual', kind: 'more_casual' },
    { text: 'just do it', kind: 'just_do_it' },
    { text: 'give me options', kind: 'give_me_options' },
    // Swahili idioms
    { text: 'ndefu sana', kind: 'too_long' }, // too long
    { text: 'eleza zaidi tafadhali', kind: 'more_detail' }, // explain more
    { text: 'tumia kiswahili', kind: 'use_swahili' }, // use swahili
    { text: 'kwa kiingereza', kind: 'use_english' }, // in english
    { text: 'pole pole na hii', kind: 'more_cautious' }, // slowly / careful
    { text: 'songa mbele', kind: 'more_aggressive' }, // push forward
    { text: 'fanya tu', kind: 'just_do_it' }, // just do it
    { text: 'nipe chaguo', kind: 'give_me_options' }, // give me options
    { text: 'tulia kidogo', kind: 'more_casual' }, // relax
  ];

  for (const { text, kind } of cases) {
    it(`detects "${text}" -> ${kind}`, () => {
      const sig = parseFeedbackText(text);
      expect(sig?.kind).toBe(kind);
    });
  }

  it('returns null for non-feedback text', () => {
    expect(parseFeedbackText('what is my rent balance')).toBeNull();
  });

  it('applyFeedback("use_swahili") moves the language lean and records signal', () => {
    const prior = makeDefaultProfile({ tenantId: TENANT, now: fixedNow });
    const next = applyFeedback(
      prior,
      { kind: 'use_swahili' },
      { now: fixedNow }
    );
    expect(next.language.value).toBe('sw_leaning_bilingual');
    expect(next.updatedBySignal).toBe('use_swahili');
    expect(next.feedbackCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Style hint — confidence gated
// ---------------------------------------------------------------------------

describe('style hint', () => {
  it('is empty for a fresh (low-confidence) profile', () => {
    const prior = makeDefaultProfile({ tenantId: TENANT, now: fixedNow });
    expect(buildStyleHint(prior)).toBe('');
  });

  it('emits a terse directive once verbosity is confident', () => {
    let p = makeDefaultProfile({ tenantId: TENANT, now: fixedNow });
    // Repeated terse feedback drives confidence up over the floor.
    for (let i = 0; i < 5; i++) {
      p = applyFeedback(p, { kind: 'be_brief' }, { now: fixedNow });
    }
    const hint = buildStyleHint(p);
    expect(hint).toContain('LEARNED OWNER-STYLE');
    expect(hint.toLowerCase()).toContain('terse');
  });
});

// ---------------------------------------------------------------------------
// Service honest-degrade
// ---------------------------------------------------------------------------

function failingStore(): OwnerStyleProfileStore {
  return {
    async fetch() {
      throw new Error('db down');
    },
    async upsert(): Promise<OwnerStyleProfile> {
      throw new Error('db down');
    },
  };
}

describe('owner-style service honest-degrade', () => {
  it('refine never throws and flags degraded when the store fails', async () => {
    const svc: OwnerStyleService = createOwnerStyleService({
      store: failingStore(),
      now: fixedNow,
    });
    const result = await svc.refine(TENANT, [{ text: 'be brief', tsMs: 1 }]);
    expect(result.degraded).toBe(true);
    // It returns a real (non-fabricated) computed profile, not garbage.
    expect(result.profile.tenantId).toBe(TENANT);
  });

  it('refine persists and reports a headline change with a working store', async () => {
    const store = createInMemoryProfileStore();
    const svc = createOwnerStyleService({ store, now: fixedNow });
    // Drive verbosity to terse via repeated explicit feedback turns.
    let last = await svc.refine(TENANT, [{ text: 'be brief', tsMs: 1 }]);
    for (let i = 0; i < 5; i++) {
      last = await svc.refine(TENANT, [{ text: 'keep it short', tsMs: i + 2 }]);
    }
    expect(last.degraded).toBe(false);
    const profile = await svc.getProfile(TENANT);
    expect(profile.verbosity.value).toBe('terse');
    expect(profile.feedbackCount).toBeGreaterThan(0);
  });

  it('getStyleHint returns "" when the store fails (no fabrication)', async () => {
    const svc = createOwnerStyleService({ store: failingStore(), now: fixedNow });
    expect(await svc.getStyleHint(TENANT)).toBe('');
  });
});
