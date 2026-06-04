/**
 * Blind-review engine — orchestrates one indistinguishability run over its
 * injected ports.
 *
 * A run: build an anonymised 50/50 dataset from the {@link DecisionFetcher},
 * assign every reviewer a randomised order, drive N synthetic reviewers,
 * score the verdicts, render the report, persist the run via the
 * {@link BlindReviewStore}, and fire the optional {@link BlindReviewAuditSink}
 * (fire-and-forget). No env / DB / network here — every effect is a port.
 *
 * @module @bossnyumba/blind-review/engine
 */

import { assignReviewers, buildBlindReviewDataset } from './pipeline';
import {
  buildReviewerTask,
  createSyntheticReviewer,
  type SyntheticReviewerHeuristic,
} from './reviewer-panel';
import { generateReport } from './report-generator';
import { systemClock } from './ports';
import type {
  BlindReviewAuditSink,
  BlindReviewClock,
  BlindReviewStore,
  DecisionFetcher,
} from './ports';
import type {
  BlindReviewDataset,
  BlindReviewReport,
  ReviewerVerdict,
} from './types';

/** Dependencies the engine binds once at wiring time. */
export interface BlindReviewEngineDeps {
  /** Source of the marginal decisions under review. */
  readonly fetcher: DecisionFetcher;
  /** Persistence for the run + finished report. */
  readonly store: BlindReviewStore;
  /** Optional fire-and-forget analytics sink. */
  readonly audit?: BlindReviewAuditSink;
  /** Optional clock override (defaults to wall clock). */
  readonly clock?: BlindReviewClock;
  /** Default reviewer ids when a request omits them. */
  readonly defaultReviewerIds?: ReadonlyArray<string>;
  /** Default per-reviewer heuristics when a request omits them. */
  readonly defaultHeuristics?: ReadonlyArray<SyntheticReviewerHeuristic>;
}

/** Already-validated run options handed to the engine by the facade. */
export interface BlindReviewRunOptions {
  readonly limit?: number;
  readonly seed?: number;
  readonly reviewerIds?: ReadonlyArray<string>;
  readonly title?: string;
  readonly runId?: string;
  readonly issuedAtIso?: string;
}

const FALLBACK_REVIEWER_IDS: ReadonlyArray<string> = [
  'manager-alpha',
  'manager-beta',
  'manager-gamma',
];

const FALLBACK_HEURISTICS: ReadonlyArray<SyntheticReviewerHeuristic> = [
  { aiDetectRate: 0.58, humanFalsePositiveRate: 0.12 },
  { aiDetectRate: 0.55, humanFalsePositiveRate: 0.14 },
  { aiDetectRate: 0.61, humanFalsePositiveRate: 0.1 },
];

/**
 * Run one synthetic blind-review panel end-to-end and return the report.
 * The dataset, assignments, and report are deterministic for a fixed seed.
 */
export async function runBlindReview(
  options: BlindReviewRunOptions,
  deps: BlindReviewEngineDeps,
): Promise<BlindReviewReport> {
  const clock = deps.clock ?? systemClock;
  const reviewerIds =
    options.reviewerIds ?? deps.defaultReviewerIds ?? FALLBACK_REVIEWER_IDS;
  const heuristics =
    deps.defaultHeuristics && deps.defaultHeuristics.length > 0
      ? deps.defaultHeuristics
      : FALLBACK_HEURISTICS;

  const now = () => clock.now().getTime();

  const dataset = await buildBlindReviewDataset({
    fetcher: deps.fetcher,
    limit: options.limit ?? 100,
    now,
    ...(options.seed !== undefined ? { seed: options.seed } : {}),
  });

  const assignments = assignReviewers({
    dataset,
    reviewerIds,
    ...(options.seed !== undefined ? { seed: options.seed } : {}),
  });

  const allVerdicts: ReviewerVerdict[] = [];
  for (let i = 0; i < reviewerIds.length; i++) {
    const assignment = assignments[i];
    const reviewerId = reviewerIds[i];
    const heuristic = heuristics[i % heuristics.length];
    if (!assignment || !reviewerId || !heuristic) continue;
    const task = buildReviewerTask(assignment, dataset, dataset.createdAtMs);
    const reviewer = createSyntheticReviewer(reviewerId, heuristic);
    for (const v of reviewer.review(task)) allVerdicts.push(v);
  }

  const report = generateReport({
    dataset,
    verdicts: allVerdicts,
    title: options.title ?? 'Blind-Review Report (synthetic panel)',
    runId: options.runId ?? dataset.id,
    ...(options.issuedAtIso !== undefined ? { issuedAtIso: options.issuedAtIso } : {}),
  });

  await persistRun(dataset, report, now(), deps);
  emitAudit(report, deps);

  return report;
}

async function persistRun(
  dataset: BlindReviewDataset,
  report: BlindReviewReport,
  createdAtMs: number,
  deps: BlindReviewEngineDeps,
): Promise<void> {
  // Persistence is best-effort for the report path: a store failure must not
  // discard a completed, valid report. The host can re-run a missing run.
  try {
    await deps.store.create({
      id: report.datasetId,
      status: 'scored',
      dataset,
      report,
      createdAtMs,
    });
  } catch {
    // swallow — see comment above
  }
}

function emitAudit(report: BlindReviewReport, deps: BlindReviewEngineDeps): void {
  if (!deps.audit) return;
  try {
    deps.audit.log({
      runId: report.datasetId,
      datasetId: report.datasetId,
      totalReviews: report.totalReviews,
      accuracy: report.accuracy,
      indistinguishable: report.indistinguishable,
      passed: report.passed,
    });
  } catch {
    // fire-and-forget — never let the audit sink break the hot path
  }
}
