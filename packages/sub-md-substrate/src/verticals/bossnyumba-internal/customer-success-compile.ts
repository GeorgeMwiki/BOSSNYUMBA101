/**
 * customer-success.compile — Compile<OrgChurnSignals, CsBrief>
 *
 * THE PROACTIVE CHURN-SURFACER. This sub-MD scans the org's owner-account
 * + churn-signal + cs-touchpoint streams for a rolling window (default
 * 7d) and produces a CS brief.
 *
 * Brief surfaces (in priority order):
 *   1.  RED owners: composite risk >= 0.75 AND no CS touchpoint in the
 *       window. These are the owners the org is about to lose.
 *   2.  AMBER owners: composite risk in [0.45, 0.75). Need a sales.chase
 *       cycle but not an emergency.
 *   3.  RECENT WINS: risk dropped > 0.2 in window — surface so the org
 *       knows what's working.
 *   4.  COHORT ANOMALIES: a tenure-band or seat-band has > 2x baseline
 *       risk rate — the symptom of a recent product regression.
 *
 * Composite risk:
 *     0.4 * usage-drop signals
 *   + 0.25 * payment-failure
 *   + 0.15 * support-spike
 *   + 0.10 * csat-drop
 *   + 0.05 * competitor-mention
 *   + 0.05 * feature-request-stalled
 *   clamped 0..1
 *
 * The MD reads this brief at "morning standup" time and triggers
 * sales.chase per RED + AMBER owner.
 */

import {
  createCompile,
  type CompilePrimitive,
  type CompileStrategy,
  type CompileReport,
  type CompileWindow,
} from '../../primitives/compile.js';
import type {
  ChurnSignal,
  CsTouchpoint,
  OwnerAccount,
} from './entities.js';

export type CsRiskBand = 'green' | 'amber' | 'red';

export interface CsBriefOwnerRow {
  readonly ownerAccountId: string;
  readonly displayName: string;
  readonly compositeRisk: number;
  readonly band: CsRiskBand;
  readonly daysSinceLastTouch: number;
  readonly topContributingSignal: string;
  readonly arrAtRiskUsdMinor: number;
}

export interface CohortAnomaly {
  readonly cohort: string;
  readonly riskRate: number;
  readonly baselineRate: number;
  readonly liftMultiple: number;
}

export interface CsBrief extends CompileReport {
  readonly redOwners: ReadonlyArray<CsBriefOwnerRow>;
  readonly amberOwners: ReadonlyArray<CsBriefOwnerRow>;
  readonly recentWins: ReadonlyArray<CsBriefOwnerRow>;
  readonly cohortAnomalies: ReadonlyArray<CohortAnomaly>;
  readonly totalArrAtRiskUsdMinor: number;
}

export interface CsCompileInput {
  readonly owner: OwnerAccount;
  readonly windowSignals: ReadonlyArray<ChurnSignal>;
  readonly windowTouchpoints: ReadonlyArray<CsTouchpoint>;
  /**
   * Risk score the owner had ENTERING the window (baseline). Used to
   * compute recent-wins delta.
   */
  readonly riskAtWindowStart: number;
}

const SIGNAL_WEIGHTS: Readonly<Record<ChurnSignal['kind'], number>> = Object.freeze({
  'usage-drop': 0.4,
  'payment-failure': 0.25,
  'support-spike': 0.15,
  'csat-drop': 0.1,
  'competitor-mention': 0.05,
  'feature-request-stalled': 0.05,
});

const RED_THRESHOLD = 0.75;
const AMBER_THRESHOLD = 0.45;
const RECENT_WIN_DELTA = 0.2;

export function computeCompositeRisk(
  signals: ReadonlyArray<ChurnSignal>,
): { readonly score: number; readonly topKind: string } {
  if (signals.length === 0) {
    return { score: 0, topKind: 'none' };
  }
  const byKind = new Map<string, number>();
  for (const s of signals) {
    const w = SIGNAL_WEIGHTS[s.kind] ?? 0;
    byKind.set(s.kind, (byKind.get(s.kind) ?? 0) + w * Math.min(1, s.severityScore));
  }
  // Sum across kinds, clamp 0..1.
  let score = 0;
  let topKind = 'none';
  let topVal = -1;
  for (const [kind, v] of byKind.entries()) {
    score += v;
    if (v > topVal) {
      topVal = v;
      topKind = kind;
    }
  }
  return { score: Math.max(0, Math.min(1, score)), topKind };
}

export function bandFromScore(score: number): CsRiskBand {
  if (score >= RED_THRESHOLD) return 'red';
  if (score >= AMBER_THRESHOLD) return 'amber';
  return 'green';
}

export interface CsCompileStrategyOptions {
  readonly nowMs: number;
  /** Baseline cohort risk rate for anomaly detection. Defaults 0.15. */
  readonly baselineCohortRiskRate?: number;
  /** Lift multiplier to flag a cohort. Defaults 2.0. */
  readonly cohortLiftThreshold?: number;
}

export function createCsCompileStrategy(
  opts: CsCompileStrategyOptions,
): CompileStrategy<CsCompileInput, CsBrief> {
  const baseline = opts.baselineCohortRiskRate ?? 0.15;
  const lift = opts.cohortLiftThreshold ?? 2.0;

  return {
    async compile({ inputs, window }) {
      const red: CsBriefOwnerRow[] = [];
      const amber: CsBriefOwnerRow[] = [];
      const wins: CsBriefOwnerRow[] = [];

      let totalArrAtRiskUsdMinor = 0;

      // Cohort accumulators (tenure-band x seat-band).
      const cohortCounts = new Map<string, { atRisk: number; total: number }>();

      for (const inp of inputs) {
        const { score, topKind } = computeCompositeRisk(inp.windowSignals);
        const band = bandFromScore(score);
        const lastTouch = [...inp.windowTouchpoints].sort(
          (a, b) => b.atMs - a.atMs,
        )[0];
        const daysSinceLastTouch = lastTouch
          ? Math.floor((opts.nowMs - lastTouch.atMs) / 86_400_000)
          : 999;

        const row: CsBriefOwnerRow = {
          ownerAccountId: inp.owner.id,
          displayName: inp.owner.displayName,
          compositeRisk: score,
          band,
          daysSinceLastTouch,
          topContributingSignal: topKind,
          arrAtRiskUsdMinor: inp.owner.arrUsdMinor,
        };

        // RED + no recent touchpoint = an "about-to-lose" owner.
        if (band === 'red' && daysSinceLastTouch > 7) {
          red.push(row);
          totalArrAtRiskUsdMinor += inp.owner.arrUsdMinor;
        } else if (band === 'amber') {
          amber.push(row);
        }

        // Recent win: baseline risk was at least RED_THRESHOLD and the
        // composite dropped by RECENT_WIN_DELTA or more.
        if (
          inp.riskAtWindowStart >= RED_THRESHOLD &&
          inp.riskAtWindowStart - score >= RECENT_WIN_DELTA
        ) {
          wins.push(row);
        }

        const tenureBand = bandTenure(inp.owner.tenureMonths);
        const seatBand = bandSeats(inp.owner.seatCount);
        const cohortKey = `${tenureBand}/${seatBand}`;
        const c = cohortCounts.get(cohortKey) ?? { atRisk: 0, total: 0 };
        c.total += 1;
        if (band !== 'green') c.atRisk += 1;
        cohortCounts.set(cohortKey, c);
      }

      const cohortAnomalies: CohortAnomaly[] = [];
      for (const [cohort, c] of cohortCounts.entries()) {
        if (c.total < 5) continue; // dignity floor
        const rate = c.atRisk / c.total;
        if (rate >= baseline * lift) {
          cohortAnomalies.push({
            cohort,
            riskRate: rate,
            baselineRate: baseline,
            liftMultiple: rate / baseline,
          });
        }
      }

      red.sort((a, b) => b.arrAtRiskUsdMinor - a.arrAtRiskUsdMinor);
      amber.sort((a, b) => b.compositeRisk - a.compositeRisk);

      const recommendedActions: string[] = [];
      if (red.length > 0) {
        recommendedActions.push(
          `Trigger sales.chase for ${red.length} RED owners (top: ${red[0]!.displayName})`,
        );
      }
      if (amber.length > 0) {
        recommendedActions.push(
          `Schedule product-tip drip for ${amber.length} AMBER owners`,
        );
      }
      if (cohortAnomalies.length > 0) {
        recommendedActions.push(
          `Investigate ${cohortAnomalies.length} cohort anomalies — likely product regression`,
        );
      }
      if (wins.length > 0) {
        recommendedActions.push(
          `Document ${wins.length} recent wins for playbook`,
        );
      }

      const anomalies = cohortAnomalies.map((c) => ({
        label: `cohort ${c.cohort}`,
        severity:
          c.liftMultiple >= 4
            ? ('critical' as const)
            : c.liftMultiple >= 3
            ? ('high' as const)
            : ('medium' as const),
        rationale: `risk rate ${c.riskRate.toFixed(2)} vs baseline ${c.baselineRate.toFixed(2)} (lift ${c.liftMultiple.toFixed(1)}x)`,
      }));

      const brief: CsBrief = {
        title: 'Customer Success Brief',
        window,
        aggregates: Object.freeze({
          totalOwners: inputs.length,
          redCount: red.length,
          amberCount: amber.length,
          recentWinCount: wins.length,
          totalArrAtRiskUsdMinor,
        }),
        topN: red.slice(0, 5).map((r) => ({
          label: r.displayName,
          value: r.compositeRisk,
        })),
        anomalies,
        recommendedActions,
        inputsExamined: inputs.length,
        redOwners: red,
        amberOwners: amber,
        recentWins: wins,
        cohortAnomalies,
        totalArrAtRiskUsdMinor,
      };
      return brief;
    },
  };
}

function bandTenure(months: number): string {
  if (months <= 3) return 'new';
  if (months <= 12) return 'first-year';
  if (months <= 36) return 'mid';
  return 'mature';
}

function bandSeats(seats: number): string {
  if (seats <= 3) return 'tiny';
  if (seats <= 10) return 'small';
  if (seats <= 50) return 'mid';
  return 'large';
}

export interface CustomerSuccessCompileSubMd {
  readonly name: string;
  readonly compile: CompilePrimitive<CsCompileInput, CsBrief>;
}

export interface CreateCustomerSuccessCompileArgs {
  readonly nowMs: number;
  readonly baselineCohortRiskRate?: number;
  readonly cohortLiftThreshold?: number;
}

export function createCustomerSuccessCompile(
  args: CreateCustomerSuccessCompileArgs,
): CustomerSuccessCompileSubMd {
  const strategyOpts: CsCompileStrategyOptions = {
    nowMs: args.nowMs,
    ...(args.baselineCohortRiskRate !== undefined
      ? { baselineCohortRiskRate: args.baselineCohortRiskRate }
      : {}),
    ...(args.cohortLiftThreshold !== undefined
      ? { cohortLiftThreshold: args.cohortLiftThreshold }
      : {}),
  };
  return Object.freeze({
    name: 'customer-success.compile',
    compile: createCompile<CsCompileInput, CsBrief>({
      name: 'customer-success.compile.brief',
      strategy: createCsCompileStrategy(strategyOpts),
      maxInputs: 5_000,
    }),
  });
}

export type Window = CompileWindow;
