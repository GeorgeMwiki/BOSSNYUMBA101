import { describe, it, expect } from 'vitest';
import {
  wireBlindReview,
  BLIND_REVIEW_FLAG,
  type WireBlindReviewDeps,
} from './wire';
import { createInMemoryBlindReviewStore } from './in-memory-store';
import { createSyntheticFetcher } from './synthetic-fetcher';

const FIXED_MS = Date.parse('2026-06-03T12:00:00.000Z');

function baseDeps(enabled: boolean): WireBlindReviewDeps {
  return {
    enabled,
    fetcher: createSyntheticFetcher({ seed: 7 }),
    store: createInMemoryBlindReviewStore(),
    clock: { now: () => new Date(FIXED_MS) },
  };
}

describe('feature-flag name', () => {
  it('is the canonical BOSSNYUMBA_FEATURE_* env name', () => {
    expect(BLIND_REVIEW_FLAG).toBe('BOSSNYUMBA_FEATURE_BLIND_REVIEW');
  });
});

describe('wireBlindReview — default OFF', () => {
  it('returns null when the flag is disabled', () => {
    expect(wireBlindReview(baseDeps(false))).toBeNull();
  });

  it('returns a bound panel when the flag is enabled', () => {
    const panel = wireBlindReview(baseDeps(true));
    expect(panel).not.toBeNull();
    expect(typeof panel?.handle).toBe('function');
  });
});

describe('wireBlindReview — bound handle', () => {
  it('runs a synthetic panel and returns a report through the facade', async () => {
    const panel = wireBlindReview(baseDeps(true));
    const report = await panel!.handle({
      limit: 20,
      seed: 7,
      reviewerIds: ['manager-1', 'manager-2'],
      issuedAtIso: '2026-06-03T12:00:00.000Z',
    });
    expect(report).not.toBeNull();
    expect(report?.totalReviews).toBe(40); // 20 records * 2 reviewers
    expect(report?.markdown).toContain('Mr. Mwikila');
    expect(report?.accuracy).toBeGreaterThanOrEqual(0);
    expect(report?.accuracy).toBeLessThanOrEqual(1);
  });

  it('rejects a malformed request at the zod boundary without throwing', async () => {
    const panel = wireBlindReview(baseDeps(true));
    // reviewerIds: [] fails .min(1); must return null, never throw.
    const report = await panel!.handle({ reviewerIds: [] });
    expect(report).toBeNull();
  });
});
