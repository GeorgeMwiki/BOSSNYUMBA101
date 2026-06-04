/**
 * Correlation detector — nightly belief × outcome Pearson pass.
 *
 * For each (segment, region, metric) cell, compute Pearson r between a numeric
 * belief's co-observed series and an anonymised property-outcome series.
 * Surface findings where:
 *
 *     |r| > R_THRESHOLD (0.4) AND p < P_THRESHOLD (0.05) AND n >= minSampleSize (30)
 *
 * A belief is a single scalar/range at rest, but the warehouse co-observes the
 * belief-aligned quantity at the moment each outcome is recorded (e.g. the
 * believed rent comparable / occupancy rate / arrears ratio in force when that
 * property outcome landed). Each {@link OutcomeRow} therefore carries the
 * co-observed `beliefValue` for that row, and the detector correlates that
 * genuinely varying series against the outcome series. Rows are bound to a
 * belief by `beliefSubject` (falling back to every numeric belief in the cell
 * when the row leaves it unset, so a fetcher that cannot attribute still
 * works).
 *
 * The belief-engine never reads the outcome warehouse directly — the caller
 * injects an `outcomeFetcher` + a `BeliefStorePort`. The injected fetcher is
 * wrapped in {@link safeFetch}, so a throwing adapter degrades to an empty
 * pass rather than crashing. The Pearson + p-value math is PURE and exported
 * for tests.
 */

import {
  safeFetch,
  type BeliefStorePort,
  type OutcomeFetcher,
  type OutcomeRow,
} from './ports.js';
import type { Belief, BeliefDomain, CorrelationFinding } from './types.js';

export const DEFAULT_MIN_SAMPLE = 30;
export const R_THRESHOLD = 0.4;
export const P_THRESHOLD = 0.05;

export interface FindCorrelationsArgs {
  readonly domain?: BeliefDomain;
  readonly minSampleSize?: number;
  readonly now?: () => number;
}

export interface FindCorrelationsDeps {
  readonly store: BeliefStorePort;
  readonly outcomeFetcher: OutcomeFetcher;
}

/**
 * Run the nightly pass. Returns the findings (also handed back so the caller
 * can persist them to `correlation_findings`). Degrades to `[]` when there
 * are no numeric beliefs, no outcomes, or the outcome fetcher throws.
 */
export async function findCorrelations(
  args: FindCorrelationsArgs,
  deps: FindCorrelationsDeps,
): Promise<ReadonlyArray<CorrelationFinding>> {
  const minSample = args.minSampleSize ?? DEFAULT_MIN_SAMPLE;
  const domain = args.domain ?? 'market-economics';
  const nowIso = new Date((args.now ?? Date.now)()).toISOString();

  const beliefs = await deps.store.listByDomain(domain, 500);
  const numericBeliefs = beliefs.filter(hasNumericValue);
  if (numericBeliefs.length === 0) return [];

  // Read-only data fetcher: a throw is caught (=> undefined => empty pass), a
  // resolved `[]` is the normal empty-state. The two outcomes stay distinct.
  const outcomes = (await safeFetch(deps.outcomeFetcher)) ?? [];
  if (outcomes.length === 0) return [];

  const grouped = groupOutcomes(outcomes);
  const findings: CorrelationFinding[] = [];

  for (const [cellKey, rows] of grouped.entries()) {
    if (rows.length < minSample) continue;
    const parts = cellKey.split('|');
    const segment = parts[0] ?? '';
    const region = parts[1] ?? '';
    const metric = parts[2] ?? '';

    for (const belief of numericBeliefs) {
      // Pair each outcome whose belief series is co-observed for THIS belief
      // (or left unattributed) into aligned (beliefValue, outcomeValue) points.
      const pairs = alignedPairs(belief, rows);
      if (pairs.length < minSample) continue;

      const beliefSeries = pairs.map((pt) => pt.beliefValue);
      const outcomeSeries = pairs.map((pt) => pt.outcomeValue);
      const { r, p } = pearson(beliefSeries, outcomeSeries);
      if (
        Number.isFinite(r) &&
        Number.isFinite(p) &&
        Math.abs(r) > R_THRESHOLD &&
        p < P_THRESHOLD
      ) {
        findings.push({
          id: '',
          segment: segment || null,
          region: region || null,
          beliefSubject: belief.subject,
          outcomeMetric: metric,
          r,
          p,
          n: pairs.length,
          summary: summariseFinding(
            belief,
            segment,
            region,
            metric,
            r,
            p,
            pairs.length,
          ),
          generatedAt: nowIso,
        });
      }
    }
  }
  return findings;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function hasNumericValue(b: Belief): boolean {
  if (b.value.kind === 'scalar' && typeof b.value.scalar === 'number') {
    return true;
  }
  return (
    b.value.kind === 'range' &&
    typeof b.value.rangeMin === 'number' &&
    typeof b.value.rangeMax === 'number'
  );
}

interface AlignedPoint {
  readonly beliefValue: number;
  readonly outcomeValue: number;
}

/**
 * Build aligned (beliefValue, outcomeValue) points for one belief. A row
 * contributes when it is either unattributed or attributed to this belief's
 * subject AND it carries a finite co-observed `beliefValue`. Rows without a
 * co-observed belief value carry no variance and are dropped, so the Pearson
 * input is never a constant broadcast.
 */
function alignedPairs(
  belief: Belief,
  rows: ReadonlyArray<OutcomeRow>,
): AlignedPoint[] {
  const points: AlignedPoint[] = [];
  for (const row of rows) {
    if (row.beliefSubject != null && row.beliefSubject !== belief.subject) {
      continue;
    }
    const beliefValue = row.beliefValue;
    if (typeof beliefValue !== 'number' || !Number.isFinite(beliefValue)) {
      continue;
    }
    if (!Number.isFinite(row.value)) continue;
    points.push({ beliefValue, outcomeValue: row.value });
  }
  return points;
}

/** Central numeric value of a belief — used only for the human summary. */
function beliefCentralValue(b: Belief): number {
  return b.value.kind === 'scalar'
    ? (b.value.scalar ?? 0)
    : ((b.value.rangeMin ?? 0) + (b.value.rangeMax ?? 0)) / 2;
}

function groupOutcomes(
  rows: ReadonlyArray<OutcomeRow>,
): Map<string, OutcomeRow[]> {
  const map = new Map<string, OutcomeRow[]>();
  for (const r of rows) {
    const key = `${r.segment ?? ''}|${r.region ?? ''}|${r.metric}`;
    const bucket = map.get(key);
    if (bucket) bucket.push(r);
    else map.set(key, [r]);
  }
  return map;
}

export interface PearsonResult {
  readonly r: number;
  readonly p: number;
}

/**
 * Pearson r + two-sided p-value (Fisher z-transform → normal approximation).
 * PURE + exported for tests.
 */
export function pearson(
  xs: ReadonlyArray<number>,
  ys: ReadonlyArray<number>,
): PearsonResult {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return { r: NaN, p: 1 };
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = (xs[i] ?? 0) - mx;
    const dy = (ys[i] ?? 0) - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  if (denom === 0) return { r: 0, p: 1 };
  const r = num / denom;
  if (Math.abs(r) >= 1) return { r, p: 0 };
  const z =
    Math.atanh(Math.max(-0.9999, Math.min(0.9999, r))) * Math.sqrt(n - 3);
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  return { r, p };
}

function mean(xs: ReadonlyArray<number>): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Abramowitz & Stegun 26.2.17 — error < 7.5e-8. */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-(z * z) / 2);
  const cdf =
    1 -
    d *
      (0.31938153 * t -
        0.356563782 * t * t +
        1.781477937 * t * t * t -
        1.821255978 * t * t * t * t +
        1.330274429 * t * t * t * t * t);
  return z >= 0 ? cdf : 1 - cdf;
}

function summariseFinding(
  belief: Belief,
  segment: string,
  region: string,
  metric: string,
  r: number,
  p: number,
  n: number,
): string {
  const dir = r > 0 ? 'positively' : 'negatively';
  const where =
    [segment, region].filter(Boolean).join(' / ') || 'platform-wide';
  const central = beliefCentralValue(belief).toFixed(2);
  return `Belief '${belief.subject}' (≈${central}) correlates ${dir} (r=${r.toFixed(2)}, p=${p.toFixed(3)}) with '${metric}' in ${where} (n=${n}).`;
}
