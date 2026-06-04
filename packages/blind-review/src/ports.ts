/**
 * Blind-review engine — injected ports.
 *
 * The pipeline is pure scoring + rendering logic; everything with a side
 * effect is a port the host wires at boot. There is NO Supabase / Drizzle /
 * HTTP / fetch / env import anywhere in this package — the api-gateway
 * composition root supplies real adapters; tests supply in-memory fakes.
 * (The only place `process.env` is even mentioned is this explanatory
 * comment: the package never reads it.)
 *
 * @module @bossnyumba/blind-review/ports
 */

import type {
  BlindReviewDataset,
  BlindReviewReport,
  DecisionAuthor,
  MarginalDecisionRecord,
} from './types.js';

/**
 * Persistence port for blind-review runs. The host backs this with a
 * `blind_review_runs` table (service-role) or an in-memory map in tests.
 * All methods are async and immutable — `update` returns a fresh run.
 */
export interface BlindReviewStore {
  get(runId: string): Promise<BlindReviewRun | null>;
  create(run: BlindReviewRun): Promise<BlindReviewRun>;
  /** Attach the finished report to a run; returns a fresh immutable run. */
  update(
    runId: string,
    updates: {
      readonly report?: BlindReviewReport;
      readonly status?: BlindReviewRunStatus;
    },
  ): Promise<BlindReviewRun>;
  /** Mark a run closed/archived. */
  end(runId: string): Promise<void>;
}

export type BlindReviewRunStatus = 'building' | 'reviewing' | 'scored' | 'closed';

export interface BlindReviewRun {
  readonly id: string;
  readonly status: BlindReviewRunStatus;
  readonly dataset: BlindReviewDataset;
  readonly report?: BlindReviewReport;
  readonly createdAtMs: number;
}

/**
 * Resolves a record id to its hidden ground-truth author. The host queries
 * the decision archive; a record that cannot be resolved returns `null` so
 * the scorer simply skips it. NEVER throws — an unresolved id is a normal
 * "not in this dataset" path, not an error.
 */
export interface GroundTruthResolver {
  resolve(recordId: string): Promise<DecisionAuthor | null>;
}

/**
 * Read-only fetchers for the marginal decisions under review. Each is
 * tenant-scoped by the host (the api-gateway binds `app.current_tenant_id`
 * before calling). Returning `null` (or an empty array) renders the
 * "nothing on file" empty dataset rather than an error.
 *
 * Fail-soft by contract: a fetcher that throws is caught by the pipeline's
 * private `safeFetch<T>` wrapper, which keeps the three outcomes
 * type-distinct (data | empty | error) and never lets a crash escape.
 */
export interface DecisionFetcher {
  fetchAi(
    limit: number,
  ): Promise<ReadonlyArray<MarginalDecisionRecord> | null>;
  fetchHuman(
    limit: number,
  ): Promise<ReadonlyArray<MarginalDecisionRecord> | null>;
}

/**
 * Optional analytics sink for a completed run. Fire-and-forget; the
 * pipeline never awaits it on the hot path and wraps the call in try/catch.
 */
export interface BlindReviewAuditSink {
  log(entry: {
    readonly runId: string;
    readonly datasetId: string;
    readonly totalReviews: number;
    readonly accuracy: number;
    readonly indistinguishable: boolean;
    readonly passed: boolean;
  }): void;
}

/** Injectable clock so tests are deterministic. */
export interface BlindReviewClock {
  now(): Date;
}

/** Default wall-clock implementation. */
export const systemClock: BlindReviewClock = { now: () => new Date() };
