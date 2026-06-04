/**
 * @bossnyumba/blind-review — public API.
 *
 * Blind-review indistinguishability panel for marginal real-estate
 * decisions (lease / rent / deposit): anonymise -> shuffle -> N-reviewer
 * Turing-style panel where senior property managers blind-classify each
 * anonymised rationale as AI-authored (Mr. Mwikila, the brain layer within
 * BossNyumba) or human-authored, with an accuracy <= 0.55 indistinguishability
 * bar.
 *
 * Wire it at the api-gateway composition root with {@link wireBlindReview}
 * by injecting a decision fetcher, a run store, and (optionally) an audit
 * sink and clock — then call `panel.handle(...)` from the CI gate or the
 * regulator-drill route. The engine ships behind the default-OFF flag
 * {@link BLIND_REVIEW_FLAG}. Pure functions, deterministic seeds, no direct
 * DB/SDK/env — every side effect is an injected port.
 *
 * @module @bossnyumba/blind-review
 */

export * from './types.js';
export * from './ports.js';

export { anonymiseRationale, anonymiseRecord } from './anonymise.js';
export { mulberry32, deterministicShuffle } from './shuffle.js';

export {
  buildBlindReviewDataset,
  assignReviewers,
  type BuildDatasetInput,
  type AssignReviewersInput,
} from './pipeline.js';

export {
  createSyntheticFetcher,
  type SyntheticFetcherOptions,
} from './synthetic-fetcher.js';

export {
  buildReviewerTask,
  createSyntheticReviewer,
  type ReviewerTask,
  type SyntheticReviewerHeuristic,
} from './reviewer-panel.js';

export {
  scoreVerdicts,
  reliabilityFlags,
  authorOf,
  type AccuracyScore,
  type ScoreInput,
} from './accuracy-scorer.js';

export {
  generateReport,
  type GenerateReportInput,
} from './report-generator.js';

export {
  runBlindReview,
  type BlindReviewEngineDeps,
  type BlindReviewRunOptions,
} from './engine.js';

export {
  createInMemoryBlindReviewStore,
  type InMemoryStoreOptions,
} from './in-memory-store.js';

export {
  wireBlindReview,
  BLIND_REVIEW_FLAG,
  type BlindReview,
  type WireBlindReviewDeps,
} from './wire.js';
