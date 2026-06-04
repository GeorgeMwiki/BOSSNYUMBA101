/**
 * Blind-review pipeline tests: anonymisation, deterministic shuffle,
 * dataset build, scoring, report rendering, and the engine end-to-end run.
 */

import { describe, expect, it } from 'vitest';
import {
  anonymiseRationale,
  anonymiseRecord,
  assignReviewers,
  authorOf,
  buildBlindReviewDataset,
  buildReviewerTask,
  createInMemoryBlindReviewStore,
  createSyntheticFetcher,
  createSyntheticReviewer,
  deterministicShuffle,
  generateReport,
  runBlindReview,
  scoreVerdicts,
  type BlindReviewDataset,
  type MarginalDecisionRecord,
  type ReviewerVerdict,
} from './index.js';

const FIXED_MS = Date.parse('2026-06-03T12:00:00.000Z');

describe('anonymiseRationale', () => {
  it('redacts NIDA, lease reference, phone, email, and titled names', () => {
    const text =
      'Owner Mr. Juma Komba, NIDA 12345678-12345-12345-12, lease LSE-2026-0042, ' +
      'phone 0712 345 678, email juma@example.co.tz.';
    const out = anonymiseRationale(text);
    expect(out).not.toMatch(/12345678-12345/);
    expect(out).toContain('[NIDA]');
    expect(out).toContain('[LEASE_REF]');
    expect(out).toContain('[PHONE]');
    expect(out).toContain('[EMAIL]');
    expect(out).toContain('[NAME]');
  });

  it('recursively strips PII inside the decision snapshot', () => {
    const rec: MarginalDecisionRecord = {
      id: 'x',
      caseId: 'c',
      domain: 'rent',
      decision: 'approve',
      rationale: 'ok',
      snapshot: { note: 'call 0712 345 678', nested: { who: 'Mr. Juma Komba' } },
      author: 'ai',
      decidedAtIsoYear: '2025',
      propertyTypeBucket: 'apartment',
      regionBucket: 'dar',
    };
    const out = anonymiseRecord(rec);
    const snap = out.snapshot as { note: string; nested: { who: string } };
    expect(snap.note).toContain('[PHONE]');
    expect(snap.nested.who).toContain('[NAME]');
  });
});

describe('deterministicShuffle', () => {
  it('is stable for a given seed and permutes for different seeds', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(deterministicShuffle(items, 42)).toEqual(deterministicShuffle(items, 42));
    expect(deterministicShuffle(items, 42)).not.toEqual(
      deterministicShuffle(items, 7),
    );
    // Same multiset.
    expect([...deterministicShuffle(items, 42)].sort()).toEqual(items);
  });

  it('does not mutate the input array', () => {
    const items = [1, 2, 3];
    deterministicShuffle(items, 1);
    expect(items).toEqual([1, 2, 3]);
  });
});

describe('buildBlindReviewDataset + assignReviewers', () => {
  it('builds a 50/50 anonymised dataset of the requested size', async () => {
    const fetcher = createSyntheticFetcher({ seed: 1 });
    const ds = await buildBlindReviewDataset({
      fetcher,
      limit: 20,
      seed: 1,
      now: () => FIXED_MS,
    });
    expect(ds.totalSize).toBe(20);
    expect(ds.aiRecords).toHaveLength(10);
    expect(ds.humanRecords).toHaveLength(10);
    // Synthetic rationales carry no raw PII patterns.
    for (const r of [...ds.aiRecords, ...ds.humanRecords]) {
      expect(r.rationale).not.toMatch(/\d{8}-\d{5}-\d{5}-\d{2}/);
    }
  });

  it('degrades to an empty dataset when a fetcher throws (fail-soft)', async () => {
    const ds = await buildBlindReviewDataset({
      fetcher: {
        fetchAi: async () => {
          throw new Error('archive down');
        },
        fetchHuman: async () => null,
      },
      limit: 10,
      seed: 1,
      now: () => FIXED_MS,
    });
    expect(ds.totalSize).toBe(0);
    expect(ds.aiRecords).toHaveLength(0);
    expect(ds.humanRecords).toHaveLength(0);
  });

  it('gives each reviewer all records in a (seed-stable) order', async () => {
    const fetcher = createSyntheticFetcher({ seed: 2 });
    const ds = await buildBlindReviewDataset({ fetcher, limit: 10, seed: 2, now: () => FIXED_MS });
    const a = assignReviewers({ dataset: ds, reviewerIds: ['r1', 'r2'], seed: 2 });
    expect(a).toHaveLength(2);
    expect(a[0]?.recordIds).toHaveLength(10);
    // Different reviewers get different orders (seed + idx).
    expect(a[0]?.recordIds).not.toEqual(a[1]?.recordIds);
    // Re-running is stable.
    const a2 = assignReviewers({ dataset: ds, reviewerIds: ['r1', 'r2'], seed: 2 });
    expect(a2[0]?.recordIds).toEqual(a[0]?.recordIds);
  });
});

function makeDataset(): BlindReviewDataset {
  const ai: MarginalDecisionRecord[] = [
    {
      id: 'ai-1',
      caseId: 'c1',
      domain: 'rent',
      decision: 'approve',
      rationale: 'x',
      snapshot: {},
      author: 'ai',
      decidedAtIsoYear: '2025',
      propertyTypeBucket: 'apartment',
      regionBucket: 'dar',
    },
  ];
  const human: MarginalDecisionRecord[] = [
    {
      id: 'hu-1',
      caseId: 'c2',
      domain: 'rent',
      decision: 'reject',
      rationale: 'y',
      snapshot: {},
      author: 'human',
      decidedAtIsoYear: '2025',
      propertyTypeBucket: 'townhouse',
      regionBucket: 'arusha',
    },
  ];
  return { id: 'ds', createdAtMs: FIXED_MS, aiRecords: ai, humanRecords: human, totalSize: 2 };
}

describe('scoreVerdicts', () => {
  it('computes accuracy, confusion matrix, and the indistinguishability verdict', () => {
    const ds = makeDataset();
    const verdicts: ReviewerVerdict[] = [
      { reviewerId: 'r', recordId: 'ai-1', guess: 'ai', confidence: 0.8 }, // correct
      { reviewerId: 'r', recordId: 'hu-1', guess: 'ai', confidence: 0.6 }, // wrong
    ];
    const s = scoreVerdicts({ dataset: ds, verdicts });
    expect(s.totalReviews).toBe(2);
    expect(s.correct).toBe(1);
    expect(s.accuracy).toBe(0.5);
    expect(s.indistinguishable).toBe(true); // 0.5 <= 0.55
    expect(s.confusionMatrix.aiCorrectlyIdentified).toBe(1);
    expect(s.confusionMatrix.humanMisidentifiedAsAi).toBe(1);
  });

  it('marks a high-accuracy panel as distinguishable (FAIL)', () => {
    const ds = makeDataset();
    const verdicts: ReviewerVerdict[] = [
      { reviewerId: 'r', recordId: 'ai-1', guess: 'ai', confidence: 1 },
      { reviewerId: 'r', recordId: 'hu-1', guess: 'human', confidence: 1 },
    ];
    const s = scoreVerdicts({ dataset: ds, verdicts });
    expect(s.accuracy).toBe(1);
    expect(s.indistinguishable).toBe(false);
  });

  it('ignores verdicts for unknown record ids', () => {
    const ds = makeDataset();
    const s = scoreVerdicts({
      dataset: ds,
      verdicts: [{ reviewerId: 'r', recordId: 'ghost', guess: 'ai', confidence: 1 }],
    });
    expect(s.totalReviews).toBe(1);
    expect(s.correct).toBe(0);
  });
});

describe('authorOf', () => {
  it('resolves the hidden ground-truth author', () => {
    const ds = makeDataset();
    expect(authorOf(ds, 'ai-1')).toBe('ai');
    expect(authorOf(ds, 'hu-1')).toBe('human');
    expect(authorOf(ds, 'nope')).toBeNull();
  });
});

describe('buildReviewerTask', () => {
  it('strips author labels and masks the case id', () => {
    const ds = makeDataset();
    const task = buildReviewerTask(
      { reviewerId: 'r', recordIds: ['ai-1', 'hu-1'] },
      ds,
      FIXED_MS,
    );
    expect(task.cards).toHaveLength(2);
    expect(JSON.stringify(task.cards)).not.toContain('"author"');
    expect(task.cards[0]?.caseIdMasked).toMatch(/\*\*\*\*/);
  });

  it('throws on an unknown record id in the assignment', () => {
    const ds = makeDataset();
    expect(() =>
      buildReviewerTask({ reviewerId: 'r', recordIds: ['missing'] }, ds, FIXED_MS),
    ).toThrowError(/unknown record id/);
  });
});

describe('generateReport', () => {
  it('renders a markdown report with the verdict and a fixed issued-at', () => {
    const ds = makeDataset();
    const report = generateReport({
      dataset: ds,
      verdicts: [
        { reviewerId: 'r', recordId: 'ai-1', guess: 'ai', confidence: 1 },
        { reviewerId: 'r', recordId: 'hu-1', guess: 'ai', confidence: 1 },
      ],
      title: 'Test',
      runId: 'run-1',
      issuedAtIso: '2026-06-03T12:00:00.000Z',
    });
    expect(report.markdown).toContain('# Test');
    expect(report.markdown).toContain('Issued at: 2026-06-03T12:00:00.000Z');
    expect(report.markdown).toMatch(/Verdict: (PASS|FAIL)/);
    expect(report.markdown).toContain('Mr. Mwikila');
    expect(report.passed).toBe(report.indistinguishable);
  });
});

describe('createSyntheticReviewer', () => {
  it('produces deterministic verdicts for the same reviewer + cards', () => {
    const ds = makeDataset();
    const task = buildReviewerTask(
      { reviewerId: 'r', recordIds: ['ai-1', 'hu-1'] },
      ds,
      FIXED_MS,
    );
    const reviewer = createSyntheticReviewer('r', {
      aiDetectRate: 0.9,
      humanFalsePositiveRate: 0.1,
    });
    expect(reviewer.review(task)).toEqual(reviewer.review(task));
  });
});

describe('runBlindReview (engine, end-to-end)', () => {
  it('runs end-to-end with synthetic reviewers and returns a report', async () => {
    const report = await runBlindReview(
      {
        limit: 30,
        seed: 5,
        issuedAtIso: '2026-06-03T12:00:00.000Z',
      },
      {
        fetcher: createSyntheticFetcher({ seed: 5 }),
        store: createInMemoryBlindReviewStore(),
        clock: { now: () => new Date(FIXED_MS) },
      },
    );
    expect(report.totalReviews).toBe(90); // 30 records * 3 reviewers
    expect(report.perReviewer).toHaveLength(3);
    expect(typeof report.accuracy).toBe('number');
    expect(report.accuracy).toBeGreaterThanOrEqual(0);
    expect(report.accuracy).toBeLessThanOrEqual(1);
    expect(report.markdown).toContain('Blind-Review Report (synthetic panel)');
  });

  it('is reproducible for a fixed seed', async () => {
    const deps = () => ({
      fetcher: createSyntheticFetcher({ seed: 9 }),
      store: createInMemoryBlindReviewStore(),
      clock: { now: () => new Date(FIXED_MS) },
    });
    const a = await runBlindReview({ limit: 20, seed: 9 }, deps());
    const b = await runBlindReview({ limit: 20, seed: 9 }, deps());
    expect(a.accuracy).toBe(b.accuracy);
    expect(a.confusionMatrix).toEqual(b.confusionMatrix);
  });

  it('persists the scored run and fires the audit sink', async () => {
    const store = createInMemoryBlindReviewStore();
    const logged: Array<{ readonly runId: string; readonly passed: boolean }> = [];
    const report = await runBlindReview(
      { limit: 10, seed: 3 },
      {
        fetcher: createSyntheticFetcher({ seed: 3 }),
        store,
        audit: { log: (e) => logged.push({ runId: e.runId, passed: e.passed }) },
        clock: { now: () => new Date(FIXED_MS) },
      },
    );
    const saved = await store.get(report.datasetId);
    expect(saved?.status).toBe('scored');
    expect(saved?.report?.datasetId).toBe(report.datasetId);
    expect(logged).toHaveLength(1);
    expect(logged[0]?.runId).toBe(report.datasetId);
  });
});
